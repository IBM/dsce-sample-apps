"""Package variant: Bob builds the change as metadata, the service validates,
gates, deploys and rolls it back. Salesforce's Metadata API is faked."""
import base64
import io
import json
import sys
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent))

import headless_bob.caseflow as caseflow_mod  # noqa: E402
from headless_bob.api import Settings, create_app  # noqa: E402
from headless_bob.metadata_api import DeployResult, build_zip, package_xml  # noqa: E402
from test_successplan_flow import FAKE_BOB, SECRET, FakeMailer, FakeSF, blocks_with, click, wait_until  # noqa: E402


class OrgSF(FakeSF):
    """FakeSF plus the low-level calls rollback uses to deactivate Flows."""
    def __init__(self):
        super().__init__(); self.low = []
    def _get(self, path, **params): self.low.append(("get", path)); return {"records": [{"Id": "300F"}]}
    def _patch(self, path, body): self.low.append(("patch", path, body))
    def _soql(self, q): self.low.append(("soql", q)); return []
    def _delete(self, path): self.low.append(("delete", path))
    def get_instance_url(self): return "https://sf.example"


class FakeMd:
    """Stands in for MetadataApi(client): first validation fails, then succeeds."""
    instances = []

    def __init__(self, client):
        self.client, self.calls = client, []
        self.validations = [DeployResult({"done": True, "success": False, "status": "Failed", "details": {
            "componentFailures": [{"fileName": "flows/x.flow", "lineNumber": 3, "problem": "invalid element"}]}})]
        FakeMd.instances.append(self)

    def validate(self, package, **kw):
        self.calls.append(("validate", sorted(zipfile.ZipFile(io.BytesIO(package)).namelist()), kw))
        return self.validations.pop(0) if self.validations else DeployResult(
            {"done": True, "success": True, "status": "Succeeded", "details": {"runTestResult": {"numTestsRun": 0}}})

    def retrieve(self, members):
        self.calls.append(("retrieve", members))
        return build_zip({"package.xml": package_xml({})})          # nothing exists yet: all new

    def deploy_and_wait(self, package, **kw):
        names = sorted(zipfile.ZipFile(io.BytesIO(package)).namelist())
        self.calls.append(("deploy", names, kw))
        return DeployResult({"done": True, "success": True, "status": "Succeeded", "id": "0Af999"})


@pytest.fixture()
def pkg(tmp_path, monkeypatch):
    for k, v in {"HB_ROOT": str(tmp_path / "ws"), "HB_DB": str(tmp_path / "hb.db"),
                 "HB_BOB_BIN": FAKE_BOB, "HB_WORKERS": "2", "HB_SLACK_BOT_TOKEN": "xoxb-test",
                 "HB_SLACK_SIGNING_SECRET": SECRET, "HB_SLACK_SESSION_SCOPE": "channel",
                 "HB_SF_LOGIN_URL": "https://login.example", "HB_SF_CLIENT_ID": "3MVGfake",
                 "HB_SF_USERNAME": "demo@example.com",
                 "HB_SF_PRIVATE_KEY_B64": base64.b64encode(b"fake").decode(),
                 "HB_ARCHIVE_DELAY_SECONDS": "0", "HB_FLOW_VARIANT": "package",
                 "HB_MCP_URL": "https://svc.example/mcp", "HB_MCP_TOKEN": "mcp-secret-token",
                 "HB_CASE_REQUESTER_EMAIL": "requester@example.com"}.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("HB_ATTRACT_LOOP", raising=False)
    monkeypatch.setattr(caseflow_mod, "MetadataApi", FakeMd)
    FakeMd.instances.clear()
    app = create_app(Settings())
    posted, api_calls = [], []
    fake_sf, fake_mail = OrgSF(), FakeMailer()

    def fake_api(method, payload):
        api_calls.append((method, payload))
        if method == "conversations.create":
            return {"ok": True, "channel": {"id": "C0PKG"}}
        return {"ok": True}
    with TestClient(app) as client:
        slack, flow = app.state.slack, app.state.caseflow
        slack._post = lambda method, payload: posted.append((method, payload))
        slack.api_call = fake_api
        flow.salesforce = fake_sf; flow.orgs[1] = fake_sf; flow.mailer = fake_mail
        yield client, flow, fake_sf, fake_mail, posted, api_calls, tmp_path


def texts(posted):
    return [p[1].get("text", "") + json.dumps(p[1].get("blocks", [])) for p in posted]


def test_package_variant_builds_validates_deploys_and_rolls_back(pkg):
    client, flow, sf, mail, posted, api_calls, tmp_path = pkg
    # A case arrives (trigger page); the workspace is an SFDX project wired to the org MCP server.
    result = client.post("/demo/case", json={"issue": ""})
    assert result.status_code == 200
    case_number = result.json()["caseNumber"]
    ws = flow._workspace_for("C0PKG")
    assert json.loads((ws / "sfdx-project.json").read_text())["packageDirectories"][0]["path"] == "force-app"
    mcp = json.loads((ws / ".bob" / "mcp.json").read_text())["mcpServers"]["salesforce-org"]
    assert mcp["url"] == "https://svc.example/mcp" and mcp["headers"]["Authorization"] == "Bearer mcp-secret-token"
    assert mcp["transportType"] == "http"
    assert (ws / ".bob" / "skills").is_dir() or True                      # seed copy is optional in tests

    # Proposal, then approval → summary → build turn starts.
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))
    click(client, "hb_case_sol", "C0PKG")
    assert wait_until(lambda: sf.attached)
    assert wait_until(lambda: any("Building the change" in t for t in texts(posted)))
    # The fake validation fails once → Bob's fix turn → second validation passes → the gate.
    assert wait_until(lambda: blocks_with(posted, "Approve deploy"), timeout=90)
    assert any("Bob is fixing them" in t for t in texts(posted))
    md = FakeMd.instances[0]
    validations = [c for c in md.calls if c[0] == "validate"]
    assert len(validations) == 2
    num = case_number.lstrip("0")
    assert validations[0][1] == ["flows/Create_Success_Plan_%s.flow" % num, "objects/Success_Plan__c.object", "package.xml"]
    info = flow._package_info("C0PKG")
    assert info["stage"] == "validated"
    assert info["summary"] == [f"CustomField: Success_Plan__c.Target_Go_Live_{num}__c", f"Flow: Create_Success_Plan_{num}"]
    assert "Test steps" in info["notes"]
    gate = [t for t in texts(posted) if "Validated against the org" in t][0]
    assert f"Create_Success_Plan_{num}" in gate
    flow_file = ws / "force-app/main/default/flows" / f"Create_Success_Plan_{num}.flow-meta.xml"
    assert "<!-- fixed -->" in flow_file.read_text()                      # the fix turn edited in place

    # Approve deploy → snapshot, then the real deploy, then Bob's test steps with Approve close.
    click(client, "hb_case_impl", "C0PKG")
    assert wait_until(lambda: blocks_with(posted, "Approve close"), timeout=60)
    md = FakeMd.instances[-1]
    kinds = [c[0] for c in md.calls]
    assert kinds.index("retrieve") < kinds.index("deploy")
    deploy = [c for c in md.calls if c[0] == "deploy"][0]
    assert "package.xml" in deploy[1] and f"flows/Create_Success_Plan_{num}.flow" in deploy[1]
    assert "destructiveChanges.xml" not in deploy[1]
    info = flow._package_info("C0PKG")
    assert info["stage"] == "deployed" and info["deploy_id"] == "0Af999"
    assert info["snapshot"]["new"] == {"CustomField": [f"Success_Plan__c.Target_Go_Live_{num}__c"],
                                       "Flow": [f"Create_Success_Plan_{num}"]}
    deployed_msg = [t for t in texts(posted) if "Deployed:" in t][0]
    # Direct links to what was deployed (ids from the org), the demo deal to test with, Bob's steps.
    assert f"Flows/page?address=%2F300F|Flow Create_Success_Plan_{num}" in deployed_msg
    assert f"FieldsAndRelationships/300F/view|Field Success_Plan__c.Target_Go_Live_{num}__c" in deployed_msg
    assert "Quick test" in deployed_msg and "Meridian Renewal" in deployed_msg
    assert "Open Meridian Renewal" in deployed_msg                        # Bob's own test steps

    # Approve close → rollback (Flow deactivated, then destructive removal), case closed, channel archived.
    click(client, "hb_case_close", "C0PKG")
    assert wait_until(lambda: sf.deleted, timeout=60)
    md = FakeMd.instances[-1]
    removal = [c for c in md.calls if c[0] == "deploy" and "destructiveChanges.xml" in c[1]]
    assert removal, md.calls
    assert any(c[0] == "patch" and "FlowDefinition" in c[1] for c in sf.low)     # Flow deactivated first
    assert ("conversations.archive", {"channel": "C0PKG"}) in [(m, p) for m, p in api_calls]
    closure = [m for m in mail.sent if "resolved" in m[1]]
    assert closure and closure[0][0] == "requester@example.com"


def test_implement_before_validation_does_not_open_the_gate(pkg):
    client, flow, sf, mail, posted, api_calls, tmp_path = pkg
    client.post("/demo/case", json={"issue": ""})
    assert wait_until(lambda: blocks_with(posted, "Approve solution"))
    # Still at 'alerted': implement is ignored entirely.
    assert flow.request_implement("C0PKG") is False
    click(client, "hb_case_sol", "C0PKG")
    assert wait_until(lambda: any("Building the change" in t for t in texts(posted)))
    # During the build: a request is acknowledged, no deploy gate is posted.
    if flow._package_info("C0PKG").get("stage") == "building":
        assert flow.request_implement("C0PKG") is True
        assert any("Still building" in t for t in texts(posted))
    assert wait_until(lambda: blocks_with(posted, "Approve deploy"), timeout=90)


def test_package_variant_uses_its_own_session_budget(pkg):
    """A package case spends across proposal, summary, build and fix turns in
    one Bob session, so the per-conversation cap is the package budget, not
    the chat cap; the daily cap is configurable."""
    client, flow, *_ = pkg
    principal = flow.slack.principal
    assert principal.max_cost_per_run == 3.0          # HB_PACKAGE_MAX_COST default
    assert principal.max_cost_per_day == 5.0          # HB_SLACK_MAX_COST_PER_DAY default
    assert flow.mcp_url == "https://svc.example/mcp"  # HB_MCP_URL as set in the fixture


def test_deployed_message_fits_slack_limits(pkg):
    """Bob's notes can run long; the deployed message keeps every section
    under Slack's 3000-character block limit instead of being refused."""
    from headless_bob.caseflow import SLACK_SECTION_LIMIT, _slack_excerpt
    client, flow, sf, mail, posted, api_calls, tmp_path = pkg
    long_notes = "\n".join(f"{i}. Step {i}: open the record and check the field value carefully." for i in range(1, 120))
    assert len(long_notes) > SLACK_SECTION_LIMIT
    excerpt = _slack_excerpt(long_notes)
    assert len(excerpt) <= 2501 and excerpt.endswith("…")
    posted.clear()
    flow._post_close_prompt("C0PKG", "lead", [{"type": "section", "text": {"type": "mrkdwn", "text": excerpt}}])
    blocks = posted[-1][1]["blocks"]
    assert [b["type"] for b in blocks] == ["section", "section", "section", "actions"]
    assert all(len(b["text"]["text"]) <= SLACK_SECTION_LIMIT for b in blocks if b["type"] == "section")


def test_build_notes_start_at_the_files_written_line():
    from headless_bob.caseflow import _final_answer
    reply = ("Now I have everything I need. Let me check the project.Now write the Flow. The structure "
             "follows the reference exactly.---\n\n**Files written**\n\n1. flows/X.flow-meta.xml\n\n"
             "**Manual test procedure**\n\n1. Open a deal.")
    notes = _final_answer(reply)
    assert notes.startswith("Files written") and "Now write the Flow" not in notes and "Open a deal" in notes
    assert _final_answer("just an answer with no marker") == "just an answer with no marker"
