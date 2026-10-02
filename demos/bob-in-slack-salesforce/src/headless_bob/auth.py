"""Per-partner API keys: hashed at rest, carrying tenancy + quota caps.

Key format handed to partners: `hb_<32 hex>` — only the SHA-256 hash is stored.
Each key pins a tenant and caps: max concurrent jobs, max cost per run, and
whether write-capable runs are allowed at all (the safety ceiling; `trusted`
does not exist for partner keys until per-run sandbox isolation lands).
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import secrets
from uuid import uuid4

from .db import Database, now


@dataclass(frozen=True)
class Principal:
    key_id: str
    tenant: str
    label: str
    max_concurrent_jobs: int
    max_cost_per_run: float
    allow_writes: bool
    max_cost_per_day: float = 5.0


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def create_api_key(
    db: Database,
    *,
    tenant: str,
    label: str = "",
    max_concurrent_jobs: int = 2,
    max_cost_per_run: float = 0.50,
    allow_writes: bool = True,
    max_cost_per_day: float = 5.0,
) -> str:
    """Returns the plaintext key ONCE; only its hash is persisted."""
    plaintext = f"hb_{secrets.token_hex(32)}"
    db.execute(
        "INSERT INTO api_keys (id, key_hash, tenant, label, max_concurrent_jobs,"
        " max_cost_per_run, allow_writes, max_cost_per_day, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (
            uuid4().hex,
            _hash(plaintext),
            tenant,
            label,
            max_concurrent_jobs,
            max_cost_per_run,
            1 if allow_writes else 0,
            max_cost_per_day,
            now(),
        ),
    )
    return plaintext


def list_api_keys(db: Database, tenant: str | None = None) -> list[dict]:
    """Key metadata (never the key): for rotation and audits."""
    rows = db.all("SELECT id, tenant, label, max_concurrent_jobs, max_cost_per_run, allow_writes,"
                  " max_cost_per_day, created_at, revoked_at FROM api_keys"
                  + (" WHERE tenant=?" if tenant else "") + " ORDER BY created_at",
                  (tenant,) if tenant else ())
    return [dict(r) for r in rows]


def revoke_api_key(db: Database, key_id: str) -> bool:
    """Rotation step 2: after a partner switched to a new key, retire the old
    one. The row stays so job history keeps its attribution."""
    with db.connect() as conn:
        cursor = conn.execute("UPDATE api_keys SET revoked_at=? WHERE id=? AND revoked_at=''",
                              (now(), key_id))
        return cursor.rowcount == 1


def authenticate(db: Database, presented_key: str | None) -> Principal | None:
    if not presented_key:
        return None
    row = db.one("SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at = ''",
                 (_hash(presented_key),))
    if row is None:
        return None
    return Principal(
        key_id=row["id"],
        tenant=row["tenant"],
        label=row["label"],
        max_concurrent_jobs=row["max_concurrent_jobs"],
        max_cost_per_run=row["max_cost_per_run"],
        allow_writes=bool(row["allow_writes"]),
        max_cost_per_day=float(row["max_cost_per_day"]),
    )
