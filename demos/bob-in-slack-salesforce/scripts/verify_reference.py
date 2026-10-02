#!/usr/bin/env python3
"""Validate every example in the sf-metadata-reference skill against the org.

The skill promises Bob that its examples deploy. This script keeps that
promise testable: it extracts every fenced example whose first line names a
force-app path, writes them into a scratch workspace, and runs the same
collect + checkOnly validation the service runs on Bob's packages. Nothing
is deployed. Run it after editing the skill and after an API version bump.

    set -a; source .env; set +a
    ./.venv/bin/python scripts/verify_reference.py
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from headless_bob import package_artifact  # noqa: E402
from headless_bob.metadata_api import MetadataApi  # noqa: E402
from headless_bob.salesforce import SalesforceClient  # noqa: E402

SKILL_DIR = Path(__file__).resolve().parent.parent / "seeds" / "salesforce" / ".bob" / "skills" / "sf-metadata-reference"
FENCE = re.compile(r"```(?:xml|apex)\n(.*?)```", re.S)
PATH_LINE = re.compile(r"^\s*(?:<!--|//)\s*(force-app/main/default/\S+?)\s*(?:-->)?\s*$")


def examples(skill_dir: Path = SKILL_DIR) -> dict[str, str]:
    """{workspace-relative path: file content} for every path-tagged example."""
    out: dict[str, str] = {}
    for doc in sorted(skill_dir.glob("*.md")):
        for block in FENCE.findall(doc.read_text(encoding="utf-8")):
            first, _, rest = block.partition("\n")
            m = PATH_LINE.match(first)
            if m:
                out[m.group(1)] = rest
    return out


def write_workspace(root: Path, files: dict[str, str]) -> None:
    for rel, content in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def main() -> int:
    files = examples()
    if not files:
        print("no examples found"); return 1
    with tempfile.TemporaryDirectory() as tmp:
        ws = Path(tmp)
        write_workspace(ws, files)
        pkg = package_artifact.collect(ws)
        print(f"{len(files)} example files -> {sum(len(v) for v in pkg.members.values())} components: {pkg.members}")
        if pkg.problems:
            print("shape problems:"); [print("  -", p) for p in pkg.problems]; return 1
        md = MetadataApi(SalesforceClient.from_env(dict(os.environ)))
        result = package_artifact.check(md, pkg)
        if result.success:
            print(f"validated (checkOnly): status={result.status}, tests run={result.tests_run}"); return 0
        print("validation failed:"); [print("  -", p) for p in result.problems()]; return 1


if __name__ == "__main__":
    sys.exit(main())
