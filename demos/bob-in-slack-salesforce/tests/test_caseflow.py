"""Final-demo-flow tests: kiosk → case → approvals → implement → close/reset."""

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

FAKE_BOB = f"{shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).parent / 'fake_bob_acp.py'))}"
SECRET = "test-signing-secret"


def sign(body: bytes) -> dict:
    ts = str(int(time.time()))
    sig = "v0=" + hmac.new(SECRET.encode(), f"v0:{ts}:".encode() + body,
                           hashlib.sha256).hexdigest()
    return {"X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig}


class FakeSF:
    def __init__(self):
        self.cases, self.attached, self.rules = {}, [], {}
        self.closed, self.deleted = [], []
        self._n = 1000

    def create_case(self, subject, description, supplied_email="", **kw):
        self._n += 1
        case = {"Id": f"500{self._n}", "CaseNumber": f"{self._n:08d}", "Subject": subject}
        self.cases[case["Id"]] = {**case, "email": supplied_email}
        return case

    def attach_to_case(self, case_id, title, body):
        self.attached.append((case_id, title, len(body)))

    def get_instance_url(self):
        return "https://sf.example"

    def deploy_validation_rule(self, **kw):
        rule_id = f"03d{len(self.rules)+1:04d}"
        self.rules[rule_id] = kw
        return rule_id

    def delete_validation_rule(self, rule_id):
        self.rules.pop(rule_id, None)

    def close_case(self, case_id):
        self.closed.append(case_id)

    def delete_case(self, case_id):
        self.deleted.append(case_id)


class FakeMailer:
    configured = True

    def __init__(self):
        self.sent = []

    def send(self, to, subject, body):
        self.sent.append((to, subject))
        return True


@pytest.fixture()
def sample(tmp_path, monkeypatch):
    monkeypatch.setenv("HB_ROOT", str(tmp_path / "ws"))
    monkeypatch.setenv("HB_DB", str(tmp_path / "hb.db"))
    monkeypatch.setenv("HB_BOB_BIN", FAKE_BOB)
    monkeypatch.setenv("HB_WORKERS", "2")
    monkeypatch.setenv("HB_SLACK_BOT_TOKEN", "xoxb-test")
    monkeypatch.setenv("HB_SLACK_SIGNING_SECRET", SECRET)
    monkeypatch.setenv("HB_SLACK_SESSION_SCOPE", "channel")
    monkeypatch.setenv("HB_SF_LOGIN_URL", "https://login.example")
    monkeypatch.setenv("HB_SF_CLIENT_ID", "3MVGfake")
    monkeypatch.setenv("HB_SF_USERNAME", "demo@example.com")
    monkeypatch.setenv("HB_SF_PRIVATE_KEY_B64", base64.b64encode(b"fake").decode())
    monkeypatch.setenv("HB_CASE_REQUESTER_EMAIL", "requester@example.com")
    monkeypatch.setenv("HB_FLOW_VARIANT", "validation_rule")
    monkeypatch.setenv("HB_ARCHIVE_DELAY_SECONDS", "0")
    app = create_app(Settings())
    posted, api_calls = [], []
    fake_sf, fake_mail = FakeSF(), FakeMailer()
    with TestClient(app) as client:
        slack = app.state.slack
        flow = app.state.caseflow
        slack._post = lambda method, payload: posted.append((method, payload))
        slack.api_call = lambda method, payload: (
            api_calls.append((method, payload)) or
            ({"ok": True, "channel": {"id": "C0CASE"}} if method == "conversations.create"
             else {"ok": True}))
        slack.salesforce = fake_sf
        flow.salesforce = fake_sf
        flow.orgs[1] = fake_sf
        flow.mailer = fake_mail
        yield client, flow, fake_sf, fake_mail, posted, api_calls


def wait_until(predicate, timeout=60.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def click(client, action_id, value):
    payload = {"type": "block_actions", "user": {"id": "U42"},
               "channel": {"id": "C0CASE"}, "message": {"ts": "1.0"},
               "actions": [{"action_id": action_id, "value": value}]}
    form = urlencode({"payload": json.dumps(payload)}).encode()
    client.post("/slack/interactivity", content=form, headers=sign(form))


def say_in_channel(client, text, event_id):
    body = json.dumps({"type": "event_callback", "event_id": event_id,
                       "event": {"type": "app_mention", "text": text,
                                 "channel": "C0CASE", "ts": "9.9"}}).encode()
    client.post("/slack/events", content=body, headers=sign(body))


def test_trigger_page_served(sample):
    client, *_ = sample
    page = client.get("/demo")
    assert page.status_code == 200 and "Start a case for Bob" in page.text
    assert client.post("/demo/case", json={"issue": "x" * 6000}).status_code == 422


def test_full_happy_path(sample):
    client, flow, sf, mail, posted, api_calls = sample
    # Beat 0: kiosk submit
    result = client.post("/demo/case", json={"issue": "Reps skip descriptions"})
    assert result.status_code == 200
    data = result.json()
    assert not mail.sent                                     # nothing mailed at start
    assert sf.cases                                          # real-ish case created
    assert all(c["email"] == "requester@example.com"         # requester from config
               for c in sf.cases.values())
    assert ("conversations.create", {"name": data["channel"], "is_private": False}) \
        in [(m, p) for m, p in api_calls]
    assert wait_until(lambda: any("Approve solution" in json.dumps(p[1].get("blocks", []))
                                  for p in posted))          # Bob's alert with buttons

    # Beat 1: approve solution -> summary attached to case
    click(client, "hb_case_sol", "C0CASE")
    assert wait_until(lambda: sf.attached)
    assert sf.attached[0][1] == "Use-case summary (via Bob)"

    # Beat 2: 'implement' -> approval -> rule deployed
    say_in_channel(client, "<@U0BOT> implement the solution", "Ev-impl")
    assert wait_until(lambda: any("Approve deploy" in json.dumps(p[1].get("blocks", []))
                                  for p in posted))
    click(client, "hb_case_impl", "C0CASE")
    assert wait_until(lambda: sf.rules)                      # real org change (faked)
    rule = list(sf.rules.values())[0]
    assert rule["object_name"] == "Opportunity"
    assert rule["rule_name"].startswith("Description_Required_At_Commit_")  # per-flow name

    # Beat 3: close -> email + cleanup + archive
    click(client, "hb_case_close", "C0CASE")
    assert wait_until(lambda: sf.deleted)
    case_id = list(sf.cases)[0]
    assert sf.closed == [case_id] and sf.deleted == [case_id]
    assert not sf.rules                                      # rule removed
    closure = [m for m in mail.sent if "resolved" in m[1]]
    assert closure and closure[0][0] == "requester@example.com"  # configured requester
    assert ("conversations.archive", {"channel": "C0CASE"}) \
        in [(m, p) for m, p in api_calls]
    state = flow.db.one("SELECT state FROM caseflow WHERE channel_id='C0CASE'")
    assert state["state"] == "closed"


def test_double_click_is_idempotent(sample):
    client, flow, sf, mail, posted, api_calls = sample
    client.post("/demo/case", json={"issue": "x desc issue"})
    wait_until(lambda: any("Approve solution" in json.dumps(p[1].get("blocks", []))
                           for p in posted))
    click(client, "hb_case_sol", "C0CASE")
    click(client, "hb_case_sol", "C0CASE")   # double click
    wait_until(lambda: sf.attached)
    time.sleep(0.6)
    assert len(sf.attached) == 1             # summary attached exactly once
