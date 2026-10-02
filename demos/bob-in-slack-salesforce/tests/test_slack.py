"""Slack adapter tests: signature verification, thread memory, approval gate."""

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
from headless_bob.slack import verify_slack_signature  # noqa: E402

FAKE_BOB = f"{shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).parent / 'fake_bob_acp.py'))}"
SECRET = "test-signing-secret"


def sign(body: bytes, secret: str = SECRET, ts: str | None = None) -> dict:
    ts = ts or str(int(time.time()))
    sig = "v0=" + hmac.new(secret.encode(), f"v0:{ts}:".encode() + body, hashlib.sha256).hexdigest()
    return {"X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig}


@pytest.fixture()
def slack_app(tmp_path, monkeypatch):
    monkeypatch.setenv("HB_ROOT", str(tmp_path / "ws"))
    monkeypatch.setenv("HB_DB", str(tmp_path / "hb.db"))
    monkeypatch.setenv("HB_BOB_BIN", FAKE_BOB)
    monkeypatch.setenv("HB_WORKERS", "2")
    monkeypatch.setenv("HB_SLACK_BOT_TOKEN", "xoxb-test")
    monkeypatch.setenv("HB_SLACK_SIGNING_SECRET", SECRET)
    app = create_app(Settings())
    posted: list[tuple[str, dict]] = []
    with TestClient(app) as client:
        app.state.slack._post = lambda method, payload: posted.append((method, payload))
        yield client, posted


def wait_posts(posted, n, timeout=60.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if len(posted) >= n:
            return
        time.sleep(0.05)
    raise AssertionError(f"expected {n} posts, got {len(posted)}: {posted}")


def event_body(text, channel="C1", ts="111.222", thread_ts=None, event_id="Ev1"):
    return json.dumps({
        "type": "event_callback",
        "event_id": event_id,
        "event": {"type": "app_mention", "text": text, "channel": channel,
                  "ts": ts, **({"thread_ts": thread_ts} if thread_ts else {})},
    }).encode()


def test_signature_helper_rejects_stale_and_bad():
    body = b"{}"
    good = sign(body)
    assert verify_slack_signature(SECRET, good["X-Slack-Request-Timestamp"], body,
                                  good["X-Slack-Signature"])
    stale = sign(body, ts=str(int(time.time()) - 3600))
    assert not verify_slack_signature(SECRET, stale["X-Slack-Request-Timestamp"], body,
                                      stale["X-Slack-Signature"])
    assert not verify_slack_signature(SECRET, good["X-Slack-Request-Timestamp"], body, "v0=bad")


def test_unsigned_requests_rejected(slack_app):
    client, _ = slack_app
    assert client.post("/slack/events", content=b"{}").status_code == 401


def test_url_verification_challenge(slack_app):
    client, _ = slack_app
    body = json.dumps({"type": "url_verification", "challenge": "abc123"}).encode()
    response = client.post("/slack/events", content=body, headers=sign(body))
    assert response.json() == {"challenge": "abc123"}


def test_mention_replies_in_thread_readonly(slack_app):
    client, posted = slack_app
    body = event_body("<@U0BOT> hello there")
    assert client.post("/slack/events", content=body, headers=sign(body)).status_code == 200
    wait_posts(posted, 1)
    method, payload = posted[0]
    assert method == "chat.postMessage"
    assert payload["channel"] == "C1" and payload["thread_ts"] == "111.222"
    assert payload["text"] == "FAKE-OK"


def test_readonly_thread_memory_is_native(slack_app):
    # ACP sessions are continuous — no replay, no resume machinery.
    client, posted = slack_app
    first = event_body("<@U0BOT> Remember the codeword FAKE-FOX-9.", event_id="Ev-a")
    client.post("/slack/events", content=first, headers=sign(first))
    wait_posts(posted, 1)
    follow = event_body("<@U0BOT> what is the codeword?", thread_ts="111.222",
                        ts="333.444", event_id="Ev-b")
    client.post("/slack/events", content=follow, headers=sign(follow))
    wait_posts(posted, 2)
    assert posted[1][1]["text"] == "FAKE-FOX-9"


def test_repeated_approved_writes_share_session(slack_app, monkeypatch):
    client, posted = slack_app
    monkeypatch.setattr(client.app.state.slack, "upload_file", lambda *a: None)
    def approve(n):
        click = {
            "type": "block_actions", "user": {"id": "U42"},
            "channel": {"id": "C1"},
            "message": {"ts": f"99{n}.000", "thread_ts": "111.222"},
            "actions": [{"action_id": "hb_approve",
                         "value": f"create a file named a{n}.txt containing x{n}"}],
        }
        form = urlencode({"payload": json.dumps(click)}).encode()
        client.post("/slack/interactivity", content=form, headers=sign(form))
    approve(1)
    wait_posts(posted, 2)
    approve(2)
    wait_posts(posted, 4)
    texts = " ".join(p[1]["text"] for p in posted)
    assert "Created a1.txt" in texts and "Created a2.txt" in texts


def test_plain_mention_write_attempt_is_gated_per_action(slack_app, tmp_path):
    # No !write: the per-action permission policy must reject the edit.
    client, posted = slack_app
    body = event_body("<@U0BOT> create a file named sneaky.txt containing gotcha",
                      event_id="Ev-gate")
    client.post("/slack/events", content=body, headers=sign(body))
    wait_posts(posted, 1)
    assert "rejected" in posted[0][1]["text"].lower()


def test_duplicate_event_ids_ignored(slack_app):
    client, posted = slack_app
    body = event_body("<@U0BOT> hi", event_id="Ev-dup")
    client.post("/slack/events", content=body, headers=sign(body))
    client.post("/slack/events", content=body, headers=sign(body))
    wait_posts(posted, 1)
    time.sleep(0.5)
    assert len(posted) == 1


def test_write_request_gates_on_approval(slack_app):
    client, posted = slack_app
    body = event_body("<@U0BOT> !write create hello.txt")
    client.post("/slack/events", content=body, headers=sign(body))
    wait_posts(posted, 1)
    method, payload = posted[0]
    assert "Approval needed" in json.dumps(payload.get("blocks", []))
    # No job ran yet — only the approval prompt was posted.
    time.sleep(0.3)
    assert len(posted) == 1

    click = {
        "type": "block_actions",
        "user": {"id": "U42"},
        "channel": {"id": "C1"},
        "message": {"ts": "999.000", "thread_ts": "111.222"},
        "actions": [{"action_id": "hb_approve", "value": "create hello.txt"}],
    }
    form = urlencode({"payload": json.dumps(click)}).encode()
    client.post("/slack/interactivity", content=form, headers=sign(form))
    wait_posts(posted, 3)  # "Approved by…" + Bob's reply
    texts = [p[1]["text"] for p in posted[1:]]
    assert any("Approved by <@U42>" in t for t in texts)
    assert any(t == "FAKE-OK" for t in texts)


def test_reject_runs_nothing(slack_app):
    client, posted = slack_app
    click = {
        "type": "block_actions",
        "user": {"id": "U42"},
        "channel": {"id": "C1"},
        "message": {"ts": "999.000"},
        "actions": [{"action_id": "hb_reject", "value": "reject"}],
    }
    form = urlencode({"payload": json.dumps(click)}).encode()
    client.post("/slack/interactivity", content=form, headers=sign(form))
    wait_posts(posted, 1)
    assert "Rejected by <@U42>" in posted[0][1]["text"]
    time.sleep(0.3)
    assert len(posted) == 1


def test_created_files_are_uploaded_to_thread(slack_app, monkeypatch):
    client, posted = slack_app
    uploads: list[tuple[str, bytes]] = []
    app_slack = client.app.state.slack
    monkeypatch.setattr(
        app_slack, "upload_file",
        lambda channel, thread_ts, filename, data: uploads.append((filename, data)),
    )
    body = event_body("<@U0BOT> !write create a file named demo.txt containing hello", event_id="Ev-up")
    client.post("/slack/events", content=body, headers=sign(body))
    wait_posts(posted, 1)  # approval card
    click = {
        "type": "block_actions",
        "user": {"id": "U42"},
        "channel": {"id": "C1"},
        "message": {"ts": "999.000", "thread_ts": "111.222"},
        "actions": [{"action_id": "hb_approve", "value": "create a file named demo.txt containing hello"}],
    }
    form = urlencode({"payload": json.dumps(click)}).encode()
    client.post("/slack/interactivity", content=form, headers=sign(form))
    wait_posts(posted, 3)
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and not uploads:
        time.sleep(0.05)
    assert uploads == [("demo.txt", b"hello")]


def test_channel_scope_flat_replies_and_shared_memory(tmp_path, monkeypatch):
    monkeypatch.setenv("HB_ROOT", str(tmp_path / "ws"))
    monkeypatch.setenv("HB_DB", str(tmp_path / "hb.db"))
    monkeypatch.setenv("HB_BOB_BIN", FAKE_BOB)
    monkeypatch.setenv("HB_WORKERS", "2")
    monkeypatch.setenv("HB_SLACK_BOT_TOKEN", "xoxb-test")
    monkeypatch.setenv("HB_SLACK_SIGNING_SECRET", SECRET)
    monkeypatch.setenv("HB_SLACK_SESSION_SCOPE", "channel")
    app = create_app(Settings())
    posted: list[tuple[str, dict]] = []
    with TestClient(app) as client:
        app.state.slack._post = lambda method, payload: posted.append((method, payload))
        client.headers.clear()
        first = event_body("<@U0BOT> Remember the codeword FLAT-OWL-2.", ts="100.000", event_id="Ev-c1")
        client.post("/slack/events", content=first, headers=sign(first))
        wait_posts(posted, 1)
        assert "thread_ts" not in posted[0][1]  # flat reply
        second = event_body("<@U0BOT> what is the codeword?", ts="200.000", event_id="Ev-c2")
        client.post("/slack/events", content=second, headers=sign(second))
        wait_posts(posted, 2)
        assert posted[1][1]["text"] == "FLAT-OWL-2"  # memory across top-level msgs


def test_channel_created_auto_join_is_opt_in(slack_app):
    client, posted = slack_app
    body = json.dumps({
        "type": "event_callback", "event_id": "Ev-newchan",
        "event": {"type": "channel_created",
                  "channel": {"id": "C0NEW", "name": "visitor-42"}},
    }).encode()
    client.post("/slack/events", content=body, headers=sign(body))
    time.sleep(0.3)
    assert posted == []                                         # off by default
    client.app.state.slack.auto_join = True
    body = body.replace(b"Ev-newchan", b"Ev-newchan2")
    client.post("/slack/events", content=body, headers=sign(body))
    wait_posts(posted, 1)
    assert posted[0] == ("conversations.join", {"channel": "C0NEW"})


def _reply_file(tmp_path, content):
    f = tmp_path / "reply.txt"
    f.write_text(content, encoding="utf-8")
    return str(f)


def test_long_output_streams_headers_and_attaches(slack_app, monkeypatch, tmp_path):
    client, posted = slack_app
    uploads = []
    monkeypatch.setattr(client.app.state.slack, "upload_file",
                        lambda c, t, name, data: uploads.append((name, len(data))))
    body_text = "## Refined User Stories\n" + ("story detail line\n" * 120) \
        + "## Solution Approach\n" + ("approach detail line\n" * 120)
    monkeypatch.setenv("FAKE_BOB_REPLY_FILE", _reply_file(tmp_path, body_text))
    body = event_body("<@U0BOT> plan please", event_id="Ev-long")
    client.post("/slack/events", content=body, headers=sign(body))
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and not uploads:
        time.sleep(0.05)
    texts = [p[1]["text"] for p in posted]
    assert any("Refined User Stories" in t and t.startswith("⏳") for t in texts)
    assert any("Solution Approach" in t and t.startswith("⏳") for t in texts)
    assert any("full deliverable attached" in t for t in texts)
    assert uploads and uploads[0][0].endswith(".md")
    assert uploads[0][1] == len(body_text.strip().encode())


def test_html_reply_attached_as_onepager(slack_app, monkeypatch, tmp_path):
    client, posted = slack_app
    uploads = []
    monkeypatch.setattr(client.app.state.slack, "upload_file",
                        lambda c, t, name, data: uploads.append((name, data)))
    html = "<html><body>" + "<p>Meridian one-pager content</p>" * 30 + "</body></html>"
    monkeypatch.setenv("FAKE_BOB_REPLY_FILE",
                       _reply_file(tmp_path, "Here you go!\n" + html + "\nEnjoy."))
    body = event_body("<@U0BOT> format as html", event_id="Ev-html")
    client.post("/slack/events", content=body, headers=sign(body))
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and not uploads:
        time.sleep(0.05)
    assert uploads[0][0].endswith(".html")
    assert uploads[0][1].decode().startswith("<html>")
    assert uploads[0][1].decode().endswith("</html>")
    assert any("one-pager" in p[1]["text"] for p in posted)


def test_url_verification_answered_without_signature(slack_app):
    client, posted = slack_app
    body = json.dumps({"type": "url_verification", "challenge": "abc123"}).encode()
    r = client.post("/slack/events", content=body)          # deliberately unsigned
    assert r.status_code == 200 and r.json() == {"challenge": "abc123"}
    # anything else unsigned is still rejected
    other = json.dumps({"type": "event_callback", "event": {"type": "app_mention"}}).encode()
    assert client.post("/slack/events", content=other).status_code == 401


def test_api_call_is_form_encoded(slack_app, monkeypatch):
    """Slack's read methods (conversations.list/info) ignore JSON bodies — seen
    live: limit + exclude_archived dropped, only the oldest 100 channels
    returned. api_call must send a form, with booleans Slack understands."""
    import headless_bob.slack as slack_mod
    client, _ = slack_app
    calls = []

    class Resp:
        def json(self):
            return {"ok": True}
    monkeypatch.setattr(slack_mod.httpx, "post", lambda url, **kw: calls.append((url, kw)) or Resp())
    client.app.state.slack.api_call(
        "conversations.list", {"types": "public_channel", "exclude_archived": True, "limit": 200})
    client.app.state.slack.api_call("conversations.invite", {"channel": "C1", "users": ["U1", "U2"]})
    (url, kw), (_, kw2) = calls
    assert url.endswith("/conversations.list")
    assert "json" not in kw
    assert kw["data"] == {"types": "public_channel", "exclude_archived": "true", "limit": 200}
    assert kw2["data"] == {"channel": "C1", "users": "U1,U2"}


def test_refused_slack_post_is_logged(monkeypatch, caplog):
    """Slack's API answers 200 with ok:false for a bad message; that must
    surface in the log, not vanish."""
    import logging
    import httpx
    from headless_bob.slack import SlackAdapter

    class R:
        status_code = 200
        def json(self): return {"ok": False, "error": "invalid_blocks"}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: R())
    adapter = SlackAdapter.__new__(SlackAdapter)
    adapter.bot_token = "xoxb-test"
    with caplog.at_level(logging.ERROR, logger="headless_bob.slack"):
        adapter._post_slack("chat.postMessage", {"channel": "C1", "text": "x", "blocks": []})
    assert any("invalid_blocks" in r.getMessage() and "C1" in r.getMessage() for r in caplog.records)
