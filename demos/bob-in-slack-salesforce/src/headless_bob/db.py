"""Durable state for the core service: SQLite (WAL), schema ready for Postgres.

Everything load-bearing lives here — nothing in process memory — so a pod
restart loses no jobs, sessions, or tenants (the failure mode both prior
bobserver forks shipped with).
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime
import json
from pathlib import Path
import sqlite3
import threading

_SCHEMA = """
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    tenant TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    max_concurrent_jobs INTEGER NOT NULL DEFAULT 2,
    max_cost_per_run REAL NOT NULL DEFAULT 0.50,
    allow_writes INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tenant TEXT NOT NULL,
    name TEXT NOT NULL,
    bob_task_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tenant, name)
);
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    tenant TEXT NOT NULL,
    session_id TEXT REFERENCES sessions(id),
    state TEXT NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued','running','completed','failed','cancelled')),
    prompt TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    output TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    bob_task_id TEXT NOT NULL DEFAULT '',
    cost REAL,
    exit_code INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant, created_at DESC);
"""


def now() -> str:
    return datetime.now(UTC).isoformat()


class Database:
    """Small thread-safe wrapper. One connection per thread, WAL mode."""

    def __init__(self, path: Path | str):
        self.path = str(path)
        self._local = threading.local()
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(_SCHEMA)
            self._migrate(conn)

    def _migrate(self, conn: sqlite3.Connection) -> None:
        # Additive migrations for databases created by older versions.
        for table, column, default in (
            ("jobs", "artifacts", "'[]'"), ("jobs", "audit", "'{}'"),
            ("jobs", "request_key", "''"),            # Idempotency-Key, per tenant
            ("api_keys", "max_cost_per_day", "5.0"),  # rolling 24 h coin budget
            ("api_keys", "revoked_at", "''"),         # rotation: old keys stop working, history stays
        ):
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT {default}"
                             if column != "max_cost_per_day" else
                             f"ALTER TABLE {table} ADD COLUMN {column} REAL NOT NULL DEFAULT {default}")
            except sqlite3.OperationalError:
                pass  # column already exists
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_request_key"
                     " ON jobs(tenant, request_key) WHERE request_key != ''")
        try:
            conn.execute("ALTER TABLE caseflow ADD COLUMN org INTEGER NOT NULL DEFAULT 1")
        except sqlite3.OperationalError:
            pass  # column already exists
        try:
            conn.execute("ALTER TABLE caseflow ADD COLUMN artifact TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # column already exists
        for column, default in (("issue", "''"), ("proposal", "''"), ("package", "'{}'")):
            try:
                conn.execute(f"ALTER TABLE caseflow ADD COLUMN {column} TEXT NOT NULL DEFAULT {default}")
            except sqlite3.OperationalError:
                pass  # column already exists
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS caseflow (
                channel_id TEXT PRIMARY KEY,
                channel_name TEXT NOT NULL DEFAULT '',
                case_id TEXT NOT NULL,
                case_number TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'alerted'
                    CHECK (state IN ('alerted','solution_approved','implemented','closed')),
                visitor_email TEXT NOT NULL DEFAULT '',
                rule_id TEXT NOT NULL DEFAULT '',
                org INTEGER NOT NULL DEFAULT 1,
                artifact TEXT NOT NULL DEFAULT '',
                issue TEXT NOT NULL DEFAULT '',
                proposal TEXT NOT NULL DEFAULT '',
                package TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

    def _conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=10)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=10000")
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
        return conn

    @contextmanager
    def connect(self):
        conn = self._conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    # -- convenience helpers -------------------------------------------------

    def one(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        with self.connect() as conn:
            return conn.execute(sql, params).fetchone()

    def all(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return conn.execute(sql, params).fetchall()

    def execute(self, sql: str, params: tuple = ()) -> None:
        with self.connect() as conn:
            conn.execute(sql, params)


def row_to_job(row: sqlite3.Row) -> dict:
    job = dict(row)
    job["config"] = json.loads(job.get("config") or "{}")
    job["artifacts"] = json.loads(job.get("artifacts") or "[]")
    job["audit"] = json.loads(job.get("audit") or "{}")
    return job
