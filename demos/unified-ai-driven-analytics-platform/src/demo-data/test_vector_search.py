#!/usr/bin/env python3
"""Quick test for HCD vector search (same logic as MCP server vector_search tool)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Load .env from demo/scripts
def _load_dotenv(dotenv_path: str | None) -> None:
    if not dotenv_path:
        return
    path = Path(dotenv_path).expanduser()
    if not path.exists() or not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("'").strip('"')
        if key:
            os.environ[key] = value

def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    dotenv = repo_root / "demo" / "scripts" / ".env"
    _load_dotenv(str(dotenv))

    from cassandra.cluster import Cluster
    from cassandra.auth import PlainTextAuthProvider
    from sentence_transformers import SentenceTransformer

    hcd_host = os.getenv("HCD_HOST", "127.0.0.1")
    hcd_port = int(os.getenv("HCD_PORT", "9042"))
    hcd_user = os.getenv("HCD_USER", "cassandra")
    hcd_password = os.getenv("HCD_PASSWORD", "cassandra")
    ks = os.getenv("HCD_RUNBOOKS_KEYSPACE", "runbooks")
    tbl = os.getenv("HCD_RUNBOOKS_TABLE", "runbooks")

    query = "PLATINUM delay handling runbook"
    top_k = 3

    print(f"Query: {query!r}")
    print(f"HCD: {hcd_host}:{hcd_port} -> {ks}.{tbl}")
    print("Loading model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    query_embedding = model.encode(query, convert_to_numpy=True)
    vec_list = [round(float(x), 6) for x in query_embedding]
    vec_cql = "[" + ",".join(str(x) for x in vec_list) + "]"

    print("Connecting to HCD...")
    auth = PlainTextAuthProvider(username=hcd_user, password=hcd_password)
    cluster = Cluster(contact_points=[hcd_host], port=hcd_port, auth_provider=auth)
    session = cluster.connect()
    try:
        cql = (
            f"SELECT id, text, source FROM {ks}.{tbl} "
            f"ORDER BY embedding ANN OF {vec_cql} LIMIT {top_k}"
        )
        rows = session.execute(cql)
        chunks = [{"id": r.id, "text": (r.text or "")[:120], "source": r.source or "runbook"} for r in rows]
        print(f"\nTop {len(chunks)} chunks:")
        for c in chunks:
            print(f"  [{c['source']}] {c['id']}: {c['text']}...")
        if not chunks:
            print("  (no results)")
            return 1
        print("\nVector search OK.")
        return 0
    finally:
        cluster.shutdown()

if __name__ == "__main__":
    sys.exit(main())
