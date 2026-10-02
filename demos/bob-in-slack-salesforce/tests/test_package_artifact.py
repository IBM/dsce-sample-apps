"""Package artifact: source→metadata conversion, allowlist, snapshot, rollback order."""
import base64
import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from headless_bob import package_artifact as pa  # noqa: E402
from headless_bob.metadata_api import MD_NS, DeployResult, build_zip, package_xml  # noqa: E402

FLOW = f'<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="{MD_NS}"><label>Create Plan</label><status>Active</status></Flow>'
FIELD = f'<?xml version="1.0" encoding="UTF-8"?><CustomField xmlns="{MD_NS}"><fullName>Go_Live__c</fullName><label>Go Live</label><type>Date</type></CustomField>'
RULE = f'<?xml version="1.0" encoding="UTF-8"?><ValidationRule xmlns="{MD_NS}"><fullName>Needs_Desc</fullName><active>true</active><errorConditionFormula>ISBLANK(Description)</errorConditionFormula><errorMessage>Add a description</errorMessage></ValidationRule>'
LABELS = f'<?xml version="1.0" encoding="UTF-8"?><CustomLabels xmlns="{MD_NS}"><labels><fullName>Hello</fullName><value>hi</value></labels></CustomLabels>'
META = f'<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="{MD_NS}"><apiVersion>60.0</apiVersion><status>Active</status></ApexClass>'


def write(ws: Path, rel: str, text: str) -> None:
    p = ws / "force-app" / "main" / "default" / rel
    p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)


def test_collect_converts_source_layout_to_a_package(tmp_path):
    write(tmp_path, "flows/Create_Plan.flow-meta.xml", FLOW)
    write(tmp_path, "objects/Success_Plan__c/fields/Go_Live__c.field-meta.xml", FIELD)
    write(tmp_path, "objects/Opportunity/validationRules/Needs_Desc.validationRule-meta.xml", RULE)
    write(tmp_path, "classes/PlanService.cls", "public class PlanService {}")
    write(tmp_path, "classes/PlanService.cls-meta.xml", META)
    write(tmp_path, "classes/PlanServiceTest.cls", "@isTest private class PlanServiceTest {}")
    write(tmp_path, "classes/PlanServiceTest.cls-meta.xml", META)
    write(tmp_path, "labels/CustomLabels.labels-meta.xml", LABELS)
    pkg = pa.collect(tmp_path)
    assert pkg.problems == []
    assert pkg.members == {"Flow": ["Create_Plan"], "CustomField": ["Success_Plan__c.Go_Live__c"],
                           "ValidationRule": ["Opportunity.Needs_Desc"], "ApexClass": ["PlanService", "PlanServiceTest"],
                           "CustomLabel": ["Hello"]}
    assert pkg.apex_tests == ["PlanServiceTest"]
    assert set(pkg.files) == {"flows/Create_Plan.flow", "objects/Success_Plan__c.object", "objects/Opportunity.object",
                              "classes/PlanService.cls", "classes/PlanService.cls-meta.xml",
                              "classes/PlanServiceTest.cls", "classes/PlanServiceTest.cls-meta.xml", "labels/CustomLabels.labels"}
    obj = pkg.files["objects/Success_Plan__c.object"]
    assert "<fields><fullName>Go_Live__c</fullName>" in obj and "<CustomField" not in obj   # re-rooted
    assert "<validationRules><fullName>Needs_Desc</fullName>" in pkg.files["objects/Opportunity.object"]
    names = zipfile.ZipFile(io.BytesIO(pkg.zip())).namelist()
    assert "package.xml" in names and "flows/Create_Plan.flow" in names
    assert pkg.summary() == ["ApexClass: PlanService", "ApexClass: PlanServiceTest (test)", "CustomField: Success_Plan__c.Go_Live__c",
                             "CustomLabel: Hello", "Flow: Create_Plan", "ValidationRule: Opportunity.Needs_Desc"]


def test_collect_reports_problems_instead_of_dropping_files(tmp_path):
    write(tmp_path, "flows/Bad.flow-meta.xml", "<Flow><unclosed>")
    write(tmp_path, "profiles/Admin.profile-meta.xml", "<Profile/>")
    write(tmp_path, "objects/Acme__c/fields/X__c.field-meta.xml", FIELD)
    pkg = pa.collect(tmp_path, allowed=("Flow",))
    assert any("not well-formed" in p for p in pkg.problems)
    assert any("profiles/Admin.profile-meta.xml: unsupported" in p for p in pkg.problems)
    assert any("CustomField is not an allowed type" in p for p in pkg.problems)
    assert pkg.members == {}
    assert pa.collect(tmp_path / "nowhere").problems[0].startswith("no force-app")
    empty = tmp_path / "empty"; (empty / "force-app/main/default").mkdir(parents=True)
    assert "no deployable components" in pa.collect(empty).problems[0]


class FakeMd:
    def __init__(self, retrieved: bytes, results=None):
        self.retrieved, self.calls = retrieved, []
        self.results = list(results or [])

    def retrieve(self, members):
        self.calls.append(("retrieve", members)); return self.retrieved

    def validate(self, package, **kw):
        self.calls.append(("validate", kw)); return DeployResult({"done": True, "success": True, "status": "Succeeded"})

    def deploy_and_wait(self, package, **kw):
        z = zipfile.ZipFile(io.BytesIO(package))
        self.calls.append(("deploy", sorted(z.namelist()), kw))
        return self.results.pop(0) if self.results else DeployResult({"done": True, "success": True, "status": "Succeeded"})


class FakeClient:
    def __init__(self): self.calls = []
    def _get(self, path, **params):
        self.calls.append(("get", path, params)); return {"records": [{"Id": "300FLOW"}]}
    def _patch(self, path, body): self.calls.append(("patch", path, body))
    def _soql(self, q): self.calls.append(("soql", q)); return [{"Id": "0FlowInterview"}]
    def _delete(self, path): self.calls.append(("delete", path))


def test_snapshot_separates_existing_from_new(tmp_path):
    write(tmp_path, "flows/Create_Plan.flow-meta.xml", FLOW)
    write(tmp_path, "flows/Old_Flow.flow-meta.xml", FLOW)
    write(tmp_path, "objects/Success_Plan__c/fields/Go_Live__c.field-meta.xml", FIELD)
    write(tmp_path, "objects/Success_Plan__c/fields/Renewal_Date__c.field-meta.xml", FIELD.replace("Go_Live__c", "Renewal_Date__c"))
    pkg = pa.collect(tmp_path)
    retrieved = build_zip({
        "package.xml": package_xml({"Flow": ["Old_Flow"], "CustomField": ["Success_Plan__c.Renewal_Date__c"]}),
        "flows/Old_Flow.flow": FLOW,
        "objects/Success_Plan__c.object": f'<CustomObject xmlns="{MD_NS}"><fields><fullName>Renewal_Date__c</fullName></fields></CustomObject>'})
    md = FakeMd(retrieved)
    snap = pa.snapshot(md, pkg)
    assert snap["existing"] == {"Flow": ["Old_Flow"], "CustomField": ["Success_Plan__c.Renewal_Date__c"]}
    assert snap["new"] == {"Flow": ["Create_Plan"], "CustomField": ["Success_Plan__c.Go_Live__c"]}
    assert base64.b64decode(snap["zip_b64"]) == retrieved


def test_check_runs_apex_tests_only_when_present(tmp_path):
    write(tmp_path, "flows/F.flow-meta.xml", FLOW)
    md = FakeMd(b"")
    pa.check(md, pa.collect(tmp_path))
    assert md.calls[-1] == ("validate", {})
    write(tmp_path, "classes/T.cls", "@isTest class T {}"); write(tmp_path, "classes/T.cls-meta.xml", META)
    pa.check(md, pa.collect(tmp_path))
    assert md.calls[-1] == ("validate", {"test_level": "RunSpecifiedTests", "run_tests": ["T"]})


def test_rollback_restores_then_removes_with_flows_deactivated_first():
    snap = {"existing": {"CustomField": ["Obj.Old__c"]}, "new": {"Flow": ["New_Flow"], "CustomField": ["Obj.New__c"]},
            "zip_b64": base64.b64encode(build_zip({"package.xml": package_xml({"CustomField": ["Obj.Old__c"]}),
                                                   "objects/Obj.object": "<CustomObject/>"})).decode()}
    md, client = FakeMd(b""), FakeClient()
    assert pa.rollback(md, client, snap) == []
    kinds = [c[0] for c in md.calls]
    assert kinds == ["deploy", "deploy"]                                   # restore, then remove the field
    assert md.calls[0][1] == ["objects/Obj.object", "package.xml"]          # the snapshot went back first
    assert "destructiveChanges.xml" in md.calls[1][1]
    # The Flow never goes through a destructive deploy: deactivate, clear stuck interviews, delete versions.
    assert ("patch", "/services/data/v60.0/tooling/sobjects/FlowDefinition/300FLOW", {"Metadata": {"activeVersionNumber": 0}}) in client.calls
    assert any(c[0] == "delete" and "FlowInterview" in c[1] for c in client.calls)   # stuck interviews cleared
    assert ("delete", "/services/data/v60.0/tooling/sobjects/Flow/300FLOW") in client.calls
    failing = FakeMd(b"", results=[DeployResult({"done": True, "success": False, "status": "Failed",
                                                 "details": {"componentFailures": [{"fileName": "x", "problem": "nope"}]}})])
    assert pa.rollback(failing, FakeClient(), {"existing": {}, "new": {"CustomLabel": ["L"]}, "zip_b64": ""}) == ["remove CustomLabel: x: nope"]


def test_rollback_removes_references_before_what_they_reference():
    """A field cannot be deleted while a class still uses it: one destructive
    deploy per type, code first, fields and labels last."""
    class OrderMd(FakeMd):
        def deploy_and_wait(self, package, **kw):
            manifest = zipfile.ZipFile(io.BytesIO(package)).read("destructiveChanges.xml").decode()
            self.calls.append(("remove", next(t for t in pa._REMOVE_ORDER if f"<name>{t}</name>" in manifest)))
            return DeployResult({"done": True, "success": True, "status": "Succeeded"})
    md = OrderMd(b"")
    new = {"CustomLabel": ["L"], "CustomField": ["Obj.F__c"], "ApexClass": ["Svc"], "ApexTrigger": ["Trg"], "ValidationRule": ["Obj.R"]}
    assert pa.rollback(md, FakeClient(), {"existing": {}, "new": new, "zip_b64": ""}) == []
    assert [c[1] for c in md.calls] == ["ApexTrigger", "ApexClass", "ValidationRule", "CustomField", "CustomLabel"]
    assert pa.rollback(FakeMd(b""), FakeClient(), {"existing": {}, "new": {"Profile": ["Admin"]}, "zip_b64": ""}) == ["remove: no removal path for Profile"]


def test_check_turns_a_rejection_into_a_failed_result(tmp_path):
    from headless_bob.metadata_api import PackageRejected

    class RejectingMd:
        def validate(self, package, **kw):
            raise PackageRejected(["package rejected (XML_PARSER_ERROR): bad element"])
    write(tmp_path, "flows/Create_Plan.flow-meta.xml", FLOW)
    result = pa.check(RejectingMd(), pa.collect(tmp_path))
    assert result.done and not result.success
    assert result.problems() == ["package rejected (XML_PARSER_ERROR): bad element"]
