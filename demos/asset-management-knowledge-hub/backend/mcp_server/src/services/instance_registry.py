"""Maximo instance registry with JSON file persistence.

Holds the list of configured Maximo instances and tracks which one is
currently active.  The active instance URL/key is used by MaximoService
when a per-request override is not provided.

Instances are persisted to ``instances.json`` (next to this file) so they
survive server restarts.  The env-default entry seeded from .env is always
written back on startup so the file stays in sync with the environment.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

from shared.logging import get_logger

logger = get_logger(__name__)

# Persist alongside the source tree so the file is easy to find during dev.
# In production you can override with the INSTANCES_FILE env-var.
_DEFAULT_STORE = Path(__file__).parent / "instances.json"
INSTANCES_FILE = Path(os.environ.get("INSTANCES_FILE", str(_DEFAULT_STORE)))


@dataclass
class MaximoInstance:
    id: str
    name: str
    url: str
    api_key: str = ""
    username: str = ""
    password: str = ""
    version: str = "Unknown"
    status: str = "unknown"   # unknown | active | inactive
    primary: bool = False


class InstanceRegistry:
    """Registry of Maximo instances backed by a JSON file.

    The active instance is used by the MCP server for all Maximo API calls
    unless the caller passes an explicit override.
    """

    def __init__(self) -> None:
        self._instances: dict[str, MaximoInstance] = {}
        self._active_id: Optional[str] = None
        self._load()
        self._seed_from_env()
        self._save()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load instances from disk (if the file exists)."""
        if not INSTANCES_FILE.exists():
            return
        try:
            raw = json.loads(INSTANCES_FILE.read_text(encoding="utf-8"))
            for d in raw.get("instances", []):
                inst = MaximoInstance(**{k: d[k] for k in MaximoInstance.__dataclass_fields__ if k in d})
                # Reset transient status to unknown on load — it will be
                # re-tested by the UI on the first Configuration page visit.
                inst.status = "unknown"
                self._instances[inst.id] = inst
            self._active_id = raw.get("activeId") or next(iter(self._instances), None)
            logger.info("Loaded %d instance(s) from %s", len(self._instances), INSTANCES_FILE)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load instances file: %s", exc)

    def _save(self) -> None:
        """Persist current state to disk."""
        try:
            INSTANCES_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "activeId": self._active_id,
                "instances": [asdict(i) for i in self._instances.values()],
            }
            INSTANCES_FILE.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not save instances file: %s", exc)

    # ── Seeding ───────────────────────────────────────────────────────────────

    def _seed_from_env(self) -> None:
        """Ensure the env-default instance exists and is up-to-date."""
        url = os.environ.get("MAXIMO_URL", "").strip()
        if not url:
            return

        api_key  = os.environ.get("MAXIMO_API_KEY", "").strip()
        username = os.environ.get("MAXIMO_USERNAME", "").strip()
        password = os.environ.get("MAXIMO_PASSWORD", "").strip()

        existing = self._instances.get("env-default")
        if existing:
            # Update credentials from env in case .env was edited
            existing.url      = url
            existing.api_key  = api_key
            existing.username = username
            existing.password = password
        else:
            inst = MaximoInstance(
                id="env-default",
                name="GTM Demo (Production)",
                url=url,
                api_key=api_key,
                username=username,
                password=password,
                version="9.1",
                status="unknown",
                primary=True,
            )
            self._instances[inst.id] = inst
            if self._active_id is None:
                self._active_id = inst.id

        logger.info("Instance registry env-default seeded", extra={"url": url})

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def all(self) -> list[dict]:
        return [self._to_dict(i) for i in self._instances.values()]

    def get(self, instance_id: str) -> Optional[MaximoInstance]:
        return self._instances.get(instance_id)

    def add(self, name: str, url: str, api_key: str = "", username: str = "", password: str = "") -> MaximoInstance:
        inst_id = f"inst-{int(time.time() * 1000)}"
        inst = MaximoInstance(
            id=inst_id,
            name=name,
            url=url.rstrip("/"),
            api_key=api_key,
            username=username,
            password=password,
        )
        self._instances[inst_id] = inst
        if self._active_id is None:
            self._active_id = inst_id
            inst.primary = True
        logger.info("Instance added", extra={"id": inst_id, "instance_name": name})
        self._save()
        return inst

    def remove(self, instance_id: str) -> bool:
        if instance_id not in self._instances:
            return False
        del self._instances[instance_id]
        if self._active_id == instance_id:
            self._active_id = next(iter(self._instances), None)
        logger.info("Instance removed", extra={"id": instance_id})
        self._save()
        return True

    # ── Active instance ───────────────────────────────────────────────────────

    def set_active(self, instance_id: str) -> bool:
        if instance_id not in self._instances:
            return False
        for inst in self._instances.values():
            inst.primary = False
        self._active_id = instance_id
        self._instances[instance_id].primary = True
        logger.info("Active instance changed", extra={"id": instance_id})
        self._save()
        return True

    @property
    def active_id(self) -> Optional[str]:
        return self._active_id

    @property
    def active(self) -> Optional[MaximoInstance]:
        if self._active_id:
            return self._instances.get(self._active_id)
        return None

    # ── Status update (called after a connection test) ────────────────────────

    def update_status(self, instance_id: str, status: str) -> None:
        if instance_id in self._instances:
            self._instances[instance_id].status = status
            # Don't write to disk for status — it's transient and resets on restart

    # ── Serialisation ─────────────────────────────────────────────────────────

    def _to_dict(self, inst: MaximoInstance) -> dict:
        d = asdict(inst)
        d["isActive"] = (inst.id == self._active_id)
        # Never expose secrets over the API
        d["api_key"]  = "••••" if inst.api_key  else ""
        d["password"] = "••••" if inst.password else ""
        return d


# ── Singleton ────────────────────────────────────────────────────────────────
instance_registry = InstanceRegistry()
