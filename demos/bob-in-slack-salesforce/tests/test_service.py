"""Core-service tests: HTTP API + job lifecycle against the fake Bob CLI."""

from pathlib import Path
import shlex
import sys
import time

import pytest

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from headless_bob.api import Settings, create_app  # noqa: E402
from headless_bob.auth import create_api_key  # noqa: E402
from headless_bob.db import Database  # noqa: E402

FAKE_BOB = f"{shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).parent / 'fake_bob_acp.py'))}"


@pytest.fixture()
def service(tmp_path, monkeypatch):
    monkeypatch.setenv("HB_ROOT", str(tmp_path / "ws"))
    monkeypatch.setenv("HB_DB", str(tmp_path / "hb.db"))
    monkeypatch.setenv("HB_BOB_BIN", FAKE_BOB)
    monkeypatch.setenv("HB_WORKERS", "2")
    settings = Settings()
    app = create_app(settings)
    key = create_api_key(Database(settings.db_path), tenant="acme", label="test")
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {key}"
        yield client, settings


def wait_for(client, job_id, timeout=10.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/v1/jobs/{job_id}").json()
        if job["state"] in ("completed", "failed", "cancelled"):
            return job
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} did not finish: {job}")


def test_rejects_missing_or_bad_key(service):
    client, _ = service
    assert client.get("/v1/jobs", headers={"Authorization": ""}).status_code == 401
    assert client.get("/v1/jobs", headers={"Authorization": "Bearer hb_nope"}).status_code == 401


def test_job_lifecycle(service):
    client, _ = service
    created = client.post("/v1/jobs", json={"prompt": "hello"})
    assert created.status_code == 202
    job = wait_for(client, created.json()["id"])
    assert job["state"] == "completed"
    assert job["output"] == "FAKE-OK"
    assert job["cost"] is None  # fake ACP has no bob.db cost store


def test_session_memory_is_native(service):
    client, _ = service
    first = client.post("/v1/jobs", json={"prompt": "Remember the codeword API-ELK-4.",
                                          "session": "thread-9"}).json()
    wait_for(client, first["id"])
    second = client.post("/v1/jobs", json={"prompt": "what is the codeword?",
                                           "session": "thread-9"}).json()
    done = wait_for(client, second["id"])
    assert done["output"] == "API-ELK-4"

    session = client.get("/v1/sessions/thread-9").json()
    assert session["hasMemory"] is True


def test_concurrency_quota(service):
    client, settings = service
    # default max_concurrent_jobs=2 — 3rd active job must 429.
    import os
    os.environ["FAKE_BOB_SLEEP"] = "2"
    try:
        first = client.post("/v1/jobs", json={"prompt": "a"})
        second = client.post("/v1/jobs", json={"prompt": "b"})
        third = client.post("/v1/jobs", json={"prompt": "c"})
        assert first.status_code == 202 and second.status_code == 202
        assert third.status_code == 429
    finally:
        os.environ.pop("FAKE_BOB_SLEEP", None)


def test_tenant_isolation(service):
    client, settings = service
    other_key = create_api_key(Database(settings.db_path), tenant="rival")
    job = client.post("/v1/jobs", json={"prompt": "secret"}).json()
    stolen = client.get(
        f"/v1/jobs/{job['id']}", headers={"Authorization": f"Bearer {other_key}"}
    )
    assert stolen.status_code == 404


def test_restart_recovery_requeues_and_fails_orphans(tmp_path, monkeypatch):
    monkeypatch.setenv("HB_ROOT", str(tmp_path / "ws"))
    monkeypatch.setenv("HB_DB", str(tmp_path / "hb.db"))
    monkeypatch.setenv("HB_BOB_BIN", FAKE_BOB)
    settings = Settings()
    db = Database(settings.db_path)
    key = create_api_key(db, tenant="acme")

    # Simulate a crashed instance: one job left 'running', one left 'queued'.
    from headless_bob.db import now
    db.execute(
        "INSERT INTO jobs (id, tenant, state, prompt, created_at, updated_at)"
        " VALUES ('job-orphan','acme','running','x',?,?)", (now(), now()))
    db.execute(
        "INSERT INTO jobs (id, tenant, state, prompt, created_at, updated_at)"
        " VALUES ('job-waiting','acme','queued','hello',?,?)", (now(), now()))

    with TestClient(create_app(settings)) as client:
        client.headers["Authorization"] = f"Bearer {key}"
        orphan = client.get("/v1/jobs/job-orphan").json()
        assert orphan["state"] == "failed"
        assert "orphaned" in orphan["error"]
        recovered = wait_for(client, "job-waiting")
        assert recovered["state"] == "completed"
        assert recovered["output"] == "FAKE-OK"


def test_salesforce_client_reauths_once_on_401(monkeypatch):
    from headless_bob.salesforce import SalesforceClient
    import httpx
    client = SalesforceClient("https://login.example", "cid", "user", "key")
    tokens = iter(["tok-1", "tok-2"])
    def fake_ensure():
        if client._token is None:
            client._token = next(tokens); client._instance = "https://inst.example"
    monkeypatch.setattr(client, "_ensure_token", fake_ensure)
    seen = []
    def fake_request(method, url, headers=None, timeout=None, **kw):
        seen.append(headers["Authorization"])
        code = 401 if headers["Authorization"].endswith("tok-1") else 200
        return httpx.Response(code, json={"records": []}, request=httpx.Request(method, url))
    monkeypatch.setattr(httpx, "request", fake_request)
    assert client._get("/services/data/v60.0/query", q="SELECT Id FROM Case") == {"records": []}
    assert seen == ["Bearer tok-1", "Bearer tok-2"]          # revoked token → fresh login → retry


def test_cancel_stops_a_running_job(service):
    """POST /cancel on a running job sends ACP session/cancel; the job ends
    'cancelled' instead of running to completion or timing out."""
    client, _ = service
    job_id = client.post("/v1/jobs", json={"prompt": "SLOW 10", "timeout_seconds": 30}).json()["id"]
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and client.get(f"/v1/jobs/{job_id}").json()["state"] != "running":
        time.sleep(0.05)
    started = time.monotonic()
    assert client.post(f"/v1/jobs/{job_id}/cancel").status_code == 200
    job = wait_for(client, job_id)
    assert job["state"] == "cancelled" and job["error"] == "cancelled"
    assert time.monotonic() - started < 5


def test_every_turn_leaves_an_audit_record(service, caplog):
    """Partners ask "what did Bob do?": each job carries the permission
    decisions, stop reason, cost and budget outcome, and one audit log line."""
    import json, logging
    client, _ = service
    with caplog.at_level(logging.INFO, logger="headless_bob.audit"):
        job = wait_for(client, client.post("/v1/jobs", json={
            "prompt": "Create a file named audited.txt containing yes"}).json()["id"])
    audit = job["audit"]
    assert audit["state"] == "completed" and audit["stop_reason"] == "end_turn"
    assert audit["allow_writes"] is True and audit["tool_calls"] == 1
    assert audit["permissions"] == [{"tool": "Writing file audited.txt", "kind": "edit",
                                     "decision": "allow", "optionId": "allow"}]
    assert audit["duration_ms"] >= 0 and audit["budget_exceeded"] == ""
    lines = [json.loads(r.getMessage()) for r in caplog.records if r.name == "headless_bob.audit"]
    assert lines and lines[-1]["job"] == job["id"] and lines[-1]["tenant"] == "acme"


def test_tenant_home_gets_settings_with_auto_update_off(service, tmp_path):
    import json
    client, settings = service
    wait_for(client, client.post("/v1/jobs", json={"prompt": "hello"}).json()["id"])
    seeded = json.loads((tmp_path / "ws" / "tenants" / "acme" / "home" / ".bob" / "settings"
                         / "settings.json").read_text())
    assert seeded["bobShell"]["autoUpdate"] is False


def test_idempotency_key_returns_the_same_job(service):
    client, _ = service
    headers = {"Idempotency-Key": "req-42"}
    first = client.post("/v1/jobs", json={"prompt": "hello"}, headers=headers).json()
    again = client.post("/v1/jobs", json={"prompt": "hello"}, headers=headers).json()
    other = client.post("/v1/jobs", json={"prompt": "hello"}).json()
    assert first["id"] == again["id"] != other["id"]
    assert wait_for(client, first["id"])["state"] == "completed"
    assert client.post("/v1/jobs", json={"prompt": "x"}, headers={"Idempotency-Key": "k" * 129}).status_code == 400


def test_key_rotation_revokes_old_key_and_keeps_history(service):
    from headless_bob.auth import create_api_key, list_api_keys, revoke_api_key
    client, settings = service
    db = Database(settings.db_path)
    old_job = wait_for(client, client.post("/v1/jobs", json={"prompt": "hello"}).json()["id"])
    new_key = create_api_key(db, tenant="acme", label="rotated")
    keys = list_api_keys(db, "acme")
    assert [k["label"] for k in keys] == ["test", "rotated"] and all(k["revoked_at"] == "" for k in keys)
    assert revoke_api_key(db, keys[0]["id"]) and not revoke_api_key(db, keys[0]["id"])
    assert client.get("/v1/jobs").status_code == 401                       # old key is dead
    client.headers["Authorization"] = f"Bearer {new_key}"
    assert any(j["id"] == old_job["id"] for j in client.get("/v1/jobs").json())  # history kept


def test_daily_budget_stops_new_jobs(service):
    from headless_bob.auth import create_api_key
    client, settings = service
    db = Database(settings.db_path)
    tight = create_api_key(db, tenant="thrifty", label="t", max_cost_per_day=0.10)
    client.headers["Authorization"] = f"Bearer {tight}"
    job = wait_for(client, client.post("/v1/jobs", json={"prompt": "hello"}).json()["id"])
    db.execute("UPDATE jobs SET cost=0.12 WHERE id=?", (job["id"],))  # the fake reports no cost; simulate spend
    blocked = client.post("/v1/jobs", json={"prompt": "hello"})
    assert blocked.status_code == 429 and "daily budget" in blocked.json()["detail"]
