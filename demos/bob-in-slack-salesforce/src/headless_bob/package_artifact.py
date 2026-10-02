"""The change Bob designs, as a Salesforce metadata package the service deploys.

Bob writes source-format metadata into its workspace (the SFDX layout its
Salesforce skills know: force-app/main/default/...). This module turns that
into a deployable package and drives it through the gate:

    collect   -> Package (metadata-format files + manifest), shape problems
    check     -> Metadata API validation (checkOnly) with tests
    snapshot  -> what already exists in the org, retrieved for rollback
    deploy    -> the real deployment, on approval
    rollback  -> restore the snapshot, remove what was new (Flows via Tooling)

Only allowlisted metadata types are accepted; anything else is a problem,
never silently dropped. The service never interprets the change itself.
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

from .metadata_api import MD_NS, DeployResult, MetadataApi, PackageRejected, build_zip, destructive_zip, package_xml

ALLOWED_TYPES = ("Flow", "ApexClass", "ApexTrigger", "CustomField", "ValidationRule", "CustomLabel")
MAX_FILES = 40
MAX_BYTES = 2 * 1024 * 1024
SOURCE_ROOT = Path("force-app") / "main" / "default"
_NAME = r"[A-Za-z][A-Za-z0-9_]*"


@dataclass
class Package:
    files: dict[str, str] = field(default_factory=dict)      # metadata-format path -> content
    members: dict[str, list[str]] = field(default_factory=dict)  # type -> member names
    sources: list[str] = field(default_factory=list)          # workspace-relative source files
    apex_tests: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.members

    def zip(self) -> bytes:
        return build_zip({"package.xml": package_xml(self.members), **self.files})

    def summary(self) -> list[str]:
        """One line per component, for the approval message."""
        lines = []
        for mtype in sorted(self.members):
            for name in sorted(self.members[mtype]):
                tag = " (test)" if mtype == "ApexClass" and name in self.apex_tests else ""
                lines.append(f"{mtype}: {name}{tag}")
        return lines


def _add(pkg: Package, mtype: str, name: str) -> None:
    pkg.members.setdefault(mtype, [])
    if name not in pkg.members[mtype]:
        pkg.members[mtype].append(name)


def _parse(text: str, where: str, pkg: Package) -> ET.Element | None:
    try:
        return ET.fromstring(text)
    except ET.ParseError as exc:
        pkg.problems.append(f"{where}: not well-formed XML ({exc})")
        return None


def _inner(root: ET.Element) -> str:
    """Serialize the children of `root` (no namespace prefixes)."""
    ET.register_namespace("", MD_NS)
    out = []
    for child in root:
        out.append(ET.tostring(child, encoding="unicode").replace(f' xmlns="{MD_NS}"', ""))
    return "".join(out)


def collect(workspace: Path, allowed: tuple[str, ...] = ALLOWED_TYPES) -> Package:
    """Read Bob's source-format files and produce a metadata-format package."""
    pkg = Package()
    root = workspace / SOURCE_ROOT
    if not root.is_dir():
        pkg.problems.append(f"no {SOURCE_ROOT} directory in the workspace — nothing was built")
        return pkg
    objects: dict[str, dict[str, list[str]]] = {}   # object -> {"fields": [xml...], "validationRules": [...]}
    total = 0
    paths = sorted(p for p in root.rglob("*") if p.is_file() and not any(part.startswith(".") for part in p.relative_to(root).parts))
    if len(paths) > MAX_FILES:
        pkg.problems.append(f"{len(paths)} files exceed the limit of {MAX_FILES}")
        return pkg
    for path in paths:
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        total += len(text)
        pkg.sources.append((SOURCE_ROOT / rel).as_posix())
        m = re.fullmatch(rf"flows/({_NAME})\.flow-meta\.xml", rel)
        if m:
            if "Flow" in allowed and _parse(text, rel, pkg) is not None:
                _add(pkg, "Flow", m.group(1)); pkg.files[f"flows/{m.group(1)}.flow"] = text
            elif "Flow" not in allowed:
                pkg.problems.append(f"{rel}: Flow is not an allowed type here")
            continue
        m = re.fullmatch(rf"classes/({_NAME})\.cls(-meta\.xml)?", rel)
        if m:
            if "ApexClass" not in allowed:
                pkg.problems.append(f"{rel}: ApexClass is not an allowed type here"); continue
            name = m.group(1)
            if m.group(2):
                if _parse(text, rel, pkg) is not None:
                    pkg.files[f"classes/{name}.cls-meta.xml"] = text
            else:
                _add(pkg, "ApexClass", name); pkg.files[f"classes/{name}.cls"] = text
                if re.search(r"@isTest", text, re.I):
                    pkg.apex_tests.append(name)
            continue
        m = re.fullmatch(rf"triggers/({_NAME})\.trigger(-meta\.xml)?", rel)
        if m:
            if "ApexTrigger" not in allowed:
                pkg.problems.append(f"{rel}: ApexTrigger is not an allowed type here"); continue
            name = m.group(1)
            if m.group(2):
                if _parse(text, rel, pkg) is not None:
                    pkg.files[f"triggers/{name}.trigger-meta.xml"] = text
            else:
                _add(pkg, "ApexTrigger", name); pkg.files[f"triggers/{name}.trigger"] = text
            continue
        m = re.fullmatch(rf"objects/({_NAME})/fields/({_NAME})\.field-meta\.xml", rel)
        if m:
            if "CustomField" not in allowed:
                pkg.problems.append(f"{rel}: CustomField is not an allowed type here"); continue
            el = _parse(text, rel, pkg)
            if el is not None:
                obj, fld = m.groups()
                _add(pkg, "CustomField", f"{obj}.{fld}")
                objects.setdefault(obj, {}).setdefault("fields", []).append(_inner(el))
            continue
        m = re.fullmatch(rf"objects/({_NAME})/validationRules/({_NAME})\.validationRule-meta\.xml", rel)
        if m:
            if "ValidationRule" not in allowed:
                pkg.problems.append(f"{rel}: ValidationRule is not an allowed type here"); continue
            el = _parse(text, rel, pkg)
            if el is not None:
                obj, rule = m.groups()
                _add(pkg, "ValidationRule", f"{obj}.{rule}")
                objects.setdefault(obj, {}).setdefault("validationRules", []).append(_inner(el))
            continue
        if rel == "labels/CustomLabels.labels-meta.xml":
            if "CustomLabel" not in allowed:
                pkg.problems.append(f"{rel}: CustomLabel is not an allowed type here"); continue
            el = _parse(text, rel, pkg)
            if el is not None:
                for label in el.findall(f"{{{MD_NS}}}labels/{{{MD_NS}}}fullName"):
                    _add(pkg, "CustomLabel", label.text or "")
                pkg.files["labels/CustomLabels.labels"] = text
            continue
        pkg.problems.append(f"{rel}: unsupported file (allowed: {', '.join(allowed)})")
    for obj, parts in objects.items():
        body = "".join(f"<fields>{x}</fields>" for x in parts.get("fields", []))
        body += "".join(f"<validationRules>{x}</validationRules>" for x in parts.get("validationRules", []))
        pkg.files[f"objects/{obj}.object"] = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
                                              f'<CustomObject xmlns="{MD_NS}">{body}</CustomObject>\n')
    if total > MAX_BYTES:
        pkg.problems.append(f"package is {total // 1024} KB, over the {MAX_BYTES // 1024} KB limit")
    if not pkg.members and not pkg.problems:
        pkg.problems.append("no deployable components found under force-app/main/default")
    return pkg


def check(md: MetadataApi, pkg: Package) -> DeployResult:
    """Validate against the org without changing it. Apex tests Bob wrote run
    here; a package without Apex validates without tests."""
    try:
        if pkg.apex_tests:
            return md.validate(pkg.zip(), test_level="RunSpecifiedTests", run_tests=pkg.apex_tests)
        return md.validate(pkg.zip())
    except PackageRejected as exc:
        return DeployResult.rejected(exc.problems)


def _existing_members(retrieved: bytes, members: dict[str, list[str]]) -> dict[str, list[str]]:
    """Which requested members the org already had, judged from the retrieve zip."""
    zf = zipfile.ZipFile(io.BytesIO(retrieved))
    names = set(zf.namelist())
    found: dict[str, list[str]] = {}

    def has(mtype: str, name: str) -> bool:
        if mtype == "Flow":
            return f"flows/{name}.flow" in names
        if mtype == "ApexClass":
            return f"classes/{name}.cls" in names
        if mtype == "ApexTrigger":
            return f"triggers/{name}.trigger" in names
        if mtype in ("CustomField", "ValidationRule"):
            obj, _, item = name.partition(".")
            path = f"objects/{obj}.object"
            if path not in names:
                return False
            tag = "fields" if mtype == "CustomField" else "validationRules"
            root = ET.fromstring(zf.read(path))
            return any((e.findtext(f"{{{MD_NS}}}fullName") or "") == item for e in root.findall(f"{{{MD_NS}}}{tag}"))
        if mtype == "CustomLabel":
            if "labels/CustomLabels.labels" not in names:
                return False
            root = ET.fromstring(zf.read("labels/CustomLabels.labels"))
            return any((e.findtext(f"{{{MD_NS}}}fullName") or "") == name for e in root.findall(f"{{{MD_NS}}}labels"))
        return False

    for mtype, items in members.items():
        for name in items:
            if has(mtype, name):
                found.setdefault(mtype, []).append(name)
    return found


def snapshot(md: MetadataApi, pkg: Package) -> dict:
    """Retrieve the org's current version of everything the package touches.
    Returns {existing, new, zip_b64, manifest}; rollback needs exactly this."""
    retrieved = md.retrieve(pkg.members)
    existing = _existing_members(retrieved, pkg.members)
    new = {t: [n for n in names if n not in existing.get(t, [])] for t, names in pkg.members.items()}
    new = {t: n for t, n in new.items() if n}
    return {"existing": existing, "new": new, "zip_b64": base64.b64encode(retrieved).decode(),
            "manifest": pkg.members}


def deploy(md: MetadataApi, pkg: Package) -> DeployResult:
    if pkg.apex_tests:
        return md.deploy_and_wait(pkg.zip(), test_level="RunSpecifiedTests", run_tests=pkg.apex_tests)
    return md.deploy_and_wait(pkg.zip())


_TOOLING = "/services/data/v60.0/tooling"
# Removal order for destructive deploys: what references must go before what is
# referenced. A field cannot be deleted while a class or rule still uses it.
_REMOVE_ORDER = ("ApexTrigger", "ApexClass", "ValidationRule", "CustomField", "CustomLabel")


def _remove_flows(client, names: list[str]) -> list[str]:
    """Flows leave through the Tooling API: deactivate the definition, clear
    stuck interviews, delete every version. A destructive deploy refuses a
    Flow that was ever active ("insufficient access rights on cross-reference
    id"), so this is the path that works; verified 2026-09-24."""
    issues = []
    for name in names:
        try:
            defs = client._get(f"{_TOOLING}/query", q=f"SELECT Id FROM FlowDefinition WHERE DeveloperName = '{name}'").get("records", [])
            for d in defs:
                client._patch(f"{_TOOLING}/sobjects/FlowDefinition/{d['Id']}", {"Metadata": {"activeVersionNumber": 0}})
                stuck = client._soql(f"SELECT Id FROM FlowInterview WHERE InterviewLabel LIKE '{name}%' AND InterviewStatus = 'Error'")
                for row in stuck:
                    client._delete(f"/services/data/v60.0/sobjects/FlowInterview/{row['Id']}")
                versions = client._get(f"{_TOOLING}/query", q=f"SELECT Id FROM Flow WHERE DefinitionId = '{d['Id']}'").get("records", [])
                for v in versions:
                    client._delete(f"{_TOOLING}/sobjects/Flow/{v['Id']}")
        except Exception as exc:
            issues.append(f"remove Flow {name}: {exc}")
    return issues


def rollback(md: MetadataApi, client, snap: dict) -> list[str]:
    """Undo a deployment: restore what existed, remove what was new. Returns
    a list of issues; an empty list means the org is back to the snapshot."""
    issues: list[str] = []
    existing, new = snap.get("existing") or {}, snap.get("new") or {}
    if existing:
        try:
            result = md.deploy_and_wait(base64.b64decode(snap["zip_b64"]))
            if not result.success:
                issues.append("restore: " + "; ".join(result.problems())[:500])
        except Exception as exc:
            issues.append(f"restore: {exc}")
    if new:
        issues += _remove_flows(client, new.get("Flow", []))
        for mtype in _REMOVE_ORDER:          # one destructive deploy per type, references first
            names = new.get(mtype) or []
            if not names:
                continue
            try:
                result = md.deploy_and_wait(destructive_zip({mtype: names}))
                if not result.success:
                    issues.append(f"remove {mtype}: " + "; ".join(result.problems())[:500])
            except Exception as exc:
                issues.append(f"remove {mtype}: {exc}")
    unknown = [t for t in new if t != "Flow" and t not in _REMOVE_ORDER]
    if unknown:
        issues.append(f"remove: no removal path for {', '.join(unknown)}")
    return issues
