"""Metadata API layer: package building, deploy/status plumbing, result parsing."""
import io
import json
import sys
import zipfile
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from headless_bob.metadata_api import DeployResult, MetadataApi, build_zip, destructive_zip, package_xml  # noqa: E402
from headless_bob.salesforce import SalesforceClient  # noqa: E402


def client(monkeypatch, responder):
    c = SalesforceClient("https://login.example", "cid", "user@example.com", "key")
    c._token, c._instance, c._token_at = "tok", "https://inst.example", 10**12
    monkeypatch.setattr(httpx, "request", lambda method, url, **kw: responder(method, url, kw))
    return c


def test_package_xml_and_zip_are_deterministic():
    xml = package_xml({"Flow": ["B_Flow", "A_Flow"], "CustomField": ["Obj__c.F__c"]})
    assert xml.index("CustomField") < xml.index("Flow")            # types sorted
    assert xml.index("A_Flow") < xml.index("B_Flow")               # members sorted
    assert "<version>60.0</version>" in xml
    z = zipfile.ZipFile(io.BytesIO(build_zip({"package.xml": xml, "flows/A_Flow.flow": "<Flow/>"})))
    assert z.namelist() == ["flows/A_Flow.flow", "package.xml"]
    d = zipfile.ZipFile(io.BytesIO(destructive_zip({"Flow": ["A_Flow"]})))
    assert set(d.namelist()) == {"package.xml", "destructiveChanges.xml"}
    assert "<members>A_Flow</members>" in d.read("destructiveChanges.xml").decode()
    assert "<members>" not in d.read("package.xml").decode()      # empty manifest


def test_deploy_posts_multipart_and_polls_until_done(monkeypatch):
    seen = []
    polls = {"n": 0}

    def responder(method, url, kw):
        seen.append((method, url))
        if method == "POST" and url.endswith("/metadata/deployRequest"):
            files = kw["files"]
            assert json.loads(files["json"][1])["deployOptions"] == {
                "checkOnly": True, "singlePackage": True, "rollbackOnError": True,
                "testLevel": "RunSpecifiedTests", "runTests": ["MyTest"]}
            assert files["file"][0] == "package.zip"
            return httpx.Response(201, json={"id": "0Af123"}, request=httpx.Request(method, url))
        if method == "GET" and "/metadata/deployRequest/0Af123" in url:
            polls["n"] += 1
            done = polls["n"] >= 2
            return httpx.Response(200, request=httpx.Request(method, url), json={"deployResult": {
                "id": "0Af123", "done": done, "success": done, "status": "Succeeded" if done else "InProgress",
                "details": {"runTestResult": {"numTestsRun": 1, "failures": []}, "componentFailures": []}}})
        raise AssertionError(f"unexpected {method} {url}")
    md = MetadataApi(client(monkeypatch, responder))
    monkeypatch.setattr("headless_bob.metadata_api.time.sleep", lambda s: None)
    result = md.validate(build_zip({"package.xml": package_xml({})}), test_level="RunSpecifiedTests", run_tests=["MyTest"])
    assert result.success and result.done and result.tests_run == 1 and result.problems() == []
    assert polls["n"] == 2


def test_deploy_result_problems_are_readable():
    r = DeployResult({"done": True, "success": False, "status": "Failed", "details": {
        "componentFailures": {"fileName": "flows/X.flow", "lineNumber": 12, "problem": "Element bad invalid"},
        "runTestResult": {"numTestsRun": 2, "failures": [{"name": "T", "methodName": "m", "message": "assert failed"}]}}})
    assert r.problems() == ["flows/X.flow line 12: Element bad invalid", "test T.m: assert failed"]
    assert DeployResult({"done": True, "success": False, "errorMessage": "boom"}).problems() == ["boom"]


def test_describe_is_compact(monkeypatch):
    def responder(method, url, kw):
        assert url.endswith("/sobjects/Acme__c/describe")
        return httpx.Response(200, request=httpx.Request(method, url), json={
            "name": "Acme__c", "label": "Acme", "custom": True, "recordTypeInfos": [{"name": "Master"}],
            "fields": [{"name": "Name", "label": "Name", "type": "string", "length": 80, "nillable": False, "defaultedOnCreate": True, "custom": False,
                        "autoNumber": True, "createable": False, "updateable": False},
                       {"name": "Tier__c", "label": "Tier", "type": "picklist", "nillable": True, "custom": True,
                        "picklistValues": [{"value": "Gold", "active": True}, {"value": "Old", "active": False}]},
                       {"name": "Owner__c", "label": "Owner", "type": "reference", "nillable": False, "custom": True, "referenceTo": ["User"], "length": 18}]})
    d = MetadataApi(client(monkeypatch, responder)).describe_object("Acme__c")
    assert d["fields"][1]["picklistValues"] == ["Gold"]
    assert d["fields"][2]["required"] is True and d["fields"][2]["referenceTo"] == ["User"]
    assert d["fields"][0]["required"] is False               # defaulted on create
    assert d["fields"][0]["writable"] is False and d["fields"][0]["autoNumber"] is True   # Salesforce sets it
    assert d["fields"][1]["writable"] is False and "autoNumber" not in d["fields"][1]     # fake omits createable


def test_immediate_rejection_is_a_package_problem(monkeypatch):
    from headless_bob.metadata_api import PackageRejected

    def responder(method, url, kw):
        return httpx.Response(400, request=httpx.Request(method, url), json=[
            {"message": "Element {ns}customNotifications invalid at this location in type Flow",
             "errorCode": "XML_PARSER_ERROR"}])
    md = MetadataApi(client(monkeypatch, responder))
    try:
        md.validate(build_zip({"package.xml": package_xml({})}))
        raise AssertionError("expected PackageRejected")
    except PackageRejected as exc:
        assert exc.problems == ["package rejected (XML_PARSER_ERROR): Element {ns}customNotifications invalid at this location in type Flow"]
    r = DeployResult.rejected(["a", "b"])
    assert r.done and not r.success and r.status == "Failed" and r.problems() == ["a", "b"]


def test_other_http_failures_stay_transport_errors(monkeypatch):
    from headless_bob.metadata_api import PackageRejected
    from headless_bob.salesforce import SalesforceError

    def responder(method, url, kw):
        return httpx.Response(503, request=httpx.Request(method, url), text="Service Unavailable")
    md = MetadataApi(client(monkeypatch, responder))
    try:
        md.deploy(b"zip", check_only=True)
        raise AssertionError("expected SalesforceError")
    except PackageRejected:
        raise AssertionError("a 503 is not a package problem")
    except SalesforceError as exc:
        assert "503" in str(exc)
