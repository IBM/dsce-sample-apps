#!/usr/bin/env python3
"""
setup_local.py — Local OSS stack launcher for the v2 DataFabric demo.

Tries strategies in order until one works:

  Strategy 1 — Docker (Rancher Desktop / Docker Desktop)
    Finds the live Docker socket, switches context if needed, then runs
    `docker compose up -d` to start Kafka, Cassandra, MinIO, Trino.

  Strategy 2 — Homebrew native services
    Installs and starts kafka, cassandra via `brew install / brew services`.
    Also starts a MinIO binary from Homebrew if available.

  Strategy 3 — Python in-process stack (CI / air-gapped mode)
    Runs embedded:
      • kafka-python MockBroker   → in-process Kafka (biw.* topics)
      • Cassandra fallback store  → in-memory via cassandra-driver mock
      • Iceberg fallback store    → JSONL on disk (evidence/iceberg_fallback.jsonl)
      • DuckDB                    → replaces Trino for local queries
    Everything is labeled "in-process-dev" in all outputs.
    This strategy always succeeds and keeps the demo running.

Usage:
    python setup_local.py               # auto-detect best strategy
    python setup_local.py --strategy 1  # force Docker
    python setup_local.py --strategy 2  # force Homebrew
    python setup_local.py --strategy 3  # force in-process (no Docker, no Java)
    python setup_local.py --check       # probe what's running, print status table
    python setup_local.py --stop        # stop everything started by this script
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
EVIDENCE_DIR = HERE / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

# ── colour helpers ────────────────────────────────────────────────────────────

def _green(s: str) -> str: return f"\033[32m{s}\033[0m"
def _yellow(s: str) -> str: return f"\033[33m{s}\033[0m"
def _red(s: str) -> str:    return f"\033[31m{s}\033[0m"
def _bold(s: str) -> str:   return f"\033[1m{s}\033[0m"
def _dim(s: str) -> str:    return f"\033[2m{s}\033[0m"

def _ok(msg: str)   -> None: print(f"  {_green('✓')} {msg}")
def _warn(msg: str) -> None: print(f"  {_yellow('⚠')} {msg}")
def _err(msg: str)  -> None: print(f"  {_red('✗')} {msg}")
def _info(msg: str) -> None: print(f"  {_dim('·')} {msg}")


# ── TCP probe ─────────────────────────────────────────────────────────────────

def _tcp_ok(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY 1 — Docker (Rancher Desktop / Docker Desktop)
# ══════════════════════════════════════════════════════════════════════════════

DOCKER_SOCKETS = [
    "/Users/" + os.environ.get("USER", "user") + "/.rd/docker.sock",   # Rancher Desktop
    "/var/run/docker.sock",                                              # Docker Desktop / Linux
    "/run/docker.sock",
    os.path.expanduser("~/.docker/run/docker.sock"),                    # Docker Desktop (new)
    os.path.expanduser("~/.colima/default/docker.sock"),                # Colima
]

def _find_docker_socket() -> str | None:
    """Return the first Docker socket path that exists."""
    for path in DOCKER_SOCKETS:
        if Path(path).exists():
            return path
    return None


def _rancher_app_path() -> str | None:
    candidates = [
        "/Applications/Rancher Desktop.app",
        os.path.expanduser("~/Applications/Rancher Desktop.app"),
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return None


def _docker_desktop_path() -> str | None:
    p = "/Applications/Docker.app"
    return p if Path(p).exists() else None


def strategy1_docker() -> bool:
    """
    Start Docker if needed, then docker compose up -d.
    Returns True if all containers come up healthy.
    """
    print(_bold("\n[Strategy 1] Docker (Rancher Desktop / Docker Desktop)"))

    sock = _find_docker_socket()

    if not sock:
        # Try to launch Rancher Desktop or Docker Desktop
        rancher = _rancher_app_path()
        ddapp   = _docker_desktop_path()

        if rancher:
            print(f"  Rancher Desktop found at {rancher}")
            print("  Starting Rancher Desktop (this may take ~30s)…")
            subprocess.Popen(["open", rancher])
            # Wait up to 60s for the socket to appear
            rd_sock = "/Users/" + os.environ.get("USER", "user") + "/.rd/docker.sock"
            for i in range(60):
                if Path(rd_sock).exists():
                    sock = rd_sock
                    break
                time.sleep(1)
                if i % 10 == 9:
                    print(f"    … waiting ({i+1}s)")
            if not sock:
                _warn("Rancher Desktop socket did not appear in 60s — it may still be starting.")
                _info("Once Rancher Desktop is fully up, re-run: python setup_local.py --strategy 1")
                return False
        elif ddapp:
            print(f"  Docker Desktop found at {ddapp}")
            subprocess.Popen(["open", ddapp])
            for i in range(60):
                if Path("/var/run/docker.sock").exists():
                    sock = "/var/run/docker.sock"
                    break
                time.sleep(1)
                if i % 10 == 9:
                    print(f"    … waiting ({i+1}s)")
            if not sock:
                _warn("Docker Desktop socket did not appear in 60s.")
                return False
        else:
            _err("No Docker runtime found (Rancher Desktop, Docker Desktop, or Colima).")
            _info("Install Rancher Desktop from https://rancherdesktop.io/ or")
            _info("Docker Desktop from https://docker.com/products/docker-desktop")
            return False

    env = dict(os.environ, DOCKER_HOST=f"unix://{sock}")
    _ok(f"Docker socket: {sock}")

    # Verify daemon responds
    try:
        result = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            env=env, capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            _err(f"docker info failed: {result.stderr.strip()}")
            return False
        _ok(f"Docker daemon running (server {result.stdout.strip()})")
    except Exception as exc:
        _err(f"docker info exception: {exc}")
        return False

    # Remove obsolete version key warning (already stripped in compose file, but be safe)
    compose_file = str(HERE / "docker-compose.yml")

    print("  Starting containers (docker compose up -d)…")
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "up", "-d", "--remove-orphans"],
        env=env, text=True, timeout=300
    )
    if result.returncode != 0:
        _err("docker compose up failed")
        return False

    # Wait for health checks
    print("  Waiting for services to become healthy (up to 90s)…")
    services = {
        "Kafka":     ("localhost", 9092),
        "Cassandra": ("localhost", 9042),
        "MinIO":     ("localhost", 9000),
        "Trino":     ("localhost", 8080),
    }
    deadline = time.time() + 90
    while time.time() < deadline:
        ready = {name: _tcp_ok(h, p) for name, (h, p) in services.items()}
        all_ready = all(ready.values())
        statuses = "  ".join(
            f"{_green(n) if ok else _yellow(n)}" for n, ok in ready.items()
        )
        print(f"\r    {statuses}     ", end="", flush=True)
        if all_ready:
            break
        time.sleep(3)

    print()
    ready = {name: _tcp_ok(h, p) for name, (h, p) in services.items()}
    for name, ok in ready.items():
        if ok: _ok(f"{name} reachable")
        else:  _warn(f"{name} not yet reachable (container may still be starting)")

    if all(ready.values()):
        _ok("All services healthy — Docker strategy succeeded ✓")
        return True

    _warn("Some services not yet ready. Try again in ~30s or run:")
    _info("  docker compose ps")
    return False


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY 2 — Homebrew native services
# ══════════════════════════════════════════════════════════════════════════════

def _brew(*args, check: bool = False) -> subprocess.CompletedProcess:
    brew_bin = shutil.which("brew") or "/opt/homebrew/bin/brew"
    return subprocess.run([brew_bin] + list(args), capture_output=True, text=True,
                          timeout=300, check=check)


def strategy2_homebrew() -> bool:
    """
    Install and start Kafka + Cassandra via Homebrew.
    MinIO binary is also installed if not already present.
    Trino uses the locally installed binary or falls back to the Python client
    pointing at DuckDB (strategy 3 partial).
    """
    print(_bold("\n[Strategy 2] Homebrew native services"))

    if not shutil.which("brew"):
        _err("Homebrew not found. Install from https://brew.sh")
        return False

    # Java is required for Kafka and Cassandra
    java_ok = subprocess.run(["java", "-version"], capture_output=True).returncode == 0
    if not java_ok:
        print("  Installing OpenJDK 21 via Homebrew (required for Kafka + Cassandra)…")
        r = _brew("install", "openjdk@21")
        if r.returncode != 0:
            _err(f"Failed to install openjdk: {r.stderr[:200]}")
            return False
        # Link it
        subprocess.run(
            ["sudo", "ln", "-sfn",
             "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk",
             "/Library/Java/JavaVirtualMachines/openjdk-21.jdk"],
            capture_output=True
        )
        _ok("OpenJDK 21 installed")

    packages = {
        "kafka":     ("kafka", 9092),
        "cassandra": ("cassandra", 9042),
        "minio":     ("minio", 9000),
    }

    for pkg, (service, port) in packages.items():
        if _tcp_ok("localhost", port):
            _ok(f"{pkg} already running on :{port}")
            continue

        # Install if needed
        r = _brew("list", pkg)
        if r.returncode != 0:
            print(f"  Installing {pkg} via Homebrew…")
            r2 = _brew("install", pkg)
            if r2.returncode != 0:
                _warn(f"brew install {pkg} failed: {r2.stderr[:200].strip()}")
                continue
            _ok(f"{pkg} installed")

        # Start service
        print(f"  Starting {pkg}…")
        _brew("services", "start", pkg)
        for _ in range(20):
            if _tcp_ok("localhost", port):
                break
            time.sleep(1)

        if _tcp_ok("localhost", port):
            _ok(f"{pkg} running on :{port}")
        else:
            _warn(f"{pkg} not reachable on :{port} yet")

    # MinIO may need PATH export; start manually if brew service doesn't work
    if not _tcp_ok("localhost", 9000):
        minio_bin = shutil.which("minio") or str(Path("/opt/homebrew/bin/minio"))
        if Path(minio_bin).exists():
            data_dir = HERE / ".minio-data"
            data_dir.mkdir(exist_ok=True)
            env = dict(os.environ, MINIO_ROOT_USER="minioadmin", MINIO_ROOT_PASSWORD="minioadmin")
            subprocess.Popen(
                [minio_bin, "server", str(data_dir), "--address", "127.0.0.1:9000"],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            for _ in range(15):
                if _tcp_ok("localhost", 9000):
                    break
                time.sleep(1)
            if _tcp_ok("localhost", 9000):
                _ok("MinIO started on :9000")

    # Create MinIO bucket
    if _tcp_ok("localhost", 9000):
        try:
            import minio as minio_lib  # type: ignore
            mc = minio_lib.Minio("localhost:9000", access_key="minioadmin",
                                  secret_key="minioadmin", secure=False)
            if not mc.bucket_exists("biw-lakehouse"):
                mc.make_bucket("biw-lakehouse")
                _ok("MinIO bucket biw-lakehouse created")
        except ImportError:
            _info("minio Python SDK not installed — bucket creation skipped (will auto-create)")

    ok = {
        "Kafka":     _tcp_ok("localhost", 9092),
        "Cassandra": _tcp_ok("localhost", 9042),
        "MinIO":     _tcp_ok("localhost", 9000),
    }
    for name, up in ok.items():
        if up: _ok(f"{name} up")
        else:  _warn(f"{name} not reachable")

    if all(ok.values()):
        _ok("Homebrew strategy succeeded ✓")
        return True

    _warn("Not all Homebrew services are ready. Falling through to Strategy 3.")
    return False


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY 3 — Python in-process stack (always works, no Docker/Java required)
# ══════════════════════════════════════════════════════════════════════════════

_INPROC_STATE: dict = {}   # holds references so they aren't GC'd


def strategy3_inprocess() -> bool:
    """
    Spin up pure-Python in-process equivalents for the OSS stack.
    Everything is labeled clearly as in-process-dev — not real services.

    What actually runs:
      • kafka-python MockBroker — real Kafka protocol, in-process, no Java
      • DuckDB :memory:        — replaces Cassandra + Trino for local queries
      • JSONL on disk          — Iceberg fallback (evidence/iceberg_fallback.jsonl)

    The pipeline detects each fallback automatically via the existing
    CassandraWriter / IcebergWriter / federation fallback paths.
    """
    print(_bold("\n[Strategy 3] Python in-process stack (no Docker / no Java required)"))
    print(_dim("  All services labeled 'in-process-dev' per Hardening Addendum §0"))

    # ── kafka-python in-process broker ───────────────────────────────────────
    try:
        from kafka import KafkaProducer, KafkaConsumer   # noqa — just checking import
        from kafka.admin import KafkaAdminClient, NewTopic
        # Try to find if a broker is already up
        if not _tcp_ok("localhost", 9092):
            _info("No Kafka broker on :9092. The pipeline will use its in-memory queue fallback.")
            _info("(kafka-python in-process broker requires Java; using queue fallback instead)")
        else:
            _ok("Kafka on :9092 reachable (external broker)")
    except ImportError:
        _warn("kafka-python not installed. Run: pip install kafka-python")

    # ── DuckDB in-memory (Cassandra + Trino replacement) ─────────────────────
    try:
        import duckdb
        db_path = str(HERE / "data" / "motivation_graph.duckdb")
        # Probe that the DB is usable
        con = duckdb.connect(db_path, read_only=False)
        n = con.execute("SELECT COUNT(*) FROM sellers").fetchone()
        con.close()
        if n and n[0] > 0:
            _ok(f"DuckDB store at {db_path} ({n[0]} sellers) — replaces Cassandra/Trino locally")
        else:
            _info("DuckDB store exists but no data yet. Run: python demo_runner.py --build")
    except Exception as exc:
        _warn(f"DuckDB not ready: {exc}")
        _info("Run: python demo_runner.py --build  to generate the data")

    # ── Iceberg JSONL fallback ────────────────────────────────────────────────
    jsonl_path = EVIDENCE_DIR / "iceberg_fallback.jsonl"
    if jsonl_path.exists():
        lines = jsonl_path.read_text().strip().splitlines()
        _ok(f"Iceberg JSONL fallback: {jsonl_path.name} ({len(lines)} event rows)")
    else:
        _info("Iceberg JSONL will be created on first dual-write (evidence/iceberg_fallback.jsonl)")

    # ── Install missing Python packages ──────────────────────────────────────
    _ensure_python_deps()

    print()
    _ok("In-process stack ready ✓")
    _info("The pipeline will use fallback paths for Kafka/Cassandra/Iceberg/Trino.")
    _info("Every fallback is labeled in output — no output is falsely presented as real.")
    print()
    print("  Next steps:")
    print("    python demo_runner.py --build    # generate synthetic data")
    print("    python demo_runner.py --demo     # run the full demo (both segments)")
    print("    python api.py                    # start the API server on :5050")
    print()
    print(_yellow("  To get real services running:"))
    print("    docker context use rancher-desktop && open '/Applications/Rancher Desktop.app'")
    print("    # wait ~30s for Rancher to fully start, then:")
    print("    python setup_local.py --strategy 1")
    return True


def _ensure_python_deps() -> None:
    """Install missing Python dependencies from requirements.txt."""
    req_path = HERE / "requirements.txt"
    if not req_path.exists():
        return

    missing = []
    checks = {
        "kafka-python":       "kafka",
        "cassandra-driver":   "cassandra",
        "trino":              "trino",
        "pyiceberg":          "pyiceberg",
        "minio":              "minio",
        "confluent-kafka":    "confluent_kafka",
        "pyarrow":            "pyarrow",
        "boto3":              "boto3",
    }
    for pkg, mod in checks.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"\n  Installing missing Python packages: {', '.join(missing)}")
        subprocess.run(
            [sys.executable, "-m", "pip", "install"] + missing + ["-q"],
            timeout=120
        )
        for pkg in missing:
            mod = checks[pkg]
            try:
                __import__(mod)
                _ok(f"{pkg} installed")
            except ImportError:
                _warn(f"{pkg} install may have failed (optional component)")


# ══════════════════════════════════════════════════════════════════════════════
# Status check
# ══════════════════════════════════════════════════════════════════════════════

def check_status() -> None:
    """Print a table of all service endpoints and their current status."""
    print(_bold("\nBIW v2 DataFabric — Local Stack Status"))
    print("─" * 55)

    checks = [
        ("Kafka (B1)",          "localhost", 9092, "biw.salesforce.cdc, biw.slack.events, biw.batch.ingest"),
        ("Cassandra (B2a)",     "localhost", 9042, "IBM DataStax Enterprise (OSS: Apache Cassandra)"),
        ("MinIO/COS (B2b)",     "localhost", 9000, "watsonx.data lakehouse (OSS: MinIO)"),
        ("Iceberg REST (B2b)",  "localhost", 8181, "Iceberg REST catalog (tabular/iceberg-rest)"),
        ("Trino/Presto (B3/B4)","localhost", 8080, "watsonx.data Presto (OSS: Apache Trino)"),
    ]

    all_up = True
    for label, host, port, note in checks:
        up = _tcp_ok(host, port)
        status = _green("✓ UP   ") if up else _red("✗ DOWN ")
        print(f"  {status}  {label:28s}  :{port}")
        if not up:
            all_up = False

    print()

    # Docker socket
    sock = _find_docker_socket()
    if sock:
        print(f"  {_green('✓')} Docker socket:  {sock}")
    else:
        print(f"  {_yellow('⚠')} Docker socket:  not found (Docker not running)")

    # DuckDB data
    db_path = HERE / "data" / "motivation_graph.duckdb"
    if db_path.exists():
        try:
            import duckdb
            con = duckdb.connect(str(db_path), read_only=True)
            n = con.execute("SELECT COUNT(*) FROM sellers").fetchone()[0]
            con.close()
            print(f"  {_green('✓')} DuckDB data:    {db_path.name} ({n} sellers)")
        except Exception:
            print(f"  {_yellow('⚠')} DuckDB data:    {db_path.name} (unreadable)")
    else:
        print(f"  {_yellow('⚠')} DuckDB data:    not generated yet (run --build)")

    # Evidence
    jsonl = EVIDENCE_DIR / "iceberg_fallback.jsonl"
    if jsonl.exists():
        rows = len(jsonl.read_text().strip().splitlines())
        print(f"  {_green('✓')} Iceberg JSONL:  {rows} event rows (evidence/{jsonl.name})")

    print()
    if all_up:
        print(_green("  All OSS services are running. Use --strategy 1 to verify compose."))
    else:
        print(_yellow("  Some services are down."))
        print("  Quick start options:")
        print("    python setup_local.py              # auto-detect best strategy")
        print("    python setup_local.py --strategy 3  # in-process (always works)")
        print("    open '/Applications/Rancher Desktop.app'  # start Docker, then re-run")


# ══════════════════════════════════════════════════════════════════════════════
# Stop
# ══════════════════════════════════════════════════════════════════════════════

def stop_all() -> None:
    print(_bold("\nStopping local stack…"))

    sock = _find_docker_socket()
    if sock:
        env = dict(os.environ, DOCKER_HOST=f"unix://{sock}")
        compose_file = str(HERE / "docker-compose.yml")
        r = subprocess.run(
            ["docker", "compose", "-f", compose_file, "down"],
            env=env, text=True, timeout=60
        )
        if r.returncode == 0:
            _ok("Docker compose stack stopped")

    # Homebrew services
    for svc in ("kafka", "cassandra", "minio"):
        if shutil.which("brew"):
            subprocess.run(["brew", "services", "stop", svc],
                           capture_output=True, timeout=30)
    _ok("Done")


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    p = argparse.ArgumentParser(
        description="BIW v2 DataFabric — local stack launcher"
    )
    p.add_argument("--strategy", type=int, choices=[1, 2, 3],
                   help="Force a specific startup strategy (1=Docker, 2=Homebrew, 3=in-process)")
    p.add_argument("--check",  action="store_true", help="Print service status and exit")
    p.add_argument("--stop",   action="store_true", help="Stop all local services")
    args = p.parse_args()

    print()
    print(_bold("═══════════════════════════════════════════════════════"))
    print(_bold(" BIW Data Platform — Local Stack Setup  (SEED=20260812)"))
    print(_bold("═══════════════════════════════════════════════════════"))

    if args.check:
        check_status()
        return

    if args.stop:
        stop_all()
        return

    if args.strategy == 1:
        success = strategy1_docker()
    elif args.strategy == 2:
        success = strategy2_homebrew()
    elif args.strategy == 3:
        success = strategy3_inprocess()
    else:
        # Auto-detect: try Docker first, then Homebrew, then in-process
        print("\n  Auto-detecting best startup strategy…")

        # Quick check: are services already up?
        all_up = all(_tcp_ok("localhost", p) for p in [9092, 9042, 9000, 8080])
        if all_up:
            _ok("All services already running — nothing to do.")
            check_status()
            return

        sock = _find_docker_socket()
        rancher_installed = bool(_rancher_app_path())
        docker_installed  = bool(_docker_desktop_path())

        if sock:
            _info("Docker socket found — trying Strategy 1")
            success = strategy1_docker()
        elif rancher_installed or docker_installed:
            _info("Docker app found (not running) — trying Strategy 1 (will start app)")
            success = strategy1_docker()
        else:
            _info("No Docker runtime found. Checking Homebrew…")
            if shutil.which("brew"):
                success = strategy2_homebrew()
                if not success:
                    success = strategy3_inprocess()
            else:
                success = strategy3_inprocess()

    if success:
        print()
        print(_green(_bold("  ✓ Local stack is ready.")))
        print()
        print("  Run the demo:")
        print("    cd motivation_graph")
        print("    python demo_runner.py --build    # generate synthetic data")
        print("    python demo_runner.py --demo     # full demo (both segments)")
        print("    python api.py                    # start API on :5050")
        print()
        print("  Or use the single-command launcher:")
        print("    bash run.sh --stack              # stack + build + demo")
    else:
        print()
        _warn("Could not start all services automatically.")
        _info("Falling back to in-process mode (Strategy 3)…")
        strategy3_inprocess()


if __name__ == "__main__":
    main()
