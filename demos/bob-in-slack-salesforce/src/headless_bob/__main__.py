"""CLI entry points.

  python -m headless_bob serve                 # run the API (uvicorn)
  python -m headless_bob create-key <tenant> [--label L] [--readonly]
                                               # mint a partner API key (prints once)
"""

from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="headless_bob")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser("serve", help="Run the API server")
    serve.add_argument("--host", default="0.0.0.0")
    serve.add_argument("--port", type=int, default=int(os.getenv("PORT", "8080")))

    mkkey = sub.add_parser("create-key", help="Create a partner API key")
    mkkey.add_argument("tenant")
    mkkey.add_argument("--label", default="")
    mkkey.add_argument("--readonly", action="store_true",
                       help="Key cannot run write-capable jobs")
    mkkey.add_argument("--max-concurrent", type=int, default=2)
    mkkey.add_argument("--max-cost", type=float, default=0.50)
    mkkey.add_argument("--max-cost-per-day", type=float, default=5.0)

    lskeys = sub.add_parser("list-keys", help="List partner API keys (metadata only)")
    lskeys.add_argument("--tenant", default=None)

    rmkey = sub.add_parser("revoke-key", help="Revoke a partner API key by id (rotation step 2)")
    rmkey.add_argument("key_id")

    args = parser.parse_args()

    if args.command == "serve":
        import logging

        import uvicorn

        from .api import create_app

        # Our own loggers were invisible in Code Engine (only tracebacks and
        # uvicorn lines showed): root had no handler, so INFO from
        # headless_bob.* — reconcile, spawn, sweep decisions — never printed.
        logging.basicConfig(level=logging.WARNING,
                            format="%(asctime)s %(levelname)s %(name)s: %(message)s")
        logging.getLogger("headless_bob").setLevel(logging.INFO)
        uvicorn.run(create_app(), host=args.host, port=args.port)
    elif args.command == "create-key":
        from .api import Settings
        from .auth import create_api_key
        from .db import Database

        settings = Settings()
        key = create_api_key(
            Database(settings.db_path),
            tenant=args.tenant,
            label=args.label,
            max_concurrent_jobs=args.max_concurrent,
            max_cost_per_run=args.max_cost,
            allow_writes=not args.readonly,
            max_cost_per_day=args.max_cost_per_day,
        )
        print("API key (shown once, store it now):")
        print(key)
    elif args.command == "list-keys":
        import json

        from .api import Settings
        from .auth import list_api_keys
        from .db import Database

        for row in list_api_keys(Database(Settings().db_path), args.tenant):
            print(json.dumps(row))
    elif args.command == "revoke-key":
        from .api import Settings
        from .auth import revoke_api_key
        from .db import Database

        ok = revoke_api_key(Database(Settings().db_path), args.key_id)
        print("revoked" if ok else "no active key with that id")
        raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
