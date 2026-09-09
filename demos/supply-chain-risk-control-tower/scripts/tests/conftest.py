"""Pytest configuration: adds the code/ directory to sys.path so the scrc package
is importable without requiring a prior `pip install -e .`."""
from __future__ import annotations

import sys
from pathlib import Path

# scripts/tests/ is two levels below the repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CODE_DIR = REPO_ROOT / "code"

if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))
