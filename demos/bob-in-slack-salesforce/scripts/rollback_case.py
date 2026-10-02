#!/usr/bin/env python3
"""Remove the components a package case deployed, by case number.

The service rolls a case back on close. If the service lost its database
before that (a redeploy on a platform with ephemeral disk, a crash), the
snapshot is gone and the components stay in the org. Every component the
package variant creates ends with `_<case number>`, so they can be found
and removed without the snapshot. Flows go through the Tooling API, fields
through destructive deploys, in the order the org requires.

    set -a; source .env; set +a
    ./.venv/bin/python scripts/rollback_case.py 1278          # list, then ask
    ./.venv/bin/python scripts/rollback_case.py 1278 --yes    # no prompt

Only components that were NEW in the case are handled this way. A case that
modified something pre-existing needs the snapshot the service kept.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from headless_bob import package_artifact  # noqa: E402
from headless_bob.metadata_api import MetadataApi  # noqa: E402
from headless_bob.salesforce import SalesforceClient  # noqa: E402

TOOLING = "/services/data/v60.0/tooling"


def find(sf: SalesforceClient, case: str) -> dict[str, list[str]]:
    suffix = f"_{case}"
    like = f"%{suffix}"
    new: dict[str, list[str]] = {}
    flows = sf._get(f"{TOOLING}/query", q=f"SELECT DeveloperName FROM FlowDefinition WHERE DeveloperName LIKE '{like}'").get("records", [])
    if flows:
        new["Flow"] = [r["DeveloperName"] for r in flows]
    fields = sf._get(f"{TOOLING}/query", q=f"SELECT DeveloperName, TableEnumOrId FROM CustomField WHERE DeveloperName LIKE '{like}'").get("records", [])
    if fields:
        # TableEnumOrId is the API name for a standard object but the object's
        # Id (01I...) for a custom one; the Metadata API wants the API name.
        names = []
        for r in fields:
            table = r["TableEnumOrId"]
            if table.startswith("01I"):
                obj = sf._get(f"{TOOLING}/query", q=f"SELECT DeveloperName FROM CustomObject WHERE Id = '{table}'").get("records", [])
                table = f"{obj[0]['DeveloperName']}__c" if obj else table
            names.append(f"{table}.{r['DeveloperName']}__c")
        new["CustomField"] = names
    classes = sf._get(f"{TOOLING}/query", q=f"SELECT Name FROM ApexClass WHERE Name LIKE '{like}' OR Name LIKE '{like}Test' OR Name LIKE '{like}_Test'").get("records", [])
    if classes:
        new["ApexClass"] = [r["Name"] for r in classes]
    rules = sf._get(f"{TOOLING}/query", q=f"SELECT ValidationName, EntityDefinition.QualifiedApiName FROM ValidationRule WHERE ValidationName LIKE '{like}'").get("records", [])
    if rules:
        new["ValidationRule"] = [f"{r['EntityDefinition']['QualifiedApiName']}.{r['ValidationName']}" for r in rules]
    return new


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1 or not re.fullmatch(r"\d{1,8}", args[0]):
        print(__doc__); return 2
    case = args[0].lstrip("0") or args[0]
    sf = SalesforceClient.from_env(dict(os.environ))
    new = find(sf, case)
    if not new:
        print(f"nothing in the org ends with _{case}"); return 0
    print(f"components ending with _{case}:")
    for mtype, names in new.items():
        for name in names:
            print(f"  {mtype}: {name}")
    if "--yes" not in argv:
        if input("remove all of these? [y/N] ").strip().lower() != "y":
            print("aborted"); return 1
    issues = package_artifact.rollback(MetadataApi(sf), sf, {"existing": {}, "new": new, "zip_b64": ""})
    if issues:
        print("issues:"); [print("  -", i) for i in issues]; return 1
    left = find(sf, case)
    print("removed; remaining:", left or "none")
    return 0 if not left else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
