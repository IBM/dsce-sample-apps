"""
query_template.py
-----------------
Interactive CLI to query standard template clauses from AstraDB.

Usage:
    python query_template.py

The script prompts for a query, runs a vector search against the
standard_template documents in AstraDB, and prints the top results.
Type 'exit' or press Ctrl+C to quit.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from astrapy import DataAPIClient

# ── Credentials ───────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

ASTRA_DB_API_ENDPOINT      = os.environ["ASTRA_DB_API_ENDPOINT"]
ASTRA_DB_APPLICATION_TOKEN = os.environ["ASTRA_DB_APPLICATION_TOKEN"]
ASTRA_DB_COLLECTION        = os.environ.get("ASTRA_DB_COLLECTION", "contract_collection")

# ── AstraDB client ────────────────────────────────────────────────────────────
collection = (
    DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
    .get_database_by_api_endpoint(ASTRA_DB_API_ENDPOINT)
    .get_collection(ASTRA_DB_COLLECTION)
)

# ── Query function ────────────────────────────────────────────────────────────

def search(query: str, top_k: int = 3) -> list[dict]:
    """
    Vector search against standard_template documents.
    AstraDB embeds the query text internally — no embedding API call needed.
    """
    cursor = collection.find(
        filter={"doc_type": "standard_template"},
        sort={"$vectorize": query},
        limit=top_k,
        include_similarity=True,
        projection={"section_id": 1, "heading": 1, "text": 1,
                    "clause_type": 1, "template_id": 1},
    )
    return list(cursor)


def print_result(rank: int, doc: dict) -> None:
    similarity = doc.get("$similarity", 0)
    bar_len    = int(similarity * 20)
    bar        = "█" * bar_len + "░" * (20 - bar_len)

    print(f"\n  ┌─ #{rank}  {doc.get('section_id', '?'):10}  "
          f"{doc.get('template_id', '?')}")
    print(f"  │  Heading    : {doc.get('heading', '')}")
    print(f"  │  Type       : {doc.get('clause_type', 'other')}")
    print(f"  │  Similarity : {bar}  {similarity:.3f}")
    print(f"  │  Text       :")
    # wrap text at 72 chars
    text  = doc.get("text", "")
    words = text.split()
    line  = "  │    "
    for word in words:
        if len(line) + len(word) + 1 > 78:
            print(line)
            line = "  │    " + word
        else:
            line += (" " if line != "  │    " else "") + word
    if line.strip():
        print(line)
    print("  └" + "─" * 74)


# ── Main loop ─────────────────────────────────────────────────────────────────

def list_clauses() -> None:
    """Print all clause headings loaded in AstraDB — no vector search."""
    docs = list(collection.find(
        filter={"doc_type": "standard_template"},
        projection={"section_id": 1, "heading": 1, "clause_type": 1, "template_id": 1},
        limit=200,
    ))
    if not docs:
        print("  No standard_template chunks found.\n")
        return

    # Group by template_id
    by_template: dict[str, list] = {}
    for d in docs:
        tid = d.get("template_id", "unknown")
        by_template.setdefault(tid, []).append(d)

    for tid, chunks in by_template.items():
        print(f"\n  Template: {tid}")
        print(f"  {'Section':<12} {'Type':<22} Heading")
        print(f"  {'─'*12} {'─'*22} {'─'*40}")
        # Deduplicate by section_id (sub-chunks share same heading)
        seen: set[str] = set()
        for d in sorted(chunks, key=lambda x: x["section_id"]):
            base_id = d["section_id"].rstrip("abcdefghij")
            if base_id in seen:
                continue
            seen.add(base_id)
            print(f"  {d['section_id']:<12} {d.get('clause_type','other'):<22} {d.get('heading','')[:55]}")
    print()


def main():
    print("\n╔══════════════════════════════════════════════════╗")
    print("║   AstraDB Template Clause Query                  ║")
    print("║   Commands:                                      ║")
    print("║     list          — show all clause headings     ║")
    print("║     exit / quit   — quit                         ║")
    print("║     <any text>    — vector search for that clause║")
    print("╚══════════════════════════════════════════════════╝")
    print(f"\n  Collection : {ASTRA_DB_COLLECTION}")

    count = collection.count_documents(
        filter={"doc_type": "standard_template"},
        upper_bound=500
    )
    print(f"  Loaded chunks : {count}\n")

    while True:
        try:
            query = input("Query > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not query:
            continue
        if query.lower() in ("exit", "quit", "q"):
            print("Bye.")
            break
        if query.lower() == "list":
            list_clauses()
            continue

        print(f"\n  Searching for: \"{query}\" ...\n")
        results = search(query, top_k=5)

        if not results:
            print("  No results found.\n")
            continue

        for i, doc in enumerate(results, start=1):
            print_result(i, doc)

        print()


if __name__ == "__main__":
    main()
