"""Slack adapter: the reference partner integration.

Mapping:
- Each Slack thread (channel + thread_ts) ↔ one session → one native Bob
  conversation with memory.
- Mentions run READ-ONLY: Bob's edit/execute/fetch permission requests are refused.
- A mention starting with `!write` is the between-run approval gate: the
  adapter posts Approve/Reject buttons first; only an approving click starts
  the write-capable run. (Bob headless auto-approves its own tools — see
  spikes/findings.md — so the human gate lives here, before the run.)

Security: every inbound request is verified against Slack's signing secret
(HMAC v0 scheme, stale timestamps rejected). Replies are posted with the bot
token via chat.postMessage.
"""

import hashlib
import hmac
import re
import threading
import time
from typing import Any, Callable

import json
import logging

import httpx

from .auth import Principal
from .jobs import JobService, QuotaExceeded

_MENTION = re.compile(r"<@[A-Z0-9]+>")
_HEADER = re.compile(r"^#{1,3} +(.{3,80})$", re.M)

SLACK_TEXT_LIMIT = 3500


def extract_html_doc(text: str) -> str | None:
    """Return a complete HTML document found in `text`, or None."""
    lowered = text.lower()
    start = lowered.find("<!doctype html")
    if start < 0:
        start = lowered.find("<html")
    end = lowered.rfind("</html>")
    if start >= 0 and end > start and (end - start) > 400:
        return text[start:end + len("</html>")]
    return None


def verify_slack_signature(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    if not secret or not timestamp or not signature:
        return False
    try:
        if abs(time.time() - float(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = "v0=" + hmac.new(
        secret.encode(), f"v0:{timestamp}:".encode() + body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


log = logging.getLogger("headless_bob.slack")


class SlackAdapter:
    def __init__(
        self,
        jobs: JobService,
        *,
        bot_token: str,
        signing_secret: str,
        tenant: str = "slack",
        max_cost_per_run: float = 0.50,   # per conversation: one Bob session, cumulative over its turns
        max_cost_per_day: float = 5.0,    # per tenant, all conversations
        default_mode: str | None = None,
        timeout_seconds: int = 300,
        session_scope: str = "thread",  # "thread" | "channel" (channel mode:
                                        # whole channel = one conversation,
                                        # replies posted flat, not threaded)
        auto_join: bool = False,        # join every new public channel
        poster: Callable[[str, dict], Any] | None = None,
    ):
        self.jobs = jobs
        self.bot_token = bot_token
        self.signing_secret = signing_secret
        self.session_scope = session_scope
        self.default_mode = default_mode
        self.timeout_seconds = timeout_seconds
        self.principal = Principal(
            key_id="slack-adapter",
            tenant=tenant,
            label="slack",
            max_concurrent_jobs=10,
            max_cost_per_run=max_cost_per_run,
            max_cost_per_day=max_cost_per_day,
            allow_writes=True,  # writes still gated per-run below
        )
        self.auto_join = auto_join
        self.caseflow = None    # set by create_app when the case flow is enabled
        self._post = poster or self._post_slack
        self._seen_events: dict[str, float] = {}

    # -- outbound ------------------------------------------------------------

    def api_call(self, method: str, payload: dict) -> dict:
        """Slack Web API call that RETURNS the response (channel creation etc.).
        Form-encoded on purpose: Slack's read methods (conversations.list,
        conversations.info) silently IGNORE a JSON body — seen live
        day 2: `limit` and `exclude_archived` were dropped, so the startup
        reconcile only ever saw the oldest 100 channels and never archived the
        previous case's channel once a workspace passed 100 channels. Every
        Web API method accepts application/x-www-form-urlencoded.
        Overridable in tests."""
        form = {k: (str(v).lower() if isinstance(v, bool)
                    else ",".join(v) if isinstance(v, (list, tuple)) else v)
                for k, v in payload.items()}
        response = httpx.post(
            f"https://slack.com/api/{method}",
            data=form,
            headers={"Authorization": f"Bearer {self.bot_token}"},
            timeout=15,
        )
        return response.json()

    def _post_slack(self, method: str, payload: dict) -> None:
        response = httpx.post(
            f"https://slack.com/api/{method}",
            json=payload,
            headers={"Authorization": f"Bearer {self.bot_token}"},
            timeout=15,
        )
        try:
            body = response.json()
        except ValueError:
            body = {}
        if not body.get("ok"):
            # A message Slack refuses (invalid_blocks, msg_too_long, ...) must not
            # vanish silently: the case flow depends on these posts landing.
            log.error("slack %s refused: %s (channel %s, %d chars)", method,
                      body.get("error") or response.status_code, payload.get("channel"),
                      len(json.dumps(payload)))

    def say(self, channel: str, thread_ts: str | None, text: str, blocks: list | None = None) -> None:
        payload: dict[str, Any] = {"channel": channel, "text": text}
        if thread_ts:
            payload["thread_ts"] = thread_ts
        if blocks:
            payload["blocks"] = blocks
        self._post("chat.postMessage", payload)

    def upload_file(self, channel: str, thread_ts: str | None, filename: str, data: bytes) -> None:
        """Upload a file into the thread (Slack external-upload flow).

        Requires the files:write bot scope. Overridable in tests.
        """
        headers = {"Authorization": f"Bearer {self.bot_token}"}
        ticket = httpx.post(
            "https://slack.com/api/files.getUploadURLExternal",
            data={"filename": filename, "length": len(data)},
            headers=headers, timeout=15,
        ).json()
        if not ticket.get("ok"):
            self.say(channel, thread_ts,
                     f":paperclip: (couldn't attach `{filename}`: {ticket.get('error')})")
            return
        httpx.post(ticket["upload_url"], content=data, timeout=30)
        httpx.post(
            "https://slack.com/api/files.completeUploadExternal",
            json={"files": [{"id": ticket["file_id"], "title": filename}],
                  "channel_id": channel, **({"thread_ts": thread_ts} if thread_ts else {})},
            headers=headers, timeout=15,
        )

    # -- inbound: events -----------------------------------------------------

    def handle_event(self, envelope: dict) -> dict | None:
        """Returns a response body for Slack (url_verification) or None."""
        if envelope.get("type") == "url_verification":
            return {"challenge": envelope.get("challenge", "")}
        if envelope.get("type") != "event_callback":
            return None
        event = envelope.get("event") or {}
        if event.get("type") == "channel_created":
            # Optional: be present in every new public channel before anyone
            # has to invite the bot. (Private channels can't be auto-joined.)
            channel_id = (event.get("channel") or {}).get("id")
            if self.auto_join and channel_id:
                self._post("conversations.join", {"channel": channel_id})
            return None
        if event.get("bot_id") or event.get("subtype"):
            return None  # never react to bots (incl. ourselves) or edits
        if event.get("type") not in ("app_mention", "message"):
            return None

        # Slack retries deliveries; dedupe on event_id for ~15 minutes.
        event_id = envelope.get("event_id", "")
        now = time.time()
        self._seen_events = {k: t for k, t in self._seen_events.items() if now - t < 900}
        if event_id in self._seen_events:
            return None
        self._seen_events[event_id] = now

        text = _MENTION.sub("", event.get("text") or "").strip()
        channel = event.get("channel", "")
        thread_ts = event.get("thread_ts") or event.get("ts", "")
        if not text or not channel or not thread_ts:
            return None
        if self.session_scope == "channel":
            thread_ts = None  # reply flat; the channel itself is the session

        mentioned = (event.get("type") == "app_mention"
                     or bool(_MENTION.search(event.get("text") or "")))
        if self.caseflow is not None and self.caseflow.wants_implement(channel, text, mentioned):
            if self.caseflow.request_implement(channel):
                return None
        if text.lower().startswith("!write"):
            prompt = text[len("!write"):].strip()
            self._request_approval(channel, thread_ts, prompt)
        else:
            if self.caseflow is not None and self.caseflow.is_flow_channel(channel):
                text = self.caseflow.chat_context(channel) + text
            threading.Thread(
                target=self._converse, args=(channel, thread_ts, text, False), daemon=True
            ).start()
        return None

    # -- inbound: interactivity (button clicks) ------------------------------

    def handle_interaction(self, payload: dict) -> None:
        actions = payload.get("actions") or []
        if not actions:
            return
        action = actions[0]
        channel = (payload.get("channel") or {}).get("id", "")
        message = payload.get("message") or {}
        thread_ts = message.get("thread_ts") or message.get("ts", "")
        if self.session_scope == "channel":
            thread_ts = None
        clicker = (payload.get("user") or {}).get("id", "unknown")

        if action.get("action_id") == "hb_approve":
            prompt = action.get("value", "")
            self.say(channel, thread_ts, f"Approved by <@{clicker}> — running with write access…")
            threading.Thread(
                target=self._converse, args=(channel, thread_ts, prompt, True), daemon=True
            ).start()
        elif (action.get("action_id") in ("hb_case_sol", "hb_case_impl", "hb_case_close")
              and self.caseflow is not None and not self.caseflow.is_flow_channel(channel)):
            # The service no longer tracks this case (it restarted): point to the live one.
            current = None
            try:
                current = self.caseflow.current_channel(1)
            except Exception:
                pass
            where = (f" The live case is <{current['url']}|#{current['channel']}>."
                     if current and current.get("url") else " A fresh case is in the newest #case channel.")
            self.say(channel, thread_ts, ":warning: This case is no longer active (the service "
                                         f"restarted).{where}")
        elif action.get("action_id") in ("hb_case_sol", "hb_case_impl", "hb_case_close"):
            if self.caseflow is None:
                return
            target = action.get("value", "") or channel
            handler = {
                "hb_case_sol": self.caseflow.approve_solution,
                "hb_case_impl": self.caseflow.approve_implement,
                "hb_case_close": self.caseflow.approve_close,
            }[action["action_id"]]
            threading.Thread(target=handler, args=(target, clicker), daemon=True).start()
        elif action.get("action_id") == "hb_keep_open":
            self.say(channel, thread_ts,
                     f"Keeping this case open (<@{clicker}>). Click *Approve close* above "
                     "whenever you're ready to finish.")
        elif action.get("action_id") == "hb_reject":
            if self.caseflow is not None and self.caseflow.is_flow_channel(channel):
                threading.Thread(target=self.caseflow.reject, args=(channel, clicker),
                                 daemon=True).start()
            else:
                self.say(channel, thread_ts, f"Rejected by <@{clicker}> — nothing was run.")

    # -- internals -----------------------------------------------------------

    def _request_approval(self, channel: str, thread_ts: str | None, prompt: str) -> None:
        preview = prompt if len(prompt) <= 200 else prompt[:200] + "…"
        self.say(
            channel,
            thread_ts,
            f"Write-access run requested:\n> {preview}",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f":lock: *Approval needed* — Bob wants write access for:\n> {preview}",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "action_id": "hb_approve",
                            "style": "primary",
                            "text": {"type": "plain_text", "text": "Approve"},
                            "value": prompt,
                        },
                        {
                            "type": "button",
                            "action_id": "hb_reject",
                            "style": "danger",
                            "text": {"type": "plain_text", "text": "Reject"},
                            "value": "reject",
                        },
                    ],
                },
            ],
        )

    def _session_name(self, channel: str, thread_ts: str | None) -> str:
        if self.session_scope == "channel":
            return f"sl-{channel}"[:64]
        return f"sl-{channel}-{(thread_ts or '').replace('.', '-')}"[:64]

    def _converse(self, channel: str, thread_ts: str | None, prompt: str, allow_writes: bool) -> None:
        principal = self.principal if allow_writes else Principal(
            **{**self.principal.__dict__, "allow_writes": False}
        )
        if allow_writes:
            # Counteract history contamination: earlier read-only turns may
            # contain Bob stating it cannot write, which it otherwise believes.
            prompt = (
                "[Write access has been approved for this request; file and "
                "command tools are enabled regardless of earlier statements.]\n\n"
                + prompt
            )
        streamed: dict = {"text": "", "headers": []}

        def on_event(event: dict) -> None:
            if event.get("type") == "tool_event":
                title = event.get("title", "")
                if title and title not in streamed["headers"]:
                    streamed["headers"].append(title)
                    if len(streamed["headers"]) <= 8:
                        self.say(channel, thread_ts, f"⏳ _{title}…_")
                return
            if event.get("type") != "message" or event.get("role") != "assistant":
                return
            streamed["text"] += event.get("content", "")
            for match in _HEADER.finditer(streamed["text"]):
                if match.end() >= len(streamed["text"]):
                    continue  # header line still streaming — wait for it to finish
                header = match.group(1).strip().rstrip(":")
                if header not in streamed["headers"]:
                    streamed["headers"].append(header)
                    if len(streamed["headers"]) <= 6:  # cap the play-by-play
                        self.say(channel, thread_ts, f"⏳ _{header}…_")

        try:
            job = self.jobs.submit(
                principal, prompt,
                session_name=self._session_name(channel, thread_ts),
                mode=self.default_mode,
                timeout_seconds=self.timeout_seconds,
                progress=on_event,
            )
        except QuotaExceeded as exc:
            self.say(channel, thread_ts, f":hourglass: {exc}")
            return

        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            job = self.jobs.get(principal.tenant, job["id"])
            if job["state"] in ("completed", "failed", "cancelled"):
                break
            time.sleep(1.0)

        if job["state"] == "completed":
            reply = job["output"].strip() or "(Bob returned no text)"
            html_doc = extract_html_doc(reply)
            if html_doc:
                self.say(channel, thread_ts,
                         ":page_facing_up: Here's your one-pager — open or share the attached page.")
                self.upload_file(channel, thread_ts,
                                 f"bob-onepager-{int(time.time())}.html", html_doc.encode())
            elif len(reply) > SLACK_TEXT_LIMIT:
                summary = reply[:2900]
                cut = summary.rfind("\n")
                if cut > 2000:
                    summary = summary[:cut]
                self.say(channel, thread_ts,
                         summary + "\n\n:paperclip: _(full deliverable attached)_")
                self.upload_file(channel, thread_ts,
                                 f"bob-deliverable-{int(time.time())}.md", reply.encode())
            else:
                self.say(channel, thread_ts, reply)
            for rel_path in job.get("artifacts", []):
                try:
                    data = self.jobs.read_artifact(principal.tenant, job["id"], rel_path)
                except (KeyError, ValueError, OSError) as exc:
                    self.say(channel, thread_ts,
                             f":paperclip: (couldn't attach `{rel_path}`: {exc})")
                    continue
                self.upload_file(channel, thread_ts, rel_path.replace("/", "_"), data)
        else:
            self.say(
                channel, thread_ts,
                f":warning: Bob run {job['state']}: {job['error'][:300] or 'no details'}",
            )
