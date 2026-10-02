"""Salesforce Metadata API for packages Bob writes: validate, deploy, retrieve.

The service, not Bob, calls this: Bob writes metadata files into its
workspace, the service zips them into a package and asks Salesforce to
validate (checkOnly) or deploy it, and retrieves the pre-deploy state of
anything the package modifies so the change can be rolled back.

Deploy goes through the REST Metadata endpoint (multipart zip + JSON
options); retrieve goes through the SOAP Metadata API, which has no REST
equivalent. All calls reuse the client's JWT session and its 401 retry.
"""

from __future__ import annotations

import base64
import io
import json
import re
import time
import zipfile

import httpx

from .salesforce import API, SalesforceClient, SalesforceError

API_VERSION = "60.0"
MD_NS = "http://soap.sforce.com/2006/04/metadata"


class PackageRejected(SalesforceError):
    """Salesforce refused the package before starting a deployment (malformed
    metadata, an unknown type in package.xml). Bob can fix these; a transport
    or auth failure it cannot, so that stays a plain SalesforceError."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems)[:500])
        self.problems = problems


def package_xml(members: dict[str, list[str]], version: str = API_VERSION) -> str:
    """package.xml for {metadata type: [member names]}; an empty dict is the
    empty manifest that accompanies destructiveChanges.xml."""
    parts = ['<?xml version="1.0" encoding="UTF-8"?>', f'<Package xmlns="{MD_NS}">']
    for mtype in sorted(members):
        parts.append("    <types>")
        for name in sorted(members[mtype]):
            parts.append(f"        <members>{name}</members>")
        parts.append(f"        <name>{mtype}</name>")
        parts.append("    </types>")
    parts.append(f"    <version>{version}</version>")
    parts.append("</Package>")
    return "\n".join(parts) + "\n"


def build_zip(files: dict[str, bytes | str]) -> bytes:
    """Zip metadata-format files ({'package.xml': ..., 'flows/X.flow': ...})."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(files):
            data = files[path]
            zf.writestr(path, data.encode() if isinstance(data, str) else data)
    return buffer.getvalue()


def destructive_zip(members: dict[str, list[str]]) -> bytes:
    """A package that only removes the given components."""
    return build_zip({"package.xml": package_xml({}),
                      "destructiveChanges.xml": package_xml(members)})


class DeployResult(dict):
    @classmethod
    def rejected(cls, problems: list[str]) -> "DeployResult":
        """A failed result for a package Salesforce refused up front."""
        return cls({"done": True, "success": False, "status": "Failed", "rejected": list(problems)})

    @property
    def done(self) -> bool:
        return bool(self.get("done"))

    @property
    def success(self) -> bool:
        return bool(self.get("success"))

    @property
    def status(self) -> str:
        return str(self.get("status", ""))

    @property
    def component_failures(self) -> list[dict]:
        details = self.get("details") or {}
        failures = details.get("componentFailures") or []
        return failures if isinstance(failures, list) else [failures]

    @property
    def test_failures(self) -> list[dict]:
        tests = (self.get("details") or {}).get("runTestResult") or {}
        failures = tests.get("failures") or []
        return failures if isinstance(failures, list) else [failures]

    @property
    def tests_run(self) -> int:
        tests = (self.get("details") or {}).get("runTestResult") or {}
        return int(tests.get("numTestsRun") or 0)

    def problems(self) -> list[str]:
        """Human-readable list of what went wrong, for Slack and for Bob's fix turn."""
        out = [str(p) for p in (self.get("rejected") or [])]
        for f in self.component_failures:
            where = f.get("fileName") or f.get("fullName") or "?"
            line = f" line {f['lineNumber']}" if f.get("lineNumber") else ""
            out.append(f"{where}{line}: {f.get('problem', '')}")
        for f in self.test_failures:
            out.append(f"test {f.get('name', '?')}.{f.get('methodName', '?')}: {f.get('message', '')}")
        if not out and self.get("errorMessage"):
            out.append(str(self["errorMessage"]))
        return out


class MetadataApi:
    def __init__(self, client: SalesforceClient):
        self.client = client

    # -- deploy (REST) -------------------------------------------------------

    def deploy(self, package: bytes, *, check_only: bool, test_level: str = "NoTestRun",
               run_tests: list[str] | None = None) -> str:
        """Start a deployment; returns the deploy request id. Validation only
        when check_only. Salesforce rolls the whole package back on error."""
        options = {"checkOnly": check_only, "singlePackage": True, "rollbackOnError": True,
                   "testLevel": test_level}
        if run_tests:
            options["runTests"] = run_tests
        response = self.client._request(
            "POST", f"{API}/metadata/deployRequest",
            files={"json": (None, json.dumps({"deployOptions": options}), "application/json"),
                   "file": ("package.zip", package, "application/zip")})
        if response.status_code >= 300:
            if 400 <= response.status_code < 500:
                try:
                    errors = response.json()
                except ValueError:
                    errors = None
                if isinstance(errors, list) and errors and all(isinstance(e, dict) and e.get("message") for e in errors):
                    raise PackageRejected([f"package rejected ({e.get('errorCode', 'error')}): {e['message']}" for e in errors])
            raise SalesforceError(f"deploy -> {response.status_code}: {response.text[:300]}")
        return response.json()["id"]

    def deploy_status(self, deploy_id: str) -> DeployResult:
        data = self.client._get(f"{API}/metadata/deployRequest/{deploy_id}", includeDetails="true")
        return DeployResult(data.get("deployResult") or data)

    def wait(self, deploy_id: str, timeout: float = 600, poll: float = 3.0) -> DeployResult:
        deadline = time.monotonic() + timeout
        while True:
            result = self.deploy_status(deploy_id)
            if result.done:
                return result
            if time.monotonic() > deadline:
                raise SalesforceError(f"deploy {deploy_id} still {result.status} after {timeout:.0f}s")
            time.sleep(poll)

    def validate(self, package: bytes, **kw) -> DeployResult:
        return self.wait(self.deploy(package, check_only=True, **kw))

    def deploy_and_wait(self, package: bytes, **kw) -> DeployResult:
        return self.wait(self.deploy(package, check_only=False, **kw))

    # -- retrieve (SOAP) -----------------------------------------------------

    def _soap(self, action: str, body_xml: str, timeout: float = 60) -> str:
        self.client._ensure_token()
        envelope = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
            f'xmlns:met="{MD_NS}">'
            f'<soapenv:Header><met:SessionHeader><met:sessionId>{self.client._token}</met:sessionId>'
            '</met:SessionHeader></soapenv:Header>'
            f'<soapenv:Body>{body_xml}</soapenv:Body></soapenv:Envelope>')
        response = httpx.post(f"{self.client._instance}/services/Soap/m/{API_VERSION}", content=envelope,
                              headers={"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": action},
                              timeout=timeout)
        if response.status_code >= 300 or "<faultstring>" in response.text:
            fault = re.search(r"<faultstring>(.*?)</faultstring>", response.text, re.S)
            raise SalesforceError(f"{action} -> {response.status_code}: {fault.group(1) if fault else response.text[:300]}")
        return response.text

    def retrieve(self, members: dict[str, list[str]], timeout: float = 300) -> bytes:
        """Retrieve the current metadata for {type: [names]} as a zip in
        metadata format; the pre-deploy snapshot for rollback."""
        types_xml = "".join(
            "<met:types>" + "".join(f"<met:members>{n}</met:members>" for n in names)
            + f"<met:name>{t}</met:name></met:types>" for t, names in members.items())
        text = self._soap("retrieve", (
            f"<met:retrieve><met:retrieveRequest><met:apiVersion>{API_VERSION}</met:apiVersion>"
            f"<met:singlePackage>true</met:singlePackage><met:unpackaged>{types_xml}"
            f"<met:version>{API_VERSION}</met:version></met:unpackaged></met:retrieveRequest></met:retrieve>"))
        match = re.search(r"<id>(.*?)</id>", text)
        if not match:
            raise SalesforceError("retrieve: no request id in response")
        request_id = match.group(1)
        deadline = time.monotonic() + timeout
        while True:
            status = self._soap("checkRetrieveStatus",
                                f"<met:checkRetrieveStatus><met:asyncProcessId>{request_id}</met:asyncProcessId>"
                                "<met:includeZip>true</met:includeZip></met:checkRetrieveStatus>")
            if "<done>true</done>" in status:
                zipped = re.search(r"<zipFile>(.*?)</zipFile>", status, re.S)
                if not zipped:
                    raise SalesforceError("retrieve finished without a zip")
                return base64.b64decode(zipped.group(1))
            if time.monotonic() > deadline:
                raise SalesforceError("retrieve timed out")
            time.sleep(3)

    # -- reads used by the org-context MCP server ----------------------------

    def describe_object(self, name: str) -> dict:
        """A compact describe: label, custom flag, and fields with type,
        length, required, writable, references and picklist values."""
        if not re.fullmatch(r"[A-Za-z0-9_]+", name):
            raise SalesforceError(f"bad object name {name!r}")
        d = self.client._get(f"{API}/sobjects/{name}/describe")
        fields = []
        for f in d.get("fields", []):
            entry = {"name": f["name"], "label": f.get("label"), "type": f.get("type"),
                     "required": not f.get("nillable", True) and not f.get("defaultedOnCreate", False),
                     "custom": f.get("custom", False),
                     # A Flow or Apex may only set writable fields; auto-numbers,
                     # formulas and system fields are set by Salesforce.
                     "writable": bool(f.get("createable", False))}
            if f.get("autoNumber"):
                entry["autoNumber"] = True
            if f.get("calculated"):
                entry["formula"] = True
            if f.get("length"):
                entry["length"] = f["length"]
            if f.get("referenceTo"):
                entry["referenceTo"] = f["referenceTo"]
            if f.get("type") == "picklist":
                entry["picklistValues"] = [v["value"] for v in f.get("picklistValues", []) if v.get("active")]
            fields.append(entry)
        return {"name": d.get("name"), "label": d.get("label"), "custom": d.get("custom"),
                "fields": fields, "recordTypeInfos": [r.get("name") for r in d.get("recordTypeInfos", [])]}

    def list_objects(self, custom_only: bool = True) -> list[dict]:
        data = self.client._get(f"{API}/sobjects")
        return [{"name": s["name"], "label": s["label"], "custom": s["custom"]}
                for s in data.get("sobjects", []) if s.get("custom") or not custom_only]

    def list_flows(self) -> list[dict]:
        rows = self.client._get(f"{API}/tooling/query",
                                q="SELECT DeveloperName, ActiveVersionId, LatestVersionId FROM FlowDefinition").get("records", [])
        return [{"name": r["DeveloperName"], "active": bool(r.get("ActiveVersionId"))} for r in rows]

    def query(self, soql: str, limit: int = 50) -> list[dict]:
        """Read-only SOQL; the caller (MCP server) has already screened it."""
        rows = self.client._soql(soql)
        return [{k: v for k, v in r.items() if k != "attributes"} for r in rows[:limit]]
