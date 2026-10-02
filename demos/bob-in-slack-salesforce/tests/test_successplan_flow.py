"""Success Plan flow tests: attract loop, three approvals, real-looking
Salesforce changes faked at the artifact boundary, close, respawn."""

import base64
import hashlib
import hmac
import json
from pathlib import Path
import shlex
import sys
import time
from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from headless_bob.api import Settings, create_app  # noqa: E402
import headless_bob.caseflow as caseflow_mod  # noqa: E402

FAKE_BOB = f"{shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).parent / 'fake_bob_acp.py'))}"
SECRET = "test-signing-secret"


def sign(body: bytes) -> dict:
    ts = str(int(time.time()))
    sig = "v0=" + hmac.new(SECRET.encode(), f"v0:{ts}:".encode() + body, hashlib.sha256).hexdigest()
    return {"X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig}


class FakeSF:
    def __init__(self):
        self.cases, self.attached, self.closed, self.deleted = {}, [], [], []
        self._n = 2000

    def create_case(self, subject, description, supplied_email="", **kw):
        self._n += 1
        case = {"Id": f"500{self._n}", "CaseNumber": f"{self._n:08d}", "Subject": subject,
                "Description": description}
        self.cases[case["Id"]] = case
        return case

    def attach_to_case(self, case_id, title, body):
        if case_id not in self.cases:
            raise RuntimeError("404 ENTITY_IS_DELETED")
        self.attached.append((case_id, title))
    def get_case_status(self, case_id):
        if case_id not in self.cases:
            return None
        return {"Id": case_id, "IsClosed": case_id in self.closed, "IsDeleted": False}
    def get_instance_url(self): return "https://sf.example"
    def close_case(self, case_id): self.closed.append(case_id)
    def delete_case(self, case_id): self.deleted.append(case_id)


class FakeArtifact:
    """Stands in for SuccessPlanArtifact — records deploy/cleanup calls."""
    deployed, cleaned = [], []

    def __init__(self, client): self.client = client
    def field_name(self, n): return f"Target_Go_Live_{n.lstrip('0')}__c"
    def flow_name(self, n): return f"Create_Success_Plan_{n.lstrip('0')}"

    def deploy(self, case_number):
        info = {"field": self.field_name(case_number), "flow": self.flow_name(case_number),
                "flow_definition_id": "300FAKE", "deployed_at": "2026-01-01T00:00:00+00:00"}
        FakeArtifact.deployed.append(case_number)
        return info

    def links(self, info, opp_name=None):
        return {"flow": "https://sf.example/flow", "success_plans": "https://sf.example/sp",
                "opportunities": "https://sf.example/opps", "opportunity": "https://sf.example/opp1",
                "opportunity_name": opp_name}

    def cleanup(self, case_number, artifact, opp_name=None):
        FakeArtifact.cleaned.append((case_number, artifact.get("flow")))
        return []


class FakeMailer:
    configured = True
    def __init__(self): self.sent = []
    def send(self, to, subject, body, attachments=None):
        self.sent.append((to, subject, attachments or []))
        return True


@pytest.fixture()
def v2(tmp_path, monkeypatch):
    for k, v in {"HB_ROOT": str(tmp_path / "ws"), "HB_DB": str(tmp_path / "hb.db"),
                 "HB_BOB_BIN": FAKE_BOB, "HB_WORKERS": "2", "HB_SLACK_BOT_TOKEN": "xoxb-test",
                 "HB_SLACK_SIGNING_SECRET": SECRET, "HB_SLACK_SESSION_SCOPE": "channel",
                 "HB_SF_LOGIN_URL": "https://login.example", "HB_SF_CLIENT_ID": "3MVGfake",
                 "HB_SF_USERNAME": "demo@example.com",
                 "HB_SF_PRIVATE_KEY_B64": base64.b64encode(b"fake").decode(),
                 "HB_ARCHIVE_DELAY_SECONDS": "0", "HB_FLOW_VARIANT": "successplan",
                 "HB_CASE_REQUESTER_EMAIL": "requester@example.com",
                 "HB_ATTRACT_LOOP": "1", "HB_LOOP_DELAY_SECONDS": "1"}.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setattr(caseflow_mod, "SuccessPlanArtifact", FakeArtifact)
    FakeArtifact.deployed.clear(); FakeArtifact.cleaned.clear()
    app = create_app(Settings())
    posted, api_calls = [], []
    fake_sf, fake_mail = FakeSF(), FakeMailer()
    counter = {"n": 0}

    def fake_api(method, payload):
        api_calls.append((method, payload))
        if method == "conversations.create":
            counter["n"] += 1
            return {"ok": True, "channel": {"id": f"C0CASE{counter['n']}"}}
        return {"ok": True}
    with TestClient(app) as client:
        slack, flow = app.state.slack, app.state.caseflow
        slack._post = lambda method, payload: posted.append((method, payload))
        slack.api_call = fake_api
        slack.salesforce = fake_sf; flow.salesforce = fake_sf; flow.orgs[1] = fake_sf
        flow.mailer = fake_mail
        yield client, flow, fake_sf, fake_mail, posted, api_calls


def wait_until(pred, timeout=60.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if pred():
            return True
        time.sleep(0.05)
    return False


def blocks_with(posted, text):
    return [p for p in posted if text in json.dumps(p[1].get("blocks", []))]


def click(client, action_id, channel):
    payload = {"type": "block_actions", "user": {"id": "U42"}, "channel": {"id": channel},
               "message": {"ts": "1.0"}, "actions": [{"action_id": action_id, "value": channel}]}
    form = urlencode({"payload": json.dumps(payload)}).encode()
    client.post("/slack/interactivity", content=form, headers=sign(form))


def say(client, text, channel, event_id):
    body = json.dumps({"type": "event_callback", "event_id": event_id,
                       "event": {"type": "app_mention", "text": text, "channel": channel,
                                 "ts": "9.9"}}).encode()
    client.post("/slack/events", content=body, headers=sign(body))


def test_attract_loop_bootstraps_and_uses_successplan_case(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: sf.cases, timeout=30)        # spawned with no kiosk input
    case = list(sf.cases.values())[0]
    assert case["Subject"] == "Success Plan Updates"
    assert "Executive Sponsor" in case["Description"]
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))


def test_successplan_full_cycle_then_respawn(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))
    ch = "C0CASE1"
    click(client, "hb_case_sol", ch)
    assert wait_until(lambda: sf.attached)
    say(client, "<@U0BOT> implement", ch, "Ev-i1")
    assert wait_until(lambda: blocks_with(posted, "Approve deploy"))
    impl_prompt = blocks_with(posted, "Approve deploy")[0][1]
    assert "Create_Success_Plan_2001" in json.dumps(impl_prompt)   # variant prompt
    click(client, "hb_case_impl", ch)
    assert wait_until(lambda: FakeArtifact.deployed == ["00002001"])
    assert wait_until(lambda: blocks_with(posted, "Closed Won"))   # verify instructions
    assert "Approve close" not in json.dumps(blocks_with(posted, "Closed Won")[0][1])
    assert wait_until(lambda: blocks_with(posted, "Approve close"))  # close prompt comes after
    row = flow.db.one("SELECT artifact FROM caseflow WHERE channel_id=?", (ch,))
    assert json.loads(row["artifact"])["flow"] == "Create_Success_Plan_2001"
    click(client, "hb_case_close", ch)
    assert wait_until(lambda: FakeArtifact.cleaned)
    assert FakeArtifact.cleaned[0] == ("00002001", "Create_Success_Plan_2001")
    closure = [m for m in mail.sent if "resolved" in m[1]]
    assert closure and "Flow Create_Success_Plan_2001" in closure[0][1] or closure
    # attract loop: a new case spawns shortly after close
    assert wait_until(lambda: len(sf.cases) >= 2, timeout=30)
    assert ("conversations.archive", {"channel": ch}) in [(m, p) for m, p in api_calls]


def test_kiosk_current_channel_link(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: sf.cases, timeout=30)
    flow.slack_team_id = "T0TEST"
    cur = client.get("/demo/current").json()
    assert cur["channel"].startswith("case-") and cur["url"] == "https://app.slack.com/client/T0TEST/C0CASE1"


def test_reject_closes_without_email_and_respawns(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))
    before = len(mail.sent)
    click(client, "hb_reject", "C0CASE1")
    assert wait_until(lambda: sf.deleted)                  # case cleaned up
    assert not [m for m in mail.sent[before:] if "resolved" in m[1]]   # no closure email
    assert wait_until(lambda: len(sf.cases) >= 2, timeout=30)          # loop continues


def test_defaults_without_flags(tmp_path, monkeypatch):
    for k, v in {"HB_ROOT": str(tmp_path / "ws"), "HB_DB": str(tmp_path / "hb.db"),
                 "HB_BOB_BIN": FAKE_BOB, "HB_SLACK_BOT_TOKEN": "xoxb-test",
                 "HB_SLACK_SIGNING_SECRET": SECRET, "HB_SF_LOGIN_URL": "https://login.example",
                 "HB_SF_CLIENT_ID": "3MVGfake", "HB_SF_USERNAME": "demo@example.com",
                 "HB_SF_PRIVATE_KEY_B64": base64.b64encode(b"fake").decode()}.items():
        monkeypatch.setenv(k, v)
    app = create_app(Settings())
    with TestClient(app) as client:
        flow = app.state.caseflow
        assert flow.variant == "successplan" and not flow.attract_loop   # sample defaults
        assert "textarea" in client.get("/demo").text        # trigger page served


def test_keep_open_handler_is_noop(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))
    click(client, "hb_keep_open", "C0CASE1")
    assert wait_until(lambda: any("Keeping this case open" in p[1].get("text", "") for p in posted))
    assert not sf.deleted                                   # case untouched
    assert flow.db.one("SELECT state FROM caseflow WHERE channel_id='C0CASE1'")["state"] != "closed"


def test_stale_click_points_to_live_case(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: sf.cases, timeout=30)
    flow.slack_team_id = "T0TEST"
    click(client, "hb_case_sol", "C0OLDCASE")           # channel the service never created
    assert wait_until(lambda: any("no longer active" in p[1].get("text", "") for p in posted))
    stale = [p for p in posted if "no longer active" in p[1].get("text", "")][0][1]
    assert "C0CASE1" in stale["text"] and not sf.attached   # points at the live case, did nothing else


def test_reconcile_cleans_orphans_on_bootstrap(tmp_path, monkeypatch):
    """A restart leaves an untracked case + channel behind; bootstrap cleans them, then spawns."""
    import headless_bob.caseflow as cf
    monkeypatch.setattr(cf, "SuccessPlanArtifact", FakeArtifact); FakeArtifact.cleaned.clear()
    for k, v in {"HB_ROOT": str(tmp_path / "ws"), "HB_DB": str(tmp_path / "hb.db"), "HB_BOB_BIN": FAKE_BOB,
                 "HB_SLACK_BOT_TOKEN": "xoxb-test", "HB_SLACK_SIGNING_SECRET": SECRET,
                 "HB_SF_LOGIN_URL": "https://login.example", "HB_SF_CLIENT_ID": "3MVGfake",
                 "HB_SF_USERNAME": "bob@example.com", "HB_SF_PRIVATE_KEY_B64": base64.b64encode(b"fake").decode(),
                 "HB_FLOW_VARIANT": "successplan", "HB_ATTRACT_LOOP": "1", "HB_ARCHIVE_DELAY_SECONDS": "0"}.items():
        monkeypatch.setenv(k, v)
    app = create_app(Settings())
    sf = FakeSF(); sf.username = "bob@example.com"
    orphan = sf.create_case("Success Plan Updates", "leftover")            # untracked, from "before the restart"
    sf._soql = lambda q: [{"Id": orphan["Id"], "CaseNumber": orphan["CaseNumber"]}] if "IsClosed = false" in q else []
    api_calls, posted = [], []
    def fake_api(method, payload):
        api_calls.append((method, payload))
        if method == "conversations.list":
            # Two pages: the live channel is never on the first one once a
            # workspace holds more than one page of (mostly archived) channels.
            if not payload.get("cursor"):
                return {"ok": True, "channels": [{"id": "C0GEN", "name": "general", "is_archived": False},
                                                 {"id": "C0ARC", "name": "case-1001", "is_archived": True}],
                        "response_metadata": {"next_cursor": "page2"}}
            return {"ok": True, "channels": [{"id": "C0OLD", "name": "case-1999", "is_archived": False}],
                    "response_metadata": {"next_cursor": ""}}
        if method == "conversations.create":
            return {"ok": True, "channel": {"id": "C0NEW"}}
        return {"ok": True}
    with TestClient(app) as client:
        slack, flow = app.state.slack, app.state.caseflow
        slack._post = lambda m, p: posted.append((m, p)); slack.api_call = fake_api
        slack.salesforce = sf; flow.salesforce = sf; flow.orgs[1] = sf; flow.mailer = FakeMailer()
        assert wait_until(lambda: ("conversations.archive", {"channel": "C0OLD"}) in api_calls, timeout=30)
        assert ("conversations.archive", {"channel": "C0ARC"}) not in api_calls   # archived stays untouched
        assert ("conversations.archive", {"channel": "C0GEN"}) not in api_calls   # not ours
        pages = [p for m, p in api_calls if m == "conversations.list"]
        assert pages[0].get("cursor") is None and pages[1]["cursor"] == "page2"
        assert orphan["Id"] in sf.deleted                                   # orphan case removed
        assert FakeArtifact.cleaned and FakeArtifact.cleaned[0][0] == orphan["CaseNumber"]
        assert wait_until(lambda: len(sf.cases) >= 2, timeout=30)           # then a fresh case spawned


def test_sweep_quiet_hours(v2, monkeypatch):
    """Sweep only recycles inside HB_SWEEP_HOURS (PT); outside, idle cases wait."""
    import headless_bob.caseflow as cf
    from datetime import datetime as real_dt
    client, flow, *_ = v2

    class At(real_dt):
        hour_now = 3
        @classmethod
        def now(cls, tz=None):
            return real_dt(2026, 10, 14, cls.hour_now, 30, tzinfo=tz)
    monkeypatch.setattr(cf, "datetime", At)

    flow.sweep_hours = None
    assert flow._sweep_allowed_now()                    # unset = always
    flow.sweep_hours = (7, 19)
    for hour, allowed in ((3, False), (6, False), (7, True), (12, True), (18, True), (19, False), (23, False)):
        At.hour_now = hour
        assert flow._sweep_allowed_now() is allowed, hour


def test_sweep_hours_setting_parsed(monkeypatch):
    monkeypatch.setenv("HB_SWEEP_HOURS", "7-19")
    assert Settings().sweep_hours == (7, 19)
    monkeypatch.delenv("HB_SWEEP_HOURS")
    assert Settings().sweep_hours is None


def say_plain(client, text, channel, event_id):
    """A message in the channel that does NOT mention the bot."""
    body = json.dumps({"type": "event_callback", "event_id": event_id,
                       "event": {"type": "message", "text": text, "channel": channel,
                                 "user": "U42", "ts": "9.9"}}).encode()
    client.post("/slack/events", content=body, headers=sign(body))


def test_implementish_phrases():
    from headless_bob.caseflow import _implementish
    for text in ("implement", "implment what you just pitched", "impelement it", "implementation please",
                 "deploy it", "deply the flow", "go ahead", "let's go", "ship it", "please proceed",
                 "ok do it", "build it now"):
        assert _implementish(text), text
    for text in ("hi", "what is a success plan", "thanks bob", "important question", "hello there"):
        assert not _implementish(text), text


def test_flexible_implement_trigger(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    # before the solution is approved, no phrasing triggers the deploy gate
    say(client, "<@U0BOT> implement", "C0CASE1", "Ev-early")
    time.sleep(0.5)
    assert not blocks_with(posted, "Approve deploy")
    click(client, "hb_case_sol", "C0CASE1")
    assert wait_until(lambda: sf.attached, timeout=30)
    # asking or holding is not a go-ahead — even when the sentence contains "implementing"
    say(client, "<@U0BOT> what does the flow do?", "C0CASE1", "Ev-q")
    say(client, "<@U0BOT> can you explain more before implementing?", "C0CASE1", "Ev-q2")
    say(client, "<@U0BOT> explain the solution first before implementing", "C0CASE1", "Ev-q3")
    time.sleep(0.5)
    assert not blocks_with(posted, "Approve deploy")
    for text in ("can you explain more before implementing?", "explain the solution first before implementing",
                 "tell me more about the flow", "what would the flow do", "not yet", "wait", "don't implement"):
        assert not flow.wants_implement("C0CASE1", text, True), text
    for text in ("implment what you just pitched", "go ahead and implement what you explained", "yes",
                 "implmenet", "deploy it", "do it", "ok looks good"):
        assert flow.wants_implement("C0CASE1", text, True), text
    ctx = flow.chat_context("C0CASE1")                       # questions carry the case context
    assert "Salesforce case" in ctx and "Do not make changes" in ctx and ctx.endswith("Question: ")
    # a typo'd, free-form go-ahead is
    say(client, "<@U0BOT> implment what you just pitched", "C0CASE1", "Ev-typo")
    assert wait_until(lambda: blocks_with(posted, "Approve deploy"), timeout=10)
    # asking again later re-posts the gate (only the mention+message double event is deduped)
    flow.IMPLEMENT_REPROMPT_SECONDS = 0.2
    time.sleep(0.3)
    say(client, "<@U0BOT> implmenet", "C0CASE1", "Ev-again")
    assert wait_until(lambda: len(blocks_with(posted, "Approve deploy")) == 2, timeout=10)


def test_plain_go_ahead_without_mention(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    click(client, "hb_case_sol", "C0CASE1")
    assert wait_until(lambda: sf.attached, timeout=30)
    say_plain(client, "sounds great, deply it", "C0CASE1", "Ev-plain")
    assert wait_until(lambda: blocks_with(posted, "Approve deploy"), timeout=10)


def test_case_deleted_externally_is_recycled(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    case_id = list(sf.cases)[0]
    del sf.cases[case_id]                                    # an IDE user deleted it
    flow._liveness_check()
    assert flow.db.one("SELECT state FROM caseflow WHERE channel_id='C0CASE1'")["state"] == "closed"
    assert any("was deleted in Salesforce" in p[1].get("text", "") for p in posted)
    assert ("conversations.archive", {"channel": "C0CASE1"}) in api_calls
    assert wait_until(lambda: len(sf.cases) == 1, timeout=30)   # fresh case spawned
    assert flow._active_flow_for_org(1)


def test_vanished_case_with_archived_channel_is_not_recycled(v2):
    """Rollout overlap: the new pod archived our channel and deleted our case —
    the old pod must just let go, not spawn a competing case."""
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    case_id = list(sf.cases)[0]
    del sf.cases[case_id]
    real_api = flow.slack.api_call
    flow.slack.api_call = lambda m, p: ({"ok": True, "channel": {"is_archived": True}}
                                       if m == "conversations.info" else real_api(m, p))
    flow._liveness_check()
    assert flow.db.one("SELECT state FROM caseflow WHERE channel_id='C0CASE1'")["state"] == "closed"
    time.sleep(1.5)                                          # past loop_delay
    assert not sf.cases and not any("was deleted" in p[1].get("text", "") for p in posted)


def test_respawn_yields_to_another_instances_case(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    case_id = list(sf.cases)[0]
    sf.username = "demo@example.com"
    sf._soql = lambda q: [{"Id": "500OTHER"}]                # someone else's live demo case
    click(client, "hb_reject", "C0CASE1")
    assert wait_until(lambda: case_id in sf.deleted, timeout=30)
    time.sleep(1.5)
    assert len(sf.cases) == 1 and not flow._active_flow_for_org(1)   # no second case spawned


def test_case_closed_externally_is_recycled(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    case_id = list(sf.cases)[0]
    sf.closed.append(case_id)                                # closed by hand in Salesforce
    flow._liveness_check()
    assert any("was closed in Salesforce" in p[1].get("text", "") for p in posted)
    assert wait_until(lambda: len(sf.cases) == 2, timeout=30)   # fresh case spawned


def test_summary_on_deleted_case_recycles(v2):
    client, flow, sf, mail, posted, api_calls = v2
    assert wait_until(lambda: blocks_with(posted, "Approve solution"), timeout=30)
    case_id = list(sf.cases)[0]
    del sf.cases[case_id]
    click(client, "hb_case_sol", "C0CASE1")                  # attach fails → recycle, not a bare error
    assert wait_until(lambda: any("was deleted in Salesforce" in p[1].get("text", "") for p in posted), timeout=30)
    assert not any("Couldn't attach" in p[1].get("text", "") for p in posted)
    assert wait_until(lambda: len(sf.cases) == 1, timeout=30)


def test_bootstrap_retries_until_salesforce_is_back(tmp_path, monkeypatch):
    """Pod starts while the org answers 503 (seen live): the first spawn fails,
    but the loop keeps retrying and the service comes up once the org recovers."""
    import headless_bob.caseflow as cf
    monkeypatch.setattr(cf, "SuccessPlanArtifact", FakeArtifact); FakeArtifact.cleaned.clear()
    for k, v in {"HB_ROOT": str(tmp_path / "ws"), "HB_DB": str(tmp_path / "hb.db"), "HB_BOB_BIN": FAKE_BOB,
                 "HB_SLACK_BOT_TOKEN": "xoxb-test", "HB_SLACK_SIGNING_SECRET": SECRET,
                 "HB_SF_LOGIN_URL": "https://login.example", "HB_SF_CLIENT_ID": "3MVGfake",
                 "HB_SF_USERNAME": "bob@example.com", "HB_SF_PRIVATE_KEY_B64": base64.b64encode(b"fake").decode(),
                 "HB_FLOW_VARIANT": "successplan", "HB_ATTRACT_LOOP": "1", "HB_ARCHIVE_DELAY_SECONDS": "0"}.items():
        monkeypatch.setenv(k, v)
    app = create_app(Settings())
    sf = FakeSF(); sf.username = "bob@example.com"
    orphan = sf.create_case("Success Plan Updates", "leftover")      # untracked case from before the restart
    outage = {"down": True, "attempts": 0}

    def flaky(fn):
        def wrapped(*a, **kw):
            if outage["down"]:
                outage["attempts"] += 1
                raise RuntimeError("503 We are down")
            return fn(*a, **kw)
        return wrapped
    sf.create_case = flaky(sf.create_case)
    sf.delete_case = flaky(sf.delete_case)
    sf._soql = flaky(lambda q: [{"Id": orphan["Id"], "CaseNumber": orphan["CaseNumber"]}]
                     if "IsClosed = false" in q and orphan["Id"] not in sf.deleted else [])
    api_calls, posted = [], []

    def fake_api(method, payload):
        api_calls.append((method, payload))
        if method == "conversations.list":
            return {"ok": True, "channels": [{"id": "C0OLD", "name": "case-1999", "is_archived": False}]}
        if method == "conversations.create":
            return {"ok": True, "channel": {"id": f"C0NEW{len(api_calls)}"}}
        return {"ok": True}
    with TestClient(app) as client:
        slack, flow = app.state.slack, app.state.caseflow
        flow.bootstrap_retry_seconds = 1
        slack._post = lambda m, p: posted.append((m, p)); slack.api_call = fake_api
        slack.salesforce = sf; flow.salesforce = sf; flow.orgs[1] = sf; flow.mailer = FakeMailer()
        assert wait_until(lambda: outage["attempts"] >= 3, timeout=30)       # tried more than once while down
        assert len(sf.cases) == 1 and not flow._active_flow_for_org(1)         # still dark, no partial state
        outage["down"] = False                                                  # Salesforce recovers
        assert wait_until(lambda: flow._active_flow_for_org(1), timeout=30)    # service comes back on its own
        assert orphan["Id"] in sf.deleted                                      # leftover case cleaned first
        assert ("conversations.archive", {"channel": "C0OLD"}) in api_calls    # and its channel archived
        assert len(sf.cases) == 2                                              # exactly one fresh case
