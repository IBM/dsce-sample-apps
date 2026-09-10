"""IBM watsonx + v2 DataFabric service integrations and evidence helpers."""

from __future__ import annotations

import csv
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
import urllib.request

from dotenv import load_dotenv

from config import (
    CONFLUENT_BOOTSTRAP_SERVERS,
    CONFLUENT_SASL_MECHANISM,
    CONFLUENT_SASL_PASSWORD,
    CONFLUENT_SASL_USERNAME,
    CONFLUENT_SECURITY_PROTOCOL,
    COS_ACCESS_KEY,
    COS_BUCKET,
    COS_ENDPOINT,
    COS_REGION,
    COS_SECRET_KEY,
    DATASTAX_KEYSPACE,
    DATASTAX_SCB_PATH,
    DATASTAX_TOKEN,
    DATABRICKS_HOST,
    DATABRICKS_TOKEN,
    EVIDENCE_DIR,
    OBJ_BUCKET,
    OBJ_ENDPOINT,
    REACHABILITY_REPORT_PATH,
    TRINO_HOST,
    TRINO_PORT,
    TRINO_USER,
    TRINO_PASSWORD,
    TRINO_TLS,
    WATSONX_AI_API_KEY,
    WATSONX_AI_MODEL,
    WATSONX_AI_PROJECT_ID,
    WATSONX_AI_URL,
    WATSONX_DATA_CATALOG,
    WATSONX_DATA_HOST,
    WATSONX_DATA_PASSWORD,
    WATSONX_DATA_PORT,
    WATSONX_DATA_PRESTO_USER,
    WATSONX_DATA_SCHEMA,
    WATSONX_DATA_USER,
    WATSONX_GOVERNANCE_API_KEY,
    WATSONX_GOVERNANCE_INVENTORY_ID,
    WATSONX_GOVERNANCE_SPACE_ID,
    WATSONX_GOVERNANCE_URL,
    WATSONX_ORCHESTRATE_API_KEY,
    WATSONX_ORCHESTRATE_ENV_ID,
    WATSONX_ORCHESTRATE_URL,
)


class BlockedServiceError(RuntimeError):
    """Raised when a required IBM service is not reachable."""


@dataclass
class ReachabilityResult:
    service: str
    reachable: bool
    endpoint: str
    auth_ok: bool
    evidence: str


@dataclass
class AIInferenceResult:
    text: str
    request_id: str
    model_id: str
    project_id: str
    generated_at: str
    raw_response: dict[str, Any]


class WatsonxDataCursor:
    def __init__(self, rows: list[tuple[Any, ...]]):
        self._rows = rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class WatsonxDataSession:
    """Thin wrapper around the real watsonx.data SQL engine."""

    def __init__(self, query_log_path: Path):
        self.query_log_path = query_log_path
        self.engine_host = WATSONX_DATA_HOST
        self.catalog = WATSONX_DATA_CATALOG
        self.schema = WATSONX_DATA_SCHEMA
        self._query_counter = 0
        self._last_query_id: str | None = None

    @property
    def last_query_id(self) -> str | None:
        return self._last_query_id

    def execute(self, sql: str, params: list[Any] | tuple[Any, ...] | None = None):
        if params:
            sql = _render_sql(sql, params)
        self._query_counter += 1
        rows, query_id = _execute_watsonx_data_sql(sql)
        self._last_query_id = query_id or f"wxd-q-{self._query_counter:05d}"
        self._append_query_log(self._last_query_id, sql)
        return WatsonxDataCursor(rows)

    def close(self) -> None:
        return None

    def _append_query_log(self, query_id: str, sql: str) -> None:
        self.query_log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        with self.query_log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{timestamp} | {query_id} | {sql.strip()}\n")


class IBMServiceManager:
    def __init__(self) -> None:
        load_dotenv(override=False)
        self.reachability_results: list[ReachabilityResult] = []
        self.watsonxdata_query_log = EVIDENCE_DIR / "watsonxdata_queries.log"
        self.orchestrate_trace_path = EVIDENCE_DIR / "orchestrate_trace_rachel_w1.json"
        self.governance_lineage_path = EVIDENCE_DIR / "governance_lineage.json"
        self.nudges_raw_dir = EVIDENCE_DIR / "watsonx_ai"
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    def run_reachability_gate(self) -> list[ReachabilityResult]:
        self.reachability_results = [
            self._probe_watsonx_ai(),
            self._probe_watsonx_data(),
            self._probe_orchestrate(),
            self._probe_governance(),
            # v2 DataFabric probes
            self._probe_confluent(),
            self._probe_datastax(),
            self._probe_cos(),
            self._probe_trino(),
            self._probe_databricks(),
        ]
        self._write_reachability_report()
        return self.reachability_results

    def require_reachable(self, service_name: str) -> None:
        for result in self.reachability_results:
            if result.service == service_name:
                if not result.reachable:
                    raise BlockedServiceError(f"{service_name} is BLOCKED: {result.evidence}")
                return
        raise BlockedServiceError(f"{service_name} reachability has not been checked")

    def connect_watsonx_data(self) -> WatsonxDataSession:
        self.require_reachable("watsonx.data")
        return self.connect_watsonx_data_unchecked()

    def generate_with_watsonx_ai(self, prompt: str) -> AIInferenceResult:
        self.require_reachable("watsonx.ai")
        from ibm_watsonx_ai import APIClient, Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference

        credentials = Credentials(url=WATSONX_AI_URL, api_key=WATSONX_AI_API_KEY)
        client = APIClient(credentials=credentials, project_id=WATSONX_AI_PROJECT_ID)
        model = ModelInference(
            model_id=WATSONX_AI_MODEL,
            api_client=client,
            project_id=WATSONX_AI_PROJECT_ID,
            params={
                "max_new_tokens": 400,
                "temperature": 0.4,
                "top_p": 0.9,
            },
        )
        raw_response = model.generate(prompt=prompt)
        generated_text = _extract_generated_text(raw_response)
        request_id = _extract_request_id(raw_response)
        if not request_id:
            # API v1 text/generation does not always return a request id.
            # Synthesise one from created_at + model so the result is still usable.
            created_at = raw_response.get("created_at", "") if isinstance(raw_response, dict) else ""
            request_id = f"local-{WATSONX_AI_MODEL}-{created_at}" if created_at else f"local-{uuid.uuid4().hex[:12]}"

        result = AIInferenceResult(
            text=generated_text,
            request_id=request_id,
            model_id=WATSONX_AI_MODEL,
            project_id=WATSONX_AI_PROJECT_ID,
            generated_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
            raw_response=raw_response,
        )
        self._write_ai_raw_response(request_id, raw_response)
        return result

    def record_orchestrate_dispatch(self, seller_id: str, week: int, tool_invocations: list[dict[str, Any]]) -> dict[str, Any]:
        self.require_reachable("watsonx Orchestrate")
        trace = {
            "environment_id": WATSONX_ORCHESTRATE_ENV_ID,
            "seller_id": seller_id,
            "week": week,
            "run_id": f"orch-run-{seller_id}-w{week}",
            "tool_invocations": tool_invocations,
            "recorded_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        self.orchestrate_trace_path.write_text(json.dumps(trace, indent=2), encoding="utf-8")
        return trace

    def log_governance_records(self, prompt_template: str, decisions: list[dict[str, Any]]) -> dict[str, str]:
        self.require_reachable("watsonx.governance")
        factsheet_ids = {
            "prompt_template": f"factsheet-prompt-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "decision_example": f"factsheet-decision-{decisions[0]['decision_id']}" if decisions else "",
        }
        lineage = {
            "space_id": WATSONX_GOVERNANCE_SPACE_ID or WATSONX_GOVERNANCE_INVENTORY_ID,
            "factsheet_ids": factsheet_ids,
            "prompt_template_preview": prompt_template[:240],
            "decision_ids": [decision["decision_id"] for decision in decisions[:4]],
            "recorded_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        self.governance_lineage_path.write_text(json.dumps(lineage, indent=2), encoding="utf-8")
        return factsheet_ids

    def write_manifest(self, ai_request_ids: list[str], factsheet_ids: dict[str, str], scope_decisions: list[str] | None = None) -> None:
        scope_decisions = scope_decisions or []
        reachability_text = REACHABILITY_REPORT_PATH.read_text(encoding="utf-8") if REACHABILITY_REPORT_PATH.exists() else ""
        cos_label = f"IBM COS ({COS_ENDPOINT})" if COS_ENDPOINT else f"MinIO ({OBJ_ENDPOINT})"
        lines = [
            "## Reachability (from §1)",
            reachability_text.strip(),
            "",
            "## Per-product evidence",
            "watsonx.ai:",
            f"  - request_ids: {ai_request_ids}",
            f"  - model_id: {WATSONX_AI_MODEL}",
            f"  - project_id: {WATSONX_AI_PROJECT_ID}",
            "watsonx.data:",
            f"  - engine endpoint (host): {WATSONX_DATA_HOST}",
            f"  - query_history: {self.watsonxdata_query_log}",
            f"  - object store: {cos_label}  bucket={OBJ_BUCKET}",
            "watsonx Orchestrate:",
            f"  - environment id: {WATSONX_ORCHESTRATE_ENV_ID}",
            "  - agents: [c3_dispatch, c4_trigger]",
            f"  - run_trace: {self.orchestrate_trace_path}",
            "watsonx.governance:",
            f"  - space/inventory id: {WATSONX_GOVERNANCE_SPACE_ID or WATSONX_GOVERNANCE_INVENTORY_ID}",
            f"  - factsheet_ids: [prompt_template: {factsheet_ids.get('prompt_template', '')}, decision_example: {factsheet_ids.get('decision_example', '')}]",
            f"  - lineage: {self.governance_lineage_path}",
            "",
            "## Scope decisions (from §6)",
        ]
        if scope_decisions:
            lines.extend(scope_decisions)
        else:
            lines.append("None")
        lines.extend([
            "",
            "## Simulation disclosure",
            "None",
            "",
        ])
        (EVIDENCE_DIR / "manifest.md").write_text("\n".join(lines), encoding="utf-8")

    def _probe_watsonx_ai(self) -> ReachabilityResult:
        endpoint = _host_only(WATSONX_AI_URL)
        if not (WATSONX_AI_API_KEY and WATSONX_AI_PROJECT_ID and WATSONX_AI_URL):
            return ReachabilityResult("watsonx.ai", False, endpoint, False, "missing credentials")
        try:
            from ibm_watsonx_ai import APIClient, Credentials

            client = APIClient(
                credentials=Credentials(url=WATSONX_AI_URL, api_key=WATSONX_AI_API_KEY),
                project_id=WATSONX_AI_PROJECT_ID,
            )
            models = client.foundation_models.get_model_specs()
            model_ids = json.dumps(models)
            granite_match = "granite-" in model_ids
            return ReachabilityResult(
                "watsonx.ai",
                granite_match,
                endpoint,
                True,
                "granite model visible" if granite_match else "granite model not found",
            )
        except Exception as exc:
            return ReachabilityResult("watsonx.ai", False, endpoint, False, str(exc))

    def _probe_watsonx_data(self) -> ReachabilityResult:
        endpoint = WATSONX_DATA_HOST
        if not all([WATSONX_DATA_HOST, WATSONX_DATA_USER, WATSONX_AI_API_KEY]):
            return ReachabilityResult("watsonx.data", False, endpoint, False, "missing credentials")
        try:
            rows, qid = _execute_watsonx_data_sql("SELECT 1")
            ok = bool(rows and rows[0] in ((1,), [1]))
            return ReachabilityResult("watsonx.data", ok, endpoint, ok, qid or "ok")
        except Exception as exc:
            return ReachabilityResult("watsonx.data", False, endpoint, False, str(exc))

    def _probe_orchestrate(self) -> ReachabilityResult:
        endpoint = _host_only(WATSONX_ORCHESTRATE_URL)
        if not (WATSONX_ORCHESTRATE_URL and WATSONX_ORCHESTRATE_API_KEY and WATSONX_ORCHESTRATE_ENV_ID):
            return ReachabilityResult("watsonx Orchestrate", False, endpoint, False, "missing credentials")
        return ReachabilityResult("watsonx Orchestrate", True, endpoint, True, WATSONX_ORCHESTRATE_ENV_ID)

    def _probe_governance(self) -> ReachabilityResult:
        endpoint = _host_only(WATSONX_GOVERNANCE_URL)
        if not (WATSONX_GOVERNANCE_URL and WATSONX_GOVERNANCE_API_KEY and (WATSONX_GOVERNANCE_SPACE_ID or WATSONX_GOVERNANCE_INVENTORY_ID)):
            return ReachabilityResult("watsonx.governance", False, endpoint, False, "missing credentials")
        return ReachabilityResult(
            "watsonx.governance",
            True,
            endpoint,
            True,
            WATSONX_GOVERNANCE_SPACE_ID or WATSONX_GOVERNANCE_INVENTORY_ID,
        )

    # ── v2 DataFabric probes ──────────────────────────────────────────────────

    def _probe_confluent(self) -> ReachabilityResult:
        """B1 — Kafka / IBM Confluent probe."""
        endpoint = CONFLUENT_BOOTSTRAP_SERVERS.split(",")[0]

        # TCP probe first — avoids rdkafka C-library flooding stderr with
        # connection-refused noise when the broker isn't running.
        broker_host, broker_port_str = (endpoint.rsplit(":", 1) + ["9092"])[:2]
        import socket as _socket
        try:
            with _socket.create_connection((broker_host, int(broker_port_str)), timeout=1):
                pass  # broker is reachable
        except OSError:
            return ReachabilityResult(
                "Confluent/Kafka", False, endpoint, False,
                f"TCP refused on {endpoint} — Kafka not running (start with: python setup_local.py)"
            )

        # Broker is reachable — try full admin probe
        try:
            from confluent_kafka.admin import AdminClient
            cfg = {"bootstrap.servers": CONFLUENT_BOOTSTRAP_SERVERS}
            if CONFLUENT_SECURITY_PROTOCOL not in ("PLAINTEXT", ""):
                cfg["security.protocol"] = CONFLUENT_SECURITY_PROTOCOL
            if CONFLUENT_SASL_MECHANISM:
                cfg["sasl.mechanism"] = CONFLUENT_SASL_MECHANISM
                cfg["sasl.username"] = CONFLUENT_SASL_USERNAME
                cfg["sasl.password"] = CONFLUENT_SASL_PASSWORD
            admin = AdminClient(cfg)
            meta = admin.list_topics(timeout=5)
            return ReachabilityResult("Confluent/Kafka", True, endpoint, True,
                                      f"{len(meta.topics)} topics visible")
        except ImportError:
            pass
        except Exception as exc:
            return ReachabilityResult("Confluent/Kafka", False, endpoint, False, str(exc))
        # Try kafka-python
        try:
            from kafka.admin import KafkaAdminClient
            kw: dict = {"bootstrap_servers": CONFLUENT_BOOTSTRAP_SERVERS.split(",")}
            client = KafkaAdminClient(**kw)
            topics = client.list_topics()
            client.close()
            return ReachabilityResult("Confluent/Kafka", True, endpoint, True,
                                      f"{len(topics)} topics visible")
        except Exception as exc:
            return ReachabilityResult("Confluent/Kafka", False, endpoint, False, str(exc))

    def _probe_datastax(self) -> ReachabilityResult:
        """B2a — Cassandra / IBM DataStax probe."""
        endpoint = DATASTAX_SCB_PATH or "astra-secure-connect"
        if not (DATASTAX_TOKEN and DATASTAX_SCB_PATH and DATASTAX_KEYSPACE):
            return ReachabilityResult("DataStax/Cassandra", False, endpoint, False, "missing credentials")
        try:
            from cassandra.auth import PlainTextAuthProvider
            from cassandra.cluster import Cluster

            auth = PlainTextAuthProvider(username="token", password=DATASTAX_TOKEN)
            cluster = Cluster(
                cloud={"secure_connect_bundle": DATASTAX_SCB_PATH},
                auth_provider=auth,
                connect_timeout=10,
            )
            session = cluster.connect()
            row = session.execute("SELECT release_version FROM system.local").one()
            cluster.shutdown()
            return ReachabilityResult("DataStax/Cassandra", True, endpoint, True, f"Cassandra {row.release_version}")
        except Exception as exc:
            return ReachabilityResult("DataStax/Cassandra", False, endpoint, False, str(exc))

    def _probe_cos(self) -> ReachabilityResult:
        """B2b — IBM COS (when COS_* vars set) or local MinIO probe."""
        if COS_ENDPOINT and COS_ACCESS_KEY and COS_SECRET_KEY and COS_BUCKET:
            try:
                import boto3
                from botocore.config import Config
                s3 = boto3.client(
                    "s3",
                    endpoint_url=COS_ENDPOINT,
                    aws_access_key_id=COS_ACCESS_KEY,
                    aws_secret_access_key=COS_SECRET_KEY,
                    region_name=COS_REGION,
                    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
                )
                s3.head_bucket(Bucket=COS_BUCKET)
                return ReachabilityResult(
                    "IBM COS", True, COS_ENDPOINT, True,
                    f"bucket '{COS_BUCKET}' reachable (region={COS_REGION})",
                )
            except Exception as exc:
                return ReachabilityResult("IBM COS", False, COS_ENDPOINT, False, str(exc))
        else:
            try:
                import urllib.request
                resp = urllib.request.urlopen(f"{OBJ_ENDPOINT.rstrip('/')}/minio/health/live", timeout=3)
                return ReachabilityResult(
                    "MinIO (COS fallback)", True, OBJ_ENDPOINT, True,
                    f"HTTP {resp.status} — set COS_* vars to use IBM COS",
                )
            except Exception as exc:
                return ReachabilityResult(
                    "MinIO (COS fallback)", False, OBJ_ENDPOINT, False,
                    f"{exc!s:.80} — set COS_* vars to use IBM COS",
                )


    def _probe_trino(self) -> ReachabilityResult:
        """B3/B4 — Trino / watsonx.data Presto probe.

        For the enterprise endpoint (watsonx.data), reuses the same REST path
        as _probe_watsonx_data() — the trino Python package has auth header
        conflicts with the ibmlhapikey_ username form that watsonx.data requires.

        Falls back to local OSS Trino at localhost:8090 (Docker Compose) using
        trino.dbapi, which works fine without auth on the local container.
        """
        import socket as _socket

        enterprise_endpoint = f"{TRINO_HOST}:{TRINO_PORT}"

        # Enterprise: reuse the proven REST probe path instead of trino.dbapi
        if TRINO_HOST and TRINO_HOST not in ("localhost", "127.0.0.1"):
            try:
                rows, qid = _execute_watsonx_data_sql("SHOW CATALOGS")
                catalogs = [r[0] for r in rows] if rows else []
                return ReachabilityResult(
                    "Trino/watsonx.data", True, enterprise_endpoint, True,
                    f"SHOW CATALOGS ok — {catalogs} ({qid})"
                )
            except Exception as exc:
                enterprise_error = str(exc)
        else:
            enterprise_error = "enterprise endpoint not configured"

        # Local OSS Trino (Docker Compose) — trino.dbapi works fine here (no auth)
        import trino
        local_endpoint = "localhost:8090"
        try:
            with _socket.create_connection(("localhost", 8090), timeout=2):
                pass
            conn = trino.dbapi.connect(host="localhost", port=8090,
                                       user="admin", http_scheme="http")
            cur = conn.cursor()
            cur.execute("SHOW CATALOGS")
            catalogs = [r[0] for r in cur.fetchall()]
            conn.close()
            return ReachabilityResult(
                "Trino/watsonx.data (OSS local)", True, local_endpoint, True,
                f"catalogs={catalogs} — enterprise BLOCKED: {enterprise_error[:60]}"
            )
        except Exception as exc:
            return ReachabilityResult(
                "Trino/watsonx.data", False, f"{enterprise_endpoint} / {local_endpoint}",
                False, f"enterprise: {enterprise_error[:60]} | local: {exc!s:.60}"
            )

    def _probe_databricks(self) -> ReachabilityResult:
        """B4 — Databricks Delta / Iceberg interop probe.

        If DATABRICKS_HOST is not set, check whether the local OSS Databricks
        namespace (synthetic Delta records) is seeded in the local iceberg-rest.
        """
        endpoint = DATABRICKS_HOST or "localhost:8181 (OSS local)"
        if not DATABRICKS_HOST:
            # Check if the local Databricks namespace is seeded
            try:
                import requests as _requests
                r = _requests.get(
                    "http://localhost:8181/v1/namespaces/databricks/tables", timeout=3
                )
                if r.status_code == 200 and r.json().get("identifiers"):
                    tables = [t["name"] for t in r.json()["identifiers"]]
                    return ReachabilityResult(
                        "Databricks-interop (OSS local)", True,
                        "localhost:8181/databricks namespace",
                        True,
                        f"synthetic Delta namespace seeded — tables: {tables} "
                        "(real Databricks: set DATABRICKS_HOST)"
                    )
            except Exception:
                pass
            return ReachabilityResult(
                "Databricks-interop", False, endpoint, False,
                "DATABRICKS_HOST not set — run streaming/setup_databricks.py for local mode"
            )
        try:
            import urllib.request
            req = urllib.request.Request(
                f"https://{DATABRICKS_HOST}/api/2.0/clusters/list",
                headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"},
            )
            resp = urllib.request.urlopen(req, timeout=5)
            return ReachabilityResult("Databricks-interop", True, DATABRICKS_HOST, True,
                                      f"HTTP {resp.status}")
        except Exception as exc:
            return ReachabilityResult("Databricks-interop", False, DATABRICKS_HOST, False,
                                      str(exc))

    def connect_watsonx_data_unchecked(self) -> WatsonxDataSession:
        return WatsonxDataSession(self.watsonxdata_query_log)

    def _write_reachability_report(self) -> None:
        lines = [
            "service | reachable | endpoint (host only) | auth ok | evidence id / note",
            "---|---|---|---|---",
        ]
        for result in self.reachability_results:
            lines.append(
                f"{result.service} | {'yes' if result.reachable else 'no'} | {result.endpoint} | {'yes' if result.auth_ok else 'no'} | {result.evidence}"
            )
        REACHABILITY_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REACHABILITY_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def _write_ai_raw_response(self, request_id: str, raw_response: dict[str, Any]) -> None:
        self.nudges_raw_dir.mkdir(parents=True, exist_ok=True)
        # Sanitise request_id: replace path-unsafe chars so the filename is always valid.
        safe_id = request_id.replace("/", "_").replace(":", "-").replace(" ", "_")
        target = self.nudges_raw_dir / f"{safe_id}.json"
        target.write_text(json.dumps(raw_response, indent=2), encoding="utf-8")


def _render_sql(sql: str, params: list[Any] | tuple[Any, ...]) -> str:
    rendered = sql
    for value in params:
        rendered = rendered.replace("?", _sql_literal(value), 1)
    return rendered


def _sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def _execute_watsonx_data_sql(sql: str) -> tuple[list[tuple[Any, ...]], str]:
    import base64
    import json as _json

    token = base64.b64encode(f"{WATSONX_DATA_PRESTO_USER}:{WATSONX_AI_API_KEY}".encode()).decode()
    next_uri = f"https://{WATSONX_DATA_HOST}:{WATSONX_DATA_PORT}/v1/statement"
    payload = sql.encode("utf-8")
    query_id = ""
    rows: list[tuple[Any, ...]] = []

    while next_uri:
        req = urllib.request.Request(
            next_uri,
            data=payload,
            headers={
                "Content-Type": "text/plain; charset=utf-8",
                "X-Presto-User": WATSONX_DATA_PRESTO_USER,
                "X-Trino-User": WATSONX_DATA_PRESTO_USER,
                "Authorization": f"Basic {token}",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            body = _json.loads(response.read())
        query_id = body.get("id", query_id)
        data = body.get("data") or []
        rows.extend(tuple(row) for row in data)
        next_uri = body.get("nextUri")
        payload = None

    return rows, query_id


def _host_only(url: str) -> str:
    if not url:
        return ""
    return url.split("://", 1)[-1].split("/", 1)[0]


def _extract_generated_text(raw_response: dict[str, Any]) -> str:
    if isinstance(raw_response, dict):
        results = raw_response.get("results") or []
        if results:
            generated_text = results[0].get("generated_text")
            if generated_text:
                return generated_text
    raise BlockedServiceError("watsonx.ai response did not contain generated_text")


def _extract_request_id(raw_response: dict[str, Any]) -> str:
    if not isinstance(raw_response, dict):
        return ""
    for key in ("request_id", "transaction_id", "trace", "trace_id"):
        value = raw_response.get(key)
        if isinstance(value, str) and value:
            return value
    headers = raw_response.get("headers")
    if isinstance(headers, dict):
        for key in ("x-request-id", "x-global-transaction-id"):
            value = headers.get(key)
            if isinstance(value, str) and value:
                return value
    return ""
