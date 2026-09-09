"""Object-structure mapper — keyword → Maximo API endpoint resolver.

Loads the pre-built ``object-structures.json`` file (copied from the original
Maximo_MCP_Server) and provides keyword-based ranking to find the best-matching
object structure for a natural-language query.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from shared.logging import get_logger

logger = get_logger(__name__)

_DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "object_structures.json"


class ObjectStructureMapper:
    """Keyword-weighted scorer that maps queries to Maximo object structures."""

    def __init__(self) -> None:
        self._structures: list[dict] = []
        self._keyword_map: dict[str, list[str]] = {}
        self._load()

    def _load(self) -> None:
        try:
            payload = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
            self._structures = payload.get("objectStructures", [])
            self._keyword_map = payload.get("keywordMapping", {})
            logger.info(
                "Object structure mapper loaded",
                extra={
                    "structures": len(self._structures),
                    "keywords": len(self._keyword_map),
                },
            )
        except Exception as exc:
            logger.error("Failed to load object structures", extra={"error": str(exc)})

    def find_object_structure(self, query: str) -> dict:
        """Return the best-matching object structure for *query*.

        Returns:
            Dict with keys ``objectStructure``, ``confidence``, ``reason``,
            and optionally ``alternatives`` and ``info``.
        """
        lower = query.lower()
        scores: dict[str, float] = {}

        for keyword, structures in self._keyword_map.items():
            if keyword in lower:
                weight = len(keyword) / 10
                for name in structures:
                    scores[name] = scores.get(name, 0.0) + weight

        if not scores:
            return {
                "objectStructure": None,
                "confidence": 0.0,
                "reason": "No matching object structure found",
                "alternatives": self._default_suggestions(),
            }

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        best_name, best_score = ranked[0]
        confidence = min(best_score / 5.0, 1.0)

        return {
            "objectStructure": best_name,
            "confidence": confidence,
            "reason": "Matched based on keywords in query",
            "info": self._find_by_name(best_name),
            "alternatives": [
                {"name": n, "score": s} for n, s in ranked[1:4]
            ],
        }

    # ── Public helpers ────────────────────────────────────────────────────────

    def get_all(self) -> list[dict]:
        return self._structures

    def search(self, term: str) -> list[dict]:
        lower = term.lower()
        return [
            s for s in self._structures
            if lower in s.get("name", "").lower()
            or lower in (s.get("description") or "").lower()
        ]

    def is_valid(self, name: str) -> bool:
        return any(s["name"].upper() == name.upper() for s in self._structures)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _find_by_name(self, name: str) -> Optional[dict]:
        return next(
            (s for s in self._structures if s["name"].upper() == name.upper()),
            None,
        )

    def _default_suggestions(self) -> list[dict]:
        defaults = ["MXAPIWO", "MXAPIASSET", "MXAPISR", "MXAPILOCATION", "MXAPIPERSON"]
        return [{"name": n, "info": self._find_by_name(n)} for n in defaults]


object_structure_mapper = ObjectStructureMapper()
