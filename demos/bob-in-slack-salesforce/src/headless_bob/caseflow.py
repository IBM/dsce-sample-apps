"""Case-driven Slack flow: a Salesforce case → a case channel → approve solution
→ implement (a real, predefined org change) → close (email, delete, archive).

State machine per channel, persisted in the `caseflow` table:

    alerted → solution_approved → implemented → closed

All button handlers are idempotent: each transition checks-and-advances state
in one UPDATE, so double-clicks are no-ops. A background sweep archives
abandoned flows (channel + case cleanup) after HB_CASEFLOW_IDLE_MINUTES.

The change deployed at 'implement' is predefined and deterministic (a
Validation Rule or, in the successplan variant, a field plus a record-triggered
Flow); Bob proposes, documents and explains it, the service executes it under
governed credentials after a human approves. See docs/deployment-approaches.md.
"""

import difflib
import json
from pathlib import Path
import logging
import re
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from .db import Database, now

_IMPLEMENT_WORDS = ("implement", "deploy", "build", "ship", "proceed", "execute", "apply",
                    "yes", "yep", "yeah", "go")
_IMPLEMENT_PHRASES = ("go ahead", "do it", "make it", "let's go", "lets go", "go for it",
                      "do that", "sounds good", "green light", "yes please")


# Words that mean "answer me" or "not yet" — they win over any implement word
# in the same message ("explain the solution first before implementing").
_ASK_OR_HOLD_WORDS = {"explain", "describe", "clarify", "elaborate", "summarize", "summarise",
                      "detail", "details", "tell", "walk", "before", "first", "wait", "hold",
                      "stop", "not", "dont", "don't", "question"}
_WH_OPENERS = {"what", "why", "how", "which", "who", "when", "where"}


def _is_asking_or_holding(lowered: str) -> bool:
    if lowered.endswith("?"):
        return True
    tokens = re.findall(r"[a-z']+", lowered)
    if tokens and tokens[0] in _WH_OPENERS:
        return True
    return any(t in _ASK_OR_HOLD_WORDS for t in tokens)


def _implementish(lowered: str) -> bool:
    """'implement' / 'deploy' with typos, or a go-ahead phrase."""
    if any(p in lowered for p in _IMPLEMENT_PHRASES):
        return True
    for token in re.findall(r"[a-z']+", lowered):
        if token in _IMPLEMENT_WORDS:
            return True
        if len(token) >= 5 and (
                difflib.SequenceMatcher(None, token, "implement").ratio() >= 0.75
                or difflib.SequenceMatcher(None, token, "deploy").ratio() >= 0.8):
            return True
    return False
from .mailer import Mailer, closure_email
from .metadata_api import MetadataApi
from .org_mcp import mcp_config
from .successplan import SuccessPlanArtifact
from . import package_artifact

LOGGER = logging.getLogger("headless_bob.caseflow")

VALIDATION_RULE = {
    "object_name": "Opportunity",
    "rule_name": "Description_Required_At_Commit",
    "formula": (
        'AND(ISCHANGED(StageName), '
        'OR(ISPICKVAL(StageName, "Negotiation/Review"), '
        'ISPICKVAL(StageName, "Closed Won")), '
        'OR(ISBLANK(Description), LEN(TRIM(Description)) < 50))'
    ),
    "error_message": (
        "A deal summary (50+ characters) is required before advancing this "
        "far. Help Agentforce understand this deal. [Deployed by Bob]"
    ),
}

SUCCESSPLAN_CASE_SUBJECT = "Success Plan Updates"
SUCCESSPLAN_REQUESTER_NAME = "Astro Codey (Sales Manager)"
SUCCESSPLAN_CASE_BODY = (
    "Success plans should automatically be created and assigned to me when an "
    "Opportunity is won. The Account and the Executive Sponsor from the "
    "Opportunity should be auto-populated on the Success Plan and I should get "
    "notified when a new one is created."
)

DEFAULT_CASE_SUBJECT = "Reps advancing deals without descriptions"
DEFAULT_CASE_BODY = (
    "Sales reps keep advancing Opportunities to late stages with empty "
    "Description fields. Our Agentforce deal summaries come out as generic "
    "boilerplate because there's no deal context to ground on. We need this "
    "enforced so every late-stage deal carries a real description."
)


class CaseFlow:
    def __init__(self, db: Database, jobs, slack, salesforce, mailer: Mailer, *,
                 requester_email: str = "",
                 po_user_ids: tuple[str, ...] = (),
                 archive_delay: int = 0,
                 idle_minutes: int = 20,
                 sweep_hours: tuple[int, int] | None = None,
                 variant: str = "successplan",
                 attract_loop: bool = False,
                 loop_delay: int = 15,
                 demo_opp_name: str = "Meridian Renewal",
                 slack_team_id: str = "",
                 case_owner_username: str = ""):
        self.db = db
        self.jobs = jobs
        self.slack = slack          # SlackAdapter (say/_post/principal)
        self.salesforce = salesforce
        self.mailer = mailer
        # The requester's inbox: the case's SuppliedEmail and the recipient of
        # the closure email. Empty = no closure email.
        self.requester_email = requester_email
        self.po_user_ids = po_user_ids
        self.archive_delay = archive_delay
        self.idle_minutes = idle_minutes
        self.sweep_hours = sweep_hours       # (start, end) local PT hours; None = always
        # Flows record an org number so a deployment could serve several orgs;
        # this sample wires exactly one (org 1).
        self.orgs = {1: salesforce}
        # Which predefined change 'implement' deploys, and whether the service
        # keeps a demo case waiting (attract loop) or waits for POST /demo/case.
        self.variant = variant
        self.attract_loop = attract_loop
        self.loop_delay = loop_delay
        self.demo_opp_name = demo_opp_name     # the deal used for the live proof
        self.slack_team_id = slack_team_id     # for app.slack.com deep links (resolved lazily)
        self.case_owner_username = case_owner_username  # optional: a named user owns the case
        self._owner_ids: dict[int, str | None] = {}
        self._implement_prompted: dict[tuple[str, str], float] = {}
        self.bootstrap_retry_seconds = 60   # attract loop: retry cadence while the org has no case
        # Package variant (Bob builds the change): set by create_app.
        self.mcp_url = ""
        self.mcp_token = ""
        self.package_types = package_artifact.ALLOWED_TYPES
        self.package_fix_attempts = 2
        threading.Thread(target=self._sweep_loop, daemon=True).start()
        if attract_loop:
            threading.Thread(target=self._bootstrap_loop, daemon=True).start()

    # -- beat 0: a case is created -------------------------------------------

    def _sf(self, flow_or_org) -> object:
        org = flow_or_org if isinstance(flow_or_org, int) else \
            (flow_or_org or {}).get("org", 1)
        return self.orgs.get(org, self.salesforce)

    def start(self, issue: str, org: int = 1) -> dict:
        """Synchronous kickoff: create the Salesforce case and its Slack channel,
        then hand the case to Bob. An empty issue uses the sample case story."""
        if org not in self.orgs:
            org = 1
        salesforce = self.orgs[org]
        default_subject, default_body = self._default_case()
        issue = (issue or "").strip() or default_body
        case = salesforce.create_case(
            default_subject if issue == default_body else issue.splitlines()[0][:120],
            issue, supplied_email=self.requester_email,
            supplied_name=SUCCESSPLAN_REQUESTER_NAME if self.variant == "successplan" else "",
            owner_id=self._case_owner_id(org, salesforce))

        number = case["CaseNumber"].lstrip("0") or case["CaseNumber"]
        # Slack reserves archived channel names forever; a non-default org gets
        # a prefix so two orgs' case numbers cannot collide (case-1042 / case2-1042).
        prefix = "case" if org == 1 else f"case{org}"
        channel_name = f"{prefix}-{number}".lower()
        channel_id = self._create_channel(channel_name)
        if self.variant == "package":
            # Must exist before the proposal turn: Bob's MCP servers and its
            # view of the project are fixed when the session starts.
            self._prepare_package_workspace(channel_id)
        self.db.execute(
            "INSERT OR REPLACE INTO caseflow (channel_id, channel_name, case_id,"
            " case_number, state, visitor_email, org, issue, created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (channel_id, channel_name, case["Id"], case["CaseNumber"],
             "alerted", "", org, issue, now(), now()),
        )
        self._post_alert(channel_id, case, issue)
        return {"caseNumber": case["CaseNumber"], "channel": channel_name}

    def _create_channel(self, name: str) -> str:
        result = self.slack.api_call("conversations.create",
                                     {"name": name, "is_private": False})
        channel_id = ((result or {}).get("channel") or {}).get("id", "")
        if not channel_id:
            raise RuntimeError(f"channel create failed: {(result or {}).get('error')}")
        if self.po_user_ids:
            self.slack.api_call("conversations.invite",
                                {"channel": channel_id,
                                 "users": ",".join(self.po_user_ids)})
        return channel_id

    def _post_alert(self, channel_id: str, case: dict, issue: str) -> None:
        # Bob analyzes the case and proposes a solution, then buttons.
        fallback = ("Automate Success Plan creation on Closed Won with a record-triggered Flow."
                    if self.variant == "successplan" else
                    "Enforce Opportunity descriptions with a stage-gated Validation Rule.")

        def when_done(job: dict) -> None:
            proposal = (job.get("output") or "").strip() or fallback
            # Later beats (summary) carry this in their prompt: Bob's ACP session
            # is reaped after idle, so scripted steps must be self-contained.
            self.db.execute("UPDATE caseflow SET proposal=? WHERE channel_id=?",
                            (proposal, channel_id))
            shown = _slackify(proposal)
            self.slack.say(channel_id, None, shown[:3000], blocks=[
                {"type": "section", "text": {"type": "mrkdwn",
                 "text": shown[:2900]}},
                {"type": "section", "text": {"type": "mrkdwn", "text":
                 ":point_right: *Action:* Click *Approve solution* to continue — Bob will attach "
                 "a use-case summary to the case. Or click *Reject*."}},
                {"type": "actions", "elements": [
                    {"type": "button", "action_id": "hb_case_sol",
                     "style": "primary",
                     "text": {"type": "plain_text", "text": "Approve solution"},
                     "value": channel_id},
                    {"type": "button", "action_id": "hb_reject",
                     "style": "danger",
                     "text": {"type": "plain_text", "text": "Reject"},
                     "value": "reject"}]},
            ])
        self.slack.say(channel_id, None,
                       f":rotating_light: *New case from Salesforce: {case['CaseNumber']}* — "
                       f"{case['Subject']}\n_Bob is reading the case and drafting a proposal…_")
        self._run_bob(channel_id, self._proposal_prompt(case, issue), when_done)

    # -- button transitions ---------------------------------------------------

    def _advance(self, channel_id: str, from_state: str, to_state: str) -> dict | None:
        """Atomic check-and-advance; returns flow row or None if not in
        from_state (double click / wrong order)."""
        with self.db.connect() as conn:
            cursor = conn.execute(
                "UPDATE caseflow SET state=?, updated_at=? WHERE channel_id=? AND state=?",
                (to_state, now(), channel_id, from_state))
            if cursor.rowcount != 1:
                return None
            row = conn.execute("SELECT * FROM caseflow WHERE channel_id=?",
                               (channel_id,)).fetchone()
        return dict(row) if row else None

    def approve_solution(self, channel_id: str, clicker: str) -> None:
        flow = self._advance(channel_id, "alerted", "solution_approved")
        if flow is None:
            return
        self.slack.say(channel_id, None,
                       f"Solution approved by <@{clicker}> — drafting the "
                       "use-case summary for the case record…")

        def when_done(job: dict) -> None:
            summary = (job.get("output") or "").strip() or "Use-case summary unavailable."
            salesforce = self._sf(flow)
            try:
                salesforce.attach_to_case(
                    flow["case_id"], "Use-case summary (via Bob)", summary)
                try:
                    case_link = (f"{salesforce.get_instance_url()}"
                                 f"/lightning/r/Case/{flow['case_id']}/view")
                    see_it = (f"Click on the link to <{case_link}|see the use-case summary "
                              "on the case> in Salesforce.")
                except Exception:
                    see_it = ""
                if self.variant == "package":
                    self.slack.say(channel_id, None,
                                   f":page_facing_up: Use-case summary attached to case "
                                   f"*{flow['case_number']}* in Salesforce. {see_it}")
                    threading.Thread(target=self._build_package, args=(flow, channel_id),
                                     daemon=True).start()
                else:
                    self.slack.say(channel_id, None,
                                   f":page_facing_up: Use-case summary attached to case "
                                   f"*{flow['case_number']}* in Salesforce. {see_it}\n"
                                   ":point_right: *Action:* Type *@bob implement* (or *@bob "
                                   "implement the solution*) in this channel when you're ready.")
            except Exception as exc:
                try:
                    gone = salesforce.get_case_status(flow["case_id"]) is None
                except Exception:
                    gone = False
                if gone:
                    self._case_vanished(flow, "deleted")
                    return
                self.slack.say(channel_id, None,
                               f":warning: Couldn't attach summary: {exc}")
        self._run_bob(channel_id, self._summary_prompt(flow), when_done)

    def _rule_name(self, case_number: str) -> str:
        # Unique per flow so concurrent deployments never collide on
        # deploy or delete each other's rule at close.
        return f"{VALIDATION_RULE['rule_name']}_{case_number.lstrip('0') or case_number}"

    # "@bob implement" arrives as two Slack events (mention + message) within a
    # second; a later, separate request re-posts the gate so it never looks ignored.
    IMPLEMENT_REPROMPT_SECONDS = 15

    def wants_implement(self, channel_id: str, text: str, mentioned: bool) -> bool:
        """People won't type the exact phrase every time. Once the summary
        is attached, implementing is the only thing left for Bob to do — so any
        message addressed to Bob counts unless it's plainly a question, and an
        unaddressed message counts when it fuzzy-matches an implement-ish word
        (typos included). Only ever leads to the Approve-deploy gate."""
        row = self.db.one("SELECT state FROM caseflow WHERE channel_id=?", (channel_id,))
        if row is None or row["state"] != "solution_approved":
            return False
        lowered = text.lower().strip()
        if _is_asking_or_holding(lowered):
            return False  # "explain the solution first before implementing" → Bob answers
        return _implementish(lowered) or mentioned

    def chat_context(self, channel_id: str) -> str:
        """Prefix for free-form questions in a case channel: Bob's ACP session
        may have been reaped, so give it the case and its own proposal back,
        and keep it to answering — deployment stays behind the approval gate."""
        row = self.db.one("SELECT case_number, issue, proposal FROM caseflow WHERE channel_id=?",
                          (channel_id,))
        if row is None:
            return ""
        issue = row["issue"] or self._default_case()[1]
        return (f"Context — Salesforce case {row['case_number']}:\n{issue}\n\n"
                f"Your proposed solution for it:\n{row['proposal'] or '(not drafted yet)'}\n\n"
                "Answer the question below for the team in this channel: brief (max 120 words), "
                "plain text, no preamble, no markdown headers. Do not make changes or run tools — "
                "a human approves the deployment separately.\n\nQuestion: ")

    def request_implement(self, channel_id: str) -> bool:
        """Called when someone says 'implement' in a caseflow channel."""
        row = self.db.one("SELECT state, case_number, package FROM caseflow WHERE channel_id=?",
                          (channel_id,))
        if row is None or row["state"] != "solution_approved":
            return False
        if self.variant == "package":
            stage = (json.loads(row["package"] or "{}")).get("stage", "")
            if stage == "building":
                self.slack.say(channel_id, None, ":hammer_and_wrench: Still building and validating — "
                                                 "the deploy prompt appears as soon as the package validates.")
                return True
            if stage != "validated":
                flow = dict(self.db.one("SELECT * FROM caseflow WHERE channel_id=?", (channel_id,)))
                threading.Thread(target=self._build_package, args=(flow, channel_id), daemon=True).start()
                return True
        # "@bob implement" can arrive as two Slack events (mention + message);
        # post the approval prompt once per flow.
        key = (channel_id, row["case_number"])
        last = self._implement_prompted.get(key, 0.0)
        if time.time() - last < self.IMPLEMENT_REPROMPT_SECONDS:
            return True
        self._implement_prompted[key] = time.time()
        self.slack.say(channel_id, None, "Deploying a change to the org needs approval:",
                       blocks=[
            {"type": "section", "text": {"type": "mrkdwn", "text":
             self._implement_prompt(row['case_number']) +
             "\n:point_right: *Action:* Click *Approve deploy* to make the change, or *Reject*."}},
            {"type": "actions", "elements": [
                {"type": "button", "action_id": "hb_case_impl", "style": "primary",
                 "text": {"type": "plain_text", "text": "Approve deploy"},
                 "value": channel_id},
                {"type": "button", "action_id": "hb_reject", "style": "danger",
                 "text": {"type": "plain_text", "text": "Reject"}, "value": "reject"}]},
        ])
        return True

    def approve_implement(self, channel_id: str, clicker: str) -> None:
        flow = self._advance(channel_id, "solution_approved", "implemented")
        if flow is None:
            return
        self.slack.say(channel_id, None,
                       f"Deploy approved by <@{clicker}> — implementing…")
        if self.variant == "successplan":
            self._implement_successplan(flow, channel_id)
            return
        if self.variant == "package":
            self._implement_package(flow, channel_id)
            return
        rule_name = self._rule_name(flow["case_number"])
        salesforce = self._sf(flow)
        try:
            rule_id = salesforce.deploy_validation_rule(
                object_name=VALIDATION_RULE["object_name"], rule_name=rule_name,
                formula=VALIDATION_RULE["formula"],
                # Case-stamped so concurrent deployments' rules show as two
                # distinct fixes, not a duplicated message, on a blocked save.
                error_message=VALIDATION_RULE["error_message"].replace(
                    "[Deployed by Bob]",
                    f"[Deployed by Bob — case {flow['case_number']}]"))
            self.db.execute("UPDATE caseflow SET rule_id=?, updated_at=? WHERE channel_id=?",
                            (rule_id, now(), channel_id))
            try:
                base = salesforce.get_instance_url()
                rule_link = (f"{base}/lightning/setup/ObjectManager/Opportunity"
                             f"/ValidationRules/{rule_id}/view")
                opps_link = f"{base}/lightning/o/Opportunity/list"
                verify = (f"*Verify it yourself:*\n"
                          f"• <{rule_link}|View the rule in Setup>\n"
                          f"• *Test the deployed solution:* "
                          f"<{opps_link}|open the assigned "
                          "Opportunity> (the rule now guards every "
                          "Opportunity, so any will do), click *Edit*, change "
                          "*Stage* to `Negotiation/Review`, leave *Description* "
                          "empty, and click *Save* — Salesforce will block it "
                          "with this rule's error. Then click *Cancel* to "
                          "leave the record unchanged.")
            except Exception:
                verify = ("*Test the deployed solution:* open the "
                          "assigned Opportunity, click *Edit*, set *Stage* to "
                          "`Negotiation/Review` with *Description* empty and "
                          "click *Save* — the save is blocked. Click *Cancel* "
                          "after.")
            self.slack.say(channel_id, None,
                           f":white_check_mark: *Deployed:* `{rule_name}` is live "
                           f"on Opportunity.\n{verify}\nAll confirmed? Close the case?",
                           blocks=[
                {"type": "section", "text": {"type": "mrkdwn", "text":
                 f":white_check_mark: *Deployed:* `{rule_name}` is live on "
                 f"Opportunity.\n\n{verify}"}},
                {"type": "section", "text": {"type": "mrkdwn", "text":
                 "All confirmed? Close the case? Bob will notify the requester, "
                 "remove the rule, and tidy up."}},
                {"type": "actions", "elements": [
                    {"type": "button", "action_id": "hb_case_close", "style": "primary",
                     "text": {"type": "plain_text", "text": "Approve close"},
                     "value": channel_id},
                    {"type": "button", "action_id": "hb_keep_open",
                     "text": {"type": "plain_text", "text": "Keep open"}, "value": channel_id}]},
            ])
        except Exception as exc:
            # roll back state so retry is possible
            self.db.execute("UPDATE caseflow SET state='solution_approved', updated_at=?"
                            " WHERE channel_id=?", (now(), channel_id))
            self.slack.say(channel_id, None, f":warning: Deploy failed: {exc}")

    def approve_close(self, channel_id: str, clicker: str) -> None:
        flow = self._advance(channel_id, "implemented", "closed")
        if flow is None:
            return
        self.slack.say(channel_id, None,
                       f"Close approved by <@{clicker}> — wrapping up…")
        self._cleanup(flow, notify=True)

    # -- cleanup / reset ------------------------------------------------------

    def _cleanup(self, flow: dict, *, notify: bool) -> None:
        errors = []
        if notify and self.requester_email:
            subject, body = closure_email(
                flow["case_number"],
                self._fix_summary(flow))
            self.mailer.send(self.requester_email, subject, body)
        salesforce = self._sf(flow)
        for step, fn in (
            ("remove fix", lambda: self._remove_fix(flow, salesforce)),
            ("close case", lambda: salesforce.close_case(flow["case_id"])),
            ("delete case", lambda: salesforce.delete_case(flow["case_id"])),
        ):
            try:
                fn()
            except Exception as exc:
                errors.append(f"{step}: {exc}")
        try:
            self.slack.say(flow["channel_id"], None,
                           ":broom: Case resolved, requester notified, org "
                           "restored. This channel archives itself shortly — "
                           "thanks!")
            if notify and self.archive_delay:
                # Grace period so staff can read the wrap-up and navigate
                # away before Slack yanks focus out of the archived channel.
                time.sleep(self.archive_delay)
            self.slack.api_call("conversations.archive", {"channel": flow["channel_id"]})
        except Exception as exc:
            errors.append(f"archive: {exc}")
        if errors:
            LOGGER.warning("caseflow cleanup issues for %s: %s",
                           flow["case_number"], "; ".join(errors))
        self._maybe_respawn(flow)

    def _sweep_allowed_now(self) -> bool:
        """Quiet hours: outside the window an abandoned case just waits
        (no recycling, no channel-invite pings overnight); the first sweep of
        the morning replaces it with a fresh case."""
        if not self.sweep_hours:
            return True
        start, end = self.sweep_hours
        return start <= datetime.now(ZoneInfo("America/Los_Angeles")).hour < end

    def _liveness_check(self) -> None:
        """The orgs are shared with IDE users: if someone deletes or closes our
        live case out from under us, retire its channel and spawn a fresh case
        instead of leaving staff clicking buttons on a ghost."""
        for row in self.db.all("SELECT * FROM caseflow WHERE state != 'closed'"):
            flow = dict(row)
            try:
                status = self._sf(flow).get_case_status(flow["case_id"])
            except Exception as exc:
                LOGGER.warning("liveness: could not read case %s (%s)", flow["case_number"], exc)
                continue
            if status is None:
                self._case_vanished(flow, "deleted")
            elif status.get("IsClosed"):
                self._case_vanished(flow, "closed")

    def _case_vanished(self, flow: dict, how: str) -> None:
        with self.db.connect() as conn:
            cursor = conn.execute(
                "UPDATE caseflow SET state='closed', updated_at=? "
                "WHERE channel_id=? AND state != 'closed'", (now(), flow["channel_id"]))
            if cursor.rowcount != 1:
                return  # already closing through the normal path
        if self._channel_archived(flow["channel_id"]):
            # A newer pod already retired this flow (its startup reconcile
            # archives the channel, then deletes the case) — during a rollout
            # the old pod must not answer that with a second live case.
            LOGGER.info("case %s already retired elsewhere — not recycling", flow["case_number"])
            return
        LOGGER.warning("case %s was %s outside the demo — recycling", flow["case_number"], how)
        self.slack.say(flow["channel_id"], None,
                       f":warning: Case *{flow['case_number']}* was {how} in Salesforce outside "
                       "this demo. Retiring this channel — a fresh case is on its way in a new one.")
        self._cleanup(flow, notify=False)

    def _channel_archived(self, channel_id: str) -> bool:
        try:
            info = self.slack.api_call("conversations.info", {"channel": channel_id}) or {}
            return bool((info.get("channel") or {}).get("is_archived"))
        except Exception:
            return False

    def _org_has_other_open_case(self, org: int, own_case_id: str) -> bool:
        """True when a Bob-created demo case we don't own is open in the org —
        another pod (rollout overlap) is running the loop; don't double-spawn.
        Fails open: if the lookup breaks, the loop keeps going."""
        try:
            salesforce = self._sf(org)
            subjects = "', '".join((DEFAULT_CASE_SUBJECT, SUCCESSPLAN_CASE_SUBJECT))
            rows = salesforce._soql(
                f"SELECT Id FROM Case WHERE IsClosed = false AND Subject IN ('{subjects}') "
                f"AND CreatedBy.Username = '{salesforce.username}'")
            return any(r["Id"] != own_case_id for r in rows)
        except Exception:
            return False

    def _sweep_loop(self) -> None:
        while True:
            time.sleep(60)
            try:
                self._liveness_check()
            except Exception:
                LOGGER.exception("caseflow liveness check failed")
            if not self._sweep_allowed_now():
                continue
            try:
                cutoff_rows = self.db.all(
                    "SELECT * FROM caseflow WHERE state != 'closed'")
                for row in cutoff_rows:
                    flow = dict(row)
                    idle_min = self._minutes_since(flow["updated_at"])
                    if idle_min is not None and idle_min > self.idle_minutes:
                        LOGGER.info("sweeping abandoned caseflow %s", flow["case_number"])
                        self.db.execute(
                            "UPDATE caseflow SET state='closed', updated_at=? WHERE channel_id=?",
                            (now(), flow["channel_id"]))
                        self._cleanup(flow, notify=False)
            except Exception:
                LOGGER.exception("caseflow sweep failed")

    @staticmethod
    def _minutes_since(iso_ts: str) -> float | None:
        from datetime import UTC, datetime
        try:
            then = datetime.fromisoformat(iso_ts)
            return (datetime.now(UTC) - then).total_seconds() / 60.0
        except ValueError:
            return None

    # -- Bob invocation helper ------------------------------------------------

    def _run_bob(self, channel_id: str, prompt: str, when_done) -> None:
        def worker() -> None:
            try:
                job = self.jobs.submit(
                    self.slack.principal, prompt,
                    session_name=f"sl-{channel_id}"[:64],
                    # Bob's default (agent) mode. A custom orchestrator mode was
                    # tried at Dreamforce and sometimes answered with skill-chain
                    # routing instead of the requested proposal; plain Bob
                    # follows the format reliably and loads skills on its own.
                    mode=None,
                    timeout_seconds=self.slack.timeout_seconds,
                )
                deadline = time.monotonic() + self.slack.timeout_seconds + 60
                while time.monotonic() < deadline:
                    job = self.jobs.get(self.slack.principal.tenant, job["id"])
                    if job["state"] in ("completed", "failed", "cancelled"):
                        break
                    time.sleep(1.0)
                when_done(job)
            except Exception as exc:
                LOGGER.exception("caseflow bob run failed")
                self.slack.say(channel_id, None, f":warning: {exc}")
        threading.Thread(target=worker, daemon=True).start()


# ---------------------------------------------------------------------------
# v2 additions: variants, attract loop, reject
# ---------------------------------------------------------------------------

def _default_case(self) -> tuple[str, str]:
    if self.variant in ("successplan", "package"):
        return SUCCESSPLAN_CASE_SUBJECT, SUCCESSPLAN_CASE_BODY
    return DEFAULT_CASE_SUBJECT, DEFAULT_CASE_BODY


def _proposal_prompt(self, case: dict, issue: str) -> str:
    if self.variant == "package":
        return (
            "A new Salesforce case just arrived. Before proposing, look at the real org with the "
            "`salesforce-org` tools: `list_objects`, then `describe_object` for every object the "
            "request touches (and `list_flows` / `query` when useful). Apply the `sf-solution-advisor` "
            "skill to diagnose and the `sf-flow-developer` (or `sf-architect-apex`) skill to design a "
            "declarative-first fix you will later build as metadata. Only these metadata types can "
            f"be deployed: {', '.join(self.package_types)}. Reply with ONLY this structure, under 140 "
            "words:\n"
            "*The problem:* <one sentence>\n"
            "*Proposed fix:* <two or three sentences naming the concrete components you will build "
            "— object and field API names, Flow trigger and what it creates, any new field>\n"
            "*Why it matters:* <one sentence on the business impact>\n"
            "*Skills applied:* <the skills you used>\n"
            "Do NOT include workspace surveys, retrieval notes, routing plans, or any request to "
            f"reply — approval happens via buttons under your message. Case {case['CaseNumber']}: {issue}"
        )
    if self.variant == "successplan":
        return (
            "A new Salesforce case just arrived. Apply the `sf-solution-advisor` "
            "skill to diagnose the request and the `sf-flow-developer` skill to "
            "design the remediation (a record-triggered Flow plus any object "
            "metadata changes). Org context you must design against: a custom "
            "object `Success_Plan__c` already exists with fields Opportunity__c, "
            "Account__c, Account_Executive__c (User lookup — populate it from the "
            "Opportunity owner; this is the 'executive sponsor' the requester means), "
            "Success_Status__c (Draft/Active/At Risk/On Track/Completed), "
            "Renewal_Date__c, Account_Health__c, and text fields for business "
            "objective, expected outcome and success criteria. The fix is an "
            "after-save record-triggered Flow on Opportunity (when IsWon becomes "
            "true) that creates a Success_Plan__c populated with exactly: the "
            "Opportunity, the Account, Account Executive = the Opportunity owner, "
            "Status = Draft, and a NEW Date field for target go-live that the fix "
            "adds to Success_Plan__c and that the Flow populates with the close "
            "date (only the other fields stay empty for the success manager to "
            "complete); then a custom notification to the "
            "owner. Do not claim other fields are populated. Reply with ONLY this "
            "structure, under 120 words:\n"
            "*The problem:* <one sentence>\n"
            "*Proposed fix:* <two or three sentences naming the concrete Flow "
            "trigger, the record it creates, the fields it populates, and any new "
            "field on the object>\n"
            "*Why it matters:* <one sentence on the business impact>\n"
            "*Skills applied:* <the skills you used>\n"
            "Do NOT include workspace surveys, retrieval notes, routing plans, or "
            "any request to reply — approval happens via buttons under your "
            f"message. Case {case['CaseNumber']}: {issue}"
        )
    return (
        "A new Salesforce case just arrived. Act as the solution advisor "
        "and reply with ONLY this structure, under 100 words total:\n"
        "*The problem:* <one sentence>\n"
        "*Proposed fix:* <two sentences naming the concrete Salesforce "
        "change you would implement>\n"
        "*Why it matters:* <one sentence on the business impact>\n"
        "Do NOT include workspace surveys, retrieval notes, skill chains, "
        "routing plans, or any request to reply — approval happens via "
        "buttons shown under your message. Case "
        f"{case['CaseNumber']}: {issue}"
    )


def _summary_prompt(self, flow: dict) -> str:
    issue = flow.get("issue") or self._default_case()[1]
    proposal = flow.get("proposal") or ""
    return (
        f"Case {flow['case_number']} (Salesforce):\n{issue}\n\n"
        f"Approved solution proposal:\n{proposal or '(see case description)'}\n\n"
        "Using ONLY the information above, write a concise use-case summary for "
        "the case record with these sections: Problem, Affected users, Chosen "
        "approach, Acceptance criteria. Max 250 words, plain text, no questions, "
        "no preamble."
    )


def _implement_prompt(self, case_number: str) -> str:
    if self.variant == "package":
        row = self.db.one("SELECT package FROM caseflow WHERE case_number=?", (case_number,))
        info = json.loads((row["package"] if row else "") or "{}")
        lines = "\n".join(f"• `{c}`" for c in info.get("summary", [])) or "• (no components)"
        tests = info.get("tests_run", 0)
        return (":lock: *Approval needed* — deploy Bob's validated package to the org?\n"
                f"{lines}\n_Validated against the org"
                + (f", {tests} Apex test(s) passed" if tests else "") + "._")
    if self.variant == "successplan":
        art = SuccessPlanArtifact(self.salesforce)
        return (":lock: *Approval needed* — deploy the record-triggered Flow "
                f"`{art.flow_name(case_number)}` and add the new field "
                f"`{art.field_name(case_number)}` to Success Plan?")
    return (":lock: *Approval needed* — deploy Validation Rule "
            f"`{self._rule_name(case_number)}` to the org?")


def _fix_summary(self, flow: dict) -> str:
    if self.variant == "package":
        info = json.loads(flow.get("package") or "{}")
        return "Deployed components: " + (", ".join(info.get("summary", [])) or "none") + "."
    if self.variant == "successplan":
        art = SuccessPlanArtifact(self.salesforce)
        return (f"Flow {art.flow_name(flow['case_number'])} deployed: Success Plans are "
                "now created automatically when an Opportunity is won, with the "
                "account and account executive populated and the owner notified. "
                f"New field {art.field_name(flow['case_number'])} added.")
    return (f"Validation Rule {self._rule_name(flow['case_number'])} "
            "deployed and verified.")


def _implement_successplan(self, flow: dict, channel_id: str) -> None:
    salesforce = self._sf(flow)
    art = SuccessPlanArtifact(salesforce)
    try:
        info = art.deploy(flow["case_number"])
        self.db.execute("UPDATE caseflow SET rule_id=?, artifact=?, updated_at=? WHERE channel_id=?",
                        (info["flow_definition_id"], json.dumps(info), now(), channel_id))
        links = art.links(info, self.demo_opp_name)
        opp_link = links.get("opportunity") or links["opportunities"]
        opp_label = links.get("opportunity_name") or "the sample Opportunity"
        verify = (f":point_right: *Action:* Follow these steps to test the deployment (testing is "
                  "required before closing the case):\n"
                  f"*(1)* Click <{links['flow']}|this link> to view the Flow in Setup — "
                  f"you'll see `{info['flow']}` with status *Active*.\n"
                  "*(2)* Test the deployed solution:\n"
                  f"        a. Open <{opp_link}|{opp_label}>\n"
                  "        b. Click *Edit* (top right)\n"
                  "        c. Change *Stage* to `Closed Won`\n"
                  "        d. Click *Save*\n"
                  "The Flow fires instantly: a Success Plan is created and the :bell: "
                  "notification lights up (top right).\n"
                  "• I'll post a link to the new Success Plan here the moment it appears.")
        threading.Thread(target=self._watch_success_plan,
                         args=(channel_id, salesforce, info), daemon=True).start()
        self.slack.say(channel_id, None,
                       f":white_check_mark: *Deployed:* Flow `{info['flow']}` + field "
                       f"`{info['field']}`.\n{verify}",
                       blocks=[
            {"type": "section", "text": {"type": "mrkdwn", "text":
             f":white_check_mark: *Deployed:* Flow `{info['flow']}` is live and field "
             f"`{info['field']}` was added to Success Plan.\n\n{verify}"}}])
    except Exception as exc:
        self.db.execute("UPDATE caseflow SET state='solution_approved', updated_at=?"
                        " WHERE channel_id=?", (now(), channel_id))
        self.slack.say(channel_id, None, f":warning: Deploy failed: {exc}")


def _remove_fix(self, flow: dict, salesforce) -> None:
    if self.variant == "package":
        info = json.loads(flow.get("package") or "{}")
        snap = info.get("snapshot")
        if snap and info.get("stage") == "deployed":
            issues = package_artifact.rollback(MetadataApi(salesforce), salesforce, snap)
            if issues:
                raise RuntimeError("; ".join(issues))
        return
    if self.variant == "successplan":
        artifact = json.loads(flow.get("artifact") or "{}")
        if artifact or flow.get("rule_id"):
            errors = SuccessPlanArtifact(salesforce).cleanup(flow["case_number"], artifact or
                                                             {"deployed_at": "1970-01-01T00:00:00+00:00"},
                                                             self.demo_opp_name)
            if errors:
                raise RuntimeError("; ".join(errors))
        return
    if flow.get("rule_id"):
        salesforce.delete_validation_rule(flow["rule_id"])


def _watch_success_plan(self, channel_id: str, salesforce, info: dict, *, prompt_posted: bool = False) -> None:
    """After deploy: announce the auto-created Success Plan with a direct link.
    With prompt_posted the close prompt is already in the channel (package
    variant), so the announcement points back at it."""
    if not hasattr(salesforce, "_soql"):
        # No live org to watch (tests/fakes): offer the close prompt right away.
        if not prompt_posted:
            self._post_close_prompt(channel_id, ":white_check_mark: Deployment complete.")
        return
    art = SuccessPlanArtifact(salesforce)
    started = time.monotonic()
    failures = 0
    while time.monotonic() - started < 60 * 60:   # the idle sweep ends it before this
        row = self.db.one("SELECT state FROM caseflow WHERE channel_id=?", (channel_id,))
        if row is None or row["state"] == "closed":
            return
        try:
            created = art.created_since(info.get("deployed_at", ""))
            failures = 0
        except Exception:
            failures += 1
            if failures >= 3:       # no such object in this org, or no access: stop, don't spam the log
                LOGGER.warning("success plan watch stopped: the query keeps failing")
                return
            created = []
        if created:
            sp = created[0]
            field = f" and the new `{info['field']}` field" if info.get("field") else ""
            text = (f":tada: *It worked.* Success Plan <{art.record_link(sp['Id'])}|{sp['Name']}> "
                    f"was created automatically for *{sp['Opportunity__r']['Name']}* — account, "
                    f"account executive, status{field} all populated "
                    "by the Flow. *Our work for this case is complete.*")
            if prompt_posted:
                self.slack.say(channel_id, None, text + " Use *Approve close* above when ready.")
            else:
                self._post_close_prompt(channel_id, text)
            return
        time.sleep(4)


SLACK_SECTION_LIMIT = 3000      # characters per section block, enforced by Slack (invalid_blocks)


def _slack_excerpt(text: str, limit: int = 2500) -> str:
    """Bob's notes, trimmed to fit one Slack section block."""
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit("\n", 1)[0]
    return cut + "\n…"


def _post_close_prompt(self, channel_id: str, lead_text: str, extra_blocks: list | None = None) -> None:
    self.slack.say(channel_id, None,
                   f"{lead_text}\n:point_right: *Action:* Click *Approve close* to close the case.", blocks=[
        {"type": "section", "text": {"type": "mrkdwn", "text": lead_text}},
        *(extra_blocks or []),
        {"type": "section", "text": {"type": "mrkdwn", "text":
         ":point_right: *Action:* Click *Approve close* to close the case and notify the "
         "requester."}},
        {"type": "actions", "elements": [
            {"type": "button", "action_id": "hb_case_close", "style": "primary",
             "text": {"type": "plain_text", "text": "Approve close"}, "value": channel_id}]}])


def _case_owner_id(self, org: int, salesforce) -> str | None:
    if not self.case_owner_username or not hasattr(salesforce, "user_id_for"):
        return None
    if org not in self._owner_ids:
        try:
            self._owner_ids[org] = salesforce.user_id_for(self.case_owner_username)
        except Exception:
            LOGGER.exception("case owner lookup failed")
            self._owner_ids[org] = None
    return self._owner_ids[org]


def current_channel(self, org: int = 1) -> dict | None:
    """The case channel a kiosk visitor should be sent to (newest open flow)."""
    row = self.db.one("SELECT channel_id, channel_name FROM caseflow WHERE org=? "
                      "AND state != 'closed' ORDER BY created_at DESC LIMIT 1", (org,))
    if row is None:
        return None
    if not self.slack_team_id:
        try:
            self.slack_team_id = (self.slack.api_call("auth.test", {}) or {}).get("team_id", "")
        except Exception:
            LOGGER.exception("auth.test failed")
    url = (f"https://app.slack.com/client/{self.slack_team_id}/{row['channel_id']}"
           if self.slack_team_id else "")
    return {"channel": row["channel_name"], "url": url}


def is_flow_channel(self, channel_id: str) -> bool:
    return self.db.one("SELECT 1 FROM caseflow WHERE channel_id=?", (channel_id,)) is not None


def reject(self, channel_id: str, clicker: str) -> None:
    """Reject at any stage: close the case without a resolution email; the
    attract loop (if on) spawns the next case."""
    with self.db.connect() as conn:
        cur = conn.execute("UPDATE caseflow SET state='closed', updated_at=? "
                           "WHERE channel_id=? AND state != 'closed'", (now(), channel_id))
        if cur.rowcount != 1:
            return
        row = conn.execute("SELECT * FROM caseflow WHERE channel_id=?", (channel_id,)).fetchone()
    self.slack.say(channel_id, None, f"Rejected by <@{clicker}> — closing this case "
                                     "without changes and tidying up.")
    self._cleanup(dict(row), notify=False)


def spawn(self, org: int = 1) -> dict | None:
    """Attract loop: create the next self-running case for an org."""
    try:
        return self.start("", org=org)
    except Exception:
        LOGGER.exception("attract-loop spawn failed for org %s", org)
        return None


def _active_flow_for_org(self, org: int) -> bool:
    return self.db.one("SELECT 1 FROM caseflow WHERE org=? AND state != 'closed'",
                       (org,)) is not None


def _bootstrap_loop(self) -> None:
    time.sleep(5)
    pending: set[int] = set()
    for org in sorted(self.orgs):
        if not self._bootstrap_org(org):
            pending.add(org)
    # Salesforce (or Slack) may be down when the pod starts. Seen live on
    # seen live: the platform replaced a pod during a Salesforce outage, the
    # one-shot spawn got 503s, and the service stayed dark for six hours
    # until a manual restart. Keep trying until every org has a live case.
    while pending:
        time.sleep(self.bootstrap_retry_seconds)
        for org in sorted(pending):
            if self._bootstrap_org(org):
                pending.discard(org)


def _bootstrap_org(self, org: int) -> bool:
    """Reconcile leftovers, then make sure the org has a live case.
    Returns True when it does (nothing to retry)."""
    try:
        self._reconcile_orphans(org)
    except Exception:
        LOGGER.exception("attract loop: reconcile failed for org %s", org)
    if not self._active_flow_for_org(org):
        LOGGER.info("attract loop: bootstrapping org %s", org)
        self.spawn(org)
    ready = self._active_flow_for_org(org)
    if not ready:
        LOGGER.warning("attract loop: org %s has no live case yet — retrying in %ss",
                       org, self.bootstrap_retry_seconds)
    return ready


def _reconcile_orphans(self, org: int) -> None:
    """After a pod restart the local state is empty, but the org/workspace may
    still hold the previous live case (and its deployed Flow/field/records) and
    its channel. Clean anything this service created that it no longer tracks —
    conservatively: only OUR subjects, only OUR integration user, small counts."""
    salesforce = self._sf(org)
    known = {r["channel_id"] for r in self.db.all("SELECT channel_id FROM caseflow")}
    known_cases = {r["case_id"] for r in self.db.all("SELECT case_id FROM caseflow")}
    prefix = "case-" if org == 1 else f"case{org}-"
    orphan_channels = []
    try:
        channels, cursor = [], ""
        for _ in range(25):            # 25 pages × 200 — far more channels than a workspace holds
            args = {"types": "public_channel", "exclude_archived": True, "limit": 200}
            if cursor:
                args["cursor"] = cursor
            page = self.slack.api_call("conversations.list", args) or {}
            channels.extend(page.get("channels", []))
            cursor = (page.get("response_metadata") or {}).get("next_cursor", "")
            if not cursor:
                break
        orphan_channels = [c for c in channels
                           if c.get("name", "").startswith(prefix) and not c.get("is_archived")
                           and c["id"] not in known]
    except Exception:
        LOGGER.exception("reconcile: channel list failed")
    subjects = "', '".join((DEFAULT_CASE_SUBJECT, SUCCESSPLAN_CASE_SUBJECT))
    username = getattr(salesforce, "username", "")
    orphan_cases = []
    if username:
        orphan_cases = [c for c in salesforce._soql(
            f"SELECT Id, CaseNumber FROM Case WHERE IsClosed = false AND Subject IN ('{subjects}') "
            f"AND CreatedBy.Username = '{username}'") if c["Id"] not in known_cases]
    if len(orphan_channels) > 5 or len(orphan_cases) > 5:
        LOGGER.warning("reconcile: too many orphans (%d channels, %d cases) — not auto-cleaning",
                       len(orphan_channels), len(orphan_cases))
        return
    # Channels first: an archived channel is how a still-running previous pod
    # tells its vanished case apart from one an IDE user deleted.
    for ch in orphan_channels:
        LOGGER.info("reconcile: archiving orphan channel %s", ch.get("name"))
        try:
            self.slack.say(ch["id"], None, ":broom: This case is no longer active (the service "
                           "restarted) — a fresh one is on its way in a new channel.")
            self.slack.api_call("conversations.archive", {"channel": ch["id"]})
        except Exception:
            LOGGER.exception("reconcile: archive failed for %s", ch.get("id"))
    for c in orphan_cases:
        n = c["CaseNumber"]
        LOGGER.info("reconcile: cleaning orphan case %s", n)
        try:
            self._remove_fix({"case_number": n, "artifact": "", "rule_id": "x"}, salesforce)
        except Exception:
            LOGGER.exception("reconcile: fix removal failed for %s", n)
        try:
            salesforce.delete_case(c["Id"])
        except Exception:
            LOGGER.exception("reconcile: case delete failed for %s", n)


def _maybe_respawn(self, flow: dict) -> None:
    if not self.attract_loop:
        return
    org = int(flow.get("org") or 1)

    def later() -> None:
        time.sleep(self.loop_delay)
        if self._active_flow_for_org(org):
            return
        if self._org_has_other_open_case(org, flow.get("case_id", "")):
            LOGGER.warning("org %s already has a live demo case from another instance — not spawning", org)
            return
        self.spawn(org)
    threading.Thread(target=later, daemon=True).start()


# ---------------------------------------------------------------------------
# Package variant: Bob writes the change as metadata; the service validates,
# deploys and rolls back. docs/deployment-approaches.md, approach C.

SFDX_PROJECT = {"packageDirectories": [{"path": "force-app", "default": True}],
                "namespace": "", "sfdcLoginUrl": "https://login.salesforce.com", "sourceApiVersion": "60.0"}


def _workspace_for(self, channel_id: str) -> Path:
    session = self.slack._session_name(channel_id, None)
    return Path(self.jobs.runtime.prepare_workspace(self.slack.principal.tenant, session))


def _prepare_package_workspace(self, channel_id: str) -> Path:
    """An SFDX project Bob can build in, plus the org-context MCP server."""
    ws = self._workspace_for(channel_id)
    (ws / "force-app" / "main" / "default").mkdir(parents=True, exist_ok=True)
    project = ws / "sfdx-project.json"
    if not project.exists():
        project.write_text(json.dumps(SFDX_PROJECT, indent=2) + "\n")
    if self.mcp_url and self.mcp_token:
        cfg_path = ws / ".bob" / "mcp.json"
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            existing = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
        except ValueError:
            existing = {}
        servers = dict(existing.get("mcpServers") or {})
        servers.update(mcp_config(self.mcp_url, self.mcp_token)["mcpServers"])
        cfg_path.write_text(json.dumps({**existing, "mcpServers": servers}, indent=2) + "\n")
    return ws


def _package_info(self, channel_id: str) -> dict:
    row = self.db.one("SELECT package FROM caseflow WHERE channel_id=?", (channel_id,))
    return json.loads((row["package"] if row else "") or "{}")


def _set_package(self, channel_id: str, **fields) -> dict:
    info = {**self._package_info(channel_id), **fields}
    self.db.execute("UPDATE caseflow SET package=?, updated_at=? WHERE channel_id=?",
                    (json.dumps(info), now(), channel_id))
    return info


def _bob_turn(self, channel_id: str, prompt: str, timeout: int = 900) -> dict:
    """A write-approved Bob turn in the case's session, waited on synchronously."""
    job = self.jobs.submit(self.slack.principal, prompt,
                           session_name=self.slack._session_name(channel_id, None),
                           mode=None, timeout_seconds=min(timeout, 900))
    deadline = time.monotonic() + timeout + 60
    while time.monotonic() < deadline:
        job = self.jobs.get(self.slack.principal.tenant, job["id"])
        if job["state"] in ("completed", "failed", "cancelled"):
            return job
        time.sleep(1.0)
    return job


def _build_prompt(self, flow: dict) -> str:
    case = flow["case_number"].lstrip("0") or flow["case_number"]
    return (
        "The proposal was approved. Implement it now in this SFDX project (the current directory) as "
        "source-format metadata under force-app/main/default — nothing else:\n"
        "• flows/<Name>.flow-meta.xml for a Flow\n"
        "• objects/<Object>/fields/<Field__c>.field-meta.xml for a new custom field\n"
        "• objects/<Object>/validationRules/<Rule>.validationRule-meta.xml for a validation rule\n"
        "• classes/<Name>.cls plus <Name>.cls-meta.xml for Apex, always with an @isTest class covering it\n"
        "• labels/CustomLabels.labels-meta.xml for custom labels\n"
        f"Allowed metadata types: {', '.join(self.package_types)}. API version 60.0. Prefer declarative "
        "metadata (Flow, fields, validation rules); write Apex only when the proposal cannot be done "
        "declaratively. Do not explore beyond what the proposal needs: one describe per object you touch, "
        "then write the files. Set only fields the describe marks writable (an auto-number Name is set by "
        "Salesforce). If something the proposal relies on is missing from the org, leave that part "
        "out and say so in your reply. Make every new "
        f"component YOU CREATE unique by ending its name with _{case} (for example Create_Success_Plan_{case}, "
        f"Target_Go_Live_{case}__c). Confirm object and field API names with `describe_object` before "
        "referencing them; build against the org as it is. Before writing any file, load the "
        "`sf-metadata-reference` skill and read its file for each metadata type you write; copy the element "
        "order and shapes from its examples, they are validated. Do NOT deploy and do NOT run any sf command — "
        "the service validates and deploys your files after a human approves. When the files are "
        "written, reply in under 200 words, starting with the line 'Files written:', with: (1) the list of "
        "files you wrote, (2) a numbered manual test procedure (3–6 steps) a Salesforce admin follows in the "
        "UI to prove the change works. Never suffix or rename things that already exist in the org (a custom "
        "notification type, a record type, a queue): look them up by their real DeveloperName with `query` "
        "and reference that name.\n\n"
        f"Case {flow['case_number']}: {flow.get('issue') or ''}\n\nApproved proposal:\n{flow.get('proposal') or ''}"
    )


def _final_answer(reply: str) -> str:
    """Bob's build reply as posted to Slack: from its 'Files written' line on.
    Bob narrates between tool calls ("Now write the Flow..."); those chunks
    are part of the turn's text, and nobody testing the change needs them."""
    text = (reply or "").strip()
    matches = list(re.finditer(r"(?im)^[\s*#_-]*files written\b", text))
    return text[matches[-1].start():].lstrip("*#_- \n") if matches else text


def _fix_prompt(self, problems: list[str]) -> str:
    listing = "\n".join(f"- {p}" for p in problems[:12])
    return ("Salesforce rejected the package. Look up each failing element in the `sf-metadata-reference` "
            "skill (its error tables quote these messages) and fix the files in place (same paths under "
            "force-app/main/default), keeping the same component names, then reply with one line "
            f"saying what you changed. Do not deploy.\n\nValidation errors:\n{listing}")


def _build_package(self, flow: dict, channel_id: str) -> None:
    """Build turn → collect → validate (checkOnly) → fix loop → deploy gate."""
    self._set_package(channel_id, stage="building")
    ws = self._prepare_package_workspace(channel_id)
    salesforce = self._sf(flow)
    md = MetadataApi(salesforce)
    self.slack.say(channel_id, None, ":hammer_and_wrench: *Building the change.* Bob is writing the "
                                     "metadata for the approved solution; the service will validate it "
                                     "against the org before asking for the deploy approval.")
    job = self._bob_turn(channel_id, self._build_prompt(flow))
    notes = _final_answer(job.get("output") or "")
    if job.get("state") != "completed":
        self._set_package(channel_id, stage="failed", problems=[job.get("error") or "build turn failed"])
        self.slack.say(channel_id, None, f":warning: Build turn {job.get('state')}: {job.get('error') or 'no details'}. "
                                         "Type *@bob implement* to try again.")
        return
    problems: list[str] = []
    pkg = None
    result = None
    for attempt in range(self.package_fix_attempts + 1):
        pkg = package_artifact.collect(ws, self.package_types)
        problems = list(pkg.problems)
        if not problems:
            try:
                result = package_artifact.check(md, pkg)
                problems = [] if result.success else (result.problems() or ["validation failed"])
            except Exception as exc:       # the org or the network, not the package: not Bob's to fix
                problems = [f"validation call failed: {exc}"]
                break
        if not problems:
            break
        if attempt < self.package_fix_attempts:
            self.slack.say(channel_id, None,
                           f":mag: Validation found {len(problems)} problem(s) — Bob is fixing them "
                           f"(attempt {attempt + 1} of {self.package_fix_attempts}):\n"
                           + "\n".join(f"• {p[:200]}" for p in problems[:5]))
            fix = self._bob_turn(channel_id, self._fix_prompt(problems))
            if fix.get("state") != "completed":
                problems = [f"fix turn {fix.get('state')}: {fix.get('error') or ''}"]
                break
    if problems:
        self._set_package(channel_id, stage="failed", problems=problems, notes=notes)
        self.slack.say(channel_id, None,
                       ":x: *The package did not validate.* Nothing was deployed.\n"
                       + "\n".join(f"• {p[:300]}" for p in problems[:8])
                       + "\n:point_right: *Action:* Type *@bob implement* to have Bob try again, or *Reject*.")
        return
    tests_run = result.tests_run if result is not None else 0
    self._set_package(channel_id, stage="validated", members=pkg.members, summary=pkg.summary(),
                      sources=pkg.sources, apex_tests=pkg.apex_tests, tests_run=tests_run, notes=notes)
    lines = "\n".join(f"• `{c}`" for c in pkg.summary())
    self.slack.say(channel_id, None, "Package validated — deploying it needs approval:", blocks=[
        {"type": "section", "text": {"type": "mrkdwn", "text":
         f":white_check_mark: *Validated against the org.* Bob built {len(pkg.summary())} component(s)"
         + (f"; {tests_run} Apex test(s) passed" if tests_run else "") + f":\n{lines}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text":
         ":point_right: *Action:* Click *Approve deploy* to deploy exactly these components, or *Reject*."}},
        {"type": "actions", "elements": [
            {"type": "button", "action_id": "hb_case_impl", "style": "primary",
             "text": {"type": "plain_text", "text": "Approve deploy"}, "value": channel_id},
            {"type": "button", "action_id": "hb_reject", "style": "danger",
             "text": {"type": "plain_text", "text": "Reject"}, "value": "reject"}]},
    ])


def _setup_links(self, salesforce, members: dict) -> list[str]:
    """One Slack link per deployed component, straight to the component in
    Setup (Flow detail page, field page); list pages when an id lookup fails."""
    base = salesforce.get_instance_url()
    tooling = "/services/data/v60.0/tooling"
    links = []

    def rows(soql: str) -> list[dict]:
        try:
            return salesforce._get(f"{tooling}/query", q=soql).get("records", [])
        except Exception:
            return []

    for name in members.get("Flow", []):
        found = rows(f"SELECT Id FROM FlowDefinition WHERE DeveloperName = '{name}'")
        if found:
            links.append(f"<{base}/lightning/setup/Flows/page?address=%2F{found[0]['Id']}|Flow {name}>")
        else:
            links.append(f"<{base}/lightning/setup/Flows/home|Flows in Setup>")
    for member in members.get("CustomField", []):
        obj, _, field = member.partition(".")
        found = rows(f"SELECT Id FROM CustomField WHERE DeveloperName = '{field.removesuffix('__c')}'")
        page = f"{base}/lightning/setup/ObjectManager/{obj}/FieldsAndRelationships/"
        links.append(f"<{page}{found[0]['Id']}/view|Field {member}>" if found else f"<{page}view|{obj} fields>")
    for member in members.get("ValidationRule", []):
        obj = member.split(".")[0]
        links.append(f"<{base}/lightning/setup/ObjectManager/{obj}/ValidationRules/view|{obj} validation rules>")
    for name in members.get("ApexClass", []) + members.get("ApexTrigger", []):
        links.append(f"<{base}/lightning/setup/ApexClasses/home|Apex {name}>")
    if members.get("CustomLabel"):
        links.append(f"<{base}/lightning/setup/ExternalStrings/home|Custom labels>")
    return links


def _implement_package(self, flow: dict, channel_id: str) -> None:
    info = self._package_info(channel_id)
    if info.get("stage") != "validated":
        self.db.execute("UPDATE caseflow SET state='solution_approved', updated_at=? WHERE channel_id=?",
                        (now(), channel_id))
        self.slack.say(channel_id, None, ":warning: There is no validated package to deploy yet.")
        return
    ws = self._workspace_for(channel_id)
    salesforce = self._sf(flow)
    md = MetadataApi(salesforce)
    try:
        pkg = package_artifact.collect(ws, self.package_types)
        if pkg.problems:
            raise RuntimeError("; ".join(pkg.problems))
        snap = package_artifact.snapshot(md, pkg)
        result = package_artifact.deploy(md, pkg)
        if not result.success:
            raise RuntimeError("; ".join(result.problems()) or result.status)
        self._set_package(channel_id, stage="deployed", snapshot=snap, deploy_id=result.get("id", ""),
                          deployed_at=now())
        try:
            links = self._setup_links(salesforce, pkg.members)
        except Exception:
            links = []
        steps = _slack_excerpt(info.get("notes") or "")
        quick = ""
        if self.demo_opp_name and hasattr(salesforce, "_soql"):
            # The sample's story: the change fires when the demo deal is won. Give
            # the tester the record, and announce what the change created.
            try:
                base = salesforce.get_instance_url()
                deal = salesforce._soql(f"SELECT Id FROM Opportunity WHERE Name = '{self.demo_opp_name}' LIMIT 1")
                target = (f"{base}/lightning/r/Opportunity/{deal[0]['Id']}/view" if deal
                          else f"{base}/lightning/o/Opportunity/list")
                quick = (f":dart: *Quick test:* open <{target}|{self.demo_opp_name}>, set *Stage* to "
                         "`Closed Won` and save. I'll post a link to what the change created as soon as it appears.\n")
                threading.Thread(target=self._watch_success_plan, args=(channel_id, salesforce, {"deployed_at": now()}),
                                 kwargs={"prompt_posted": True}, daemon=True).start()
            except Exception:
                LOGGER.exception("quick-test link failed")
        text = (f":white_check_mark: *Deployed:* {len(pkg.summary())} component(s) are live in the org"
                + (":\n• " + "\n• ".join(links) if links else ".") + "\n" + quick
                + "When the test passes, close the case; the change is rolled back and the org restored.")
        extra = [{"type": "section", "text": {"type": "mrkdwn", "text": f":point_right: *Bob's test steps:*\n{steps}"}}] if steps else []
        self._post_close_prompt(channel_id, text, extra)
    except Exception as exc:
        self.db.execute("UPDATE caseflow SET state='solution_approved', updated_at=? WHERE channel_id=?",
                        (now(), channel_id))
        self.slack.say(channel_id, None, f":warning: Deploy failed: {exc}")


for _name, _fn in list(globals().items()):
    if callable(_fn) and _name in (
        "_default_case", "_proposal_prompt", "_implement_prompt", "_fix_summary",
        "_implement_successplan", "_remove_fix", "is_flow_channel",
        "reject", "spawn", "_active_flow_for_org", "_bootstrap_loop", "_bootstrap_org", "_maybe_respawn",
        "_watch_success_plan", "current_channel",
        "_post_close_prompt", "_case_owner_id", "_summary_prompt", "_reconcile_orphans",
        "_workspace_for", "_prepare_package_workspace", "_package_info", "_set_package", "_bob_turn",
        "_build_prompt", "_fix_prompt", "_build_package", "_setup_links", "_implement_package"):
        setattr(CaseFlow, _name, _fn)


_LABELS = ("The problem", "Proposed fix", "Why it matters", "Skills applied")


def _slackify(text: str) -> str:
    """Turn Bob's markdown proposal into Slack mrkdwn: single-asterisk bold and
    one bullet per labeled section, so it reads like a normal Slack message."""
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)          # **bold** → *bold*
    for label in _LABELS:
        # Each labeled section starts its own bullet line, even when Bob
        # runs the sections together on one line.
        text = re.sub(rf"\s*(?:•\s*)?\*?{label}:?\*?:?\s*", f"\n• *{label}:* ", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


IMPLEMENT_PATTERN = re.compile(r"\bimplement\b", re.I)
