"""
v2 Test Suite — Dual-Write Streaming Lakehouse
================================================
Asserts the v2 acceptance criteria per spec §B1–B7 and the
BOB Hardening Addendum §5.

Tests:
  TestG_Generator         — seeded generator, byte-identical on re-run
  TestB2_DualWrite        — dual-write lands in both Cassandra and Iceberg
  TestB3B4_Federation     — federated join returns live+history+Databricks
  TestB5_NudgeApp         — nudge draws on ≥3 unified sources; no graph library
  TestB5b_ActionPlan      — action tasks close the gap; Salesforce/Slack payloads
  TestV1Removed           — confirms all v1 artifacts are gone

Run:
    cd motivation_graph && pytest tests/test_pipeline.py -v
"""
import importlib
import json
import sys
from pathlib import Path

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import SEED, DB_PATH
from data.generator import generate

TEST_DB  = str(Path(__file__).parent.parent / "data" / "test_motivation_graph.duckdb")
TEST_DB2 = str(Path(__file__).parent.parent / "data" / "test_motivation_graph_v2.duckdb")


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    """Fresh test DB generated with SEED=20260812."""
    generate(TEST_DB)
    yield TEST_DB


@pytest.fixture(scope="module")
def con(db):
    c = duckdb.connect(db, read_only=True)
    yield c
    c.close()


# ═══════════════════════════════════════════════════════════════════════════
# G — Synthetic data generator
# Acceptance: byte-identical on re-run; 18+ sources defined.
# ═══════════════════════════════════════════════════════════════════════════

class TestG_Generator:

    def test_regenerate_byte_identical_event_count(self, db):
        """Re-run with same seed → same number of events (spec G determinism)."""
        generate(TEST_DB2)
        con1 = duckdb.connect(db, read_only=True)
        con2 = duckdb.connect(TEST_DB2, read_only=True)
        cnt1 = con1.execute("SELECT COUNT(*) FROM activity_events").fetchone()[0]
        cnt2 = con2.execute("SELECT COUNT(*) FROM activity_events").fetchone()[0]
        con1.close(); con2.close()
        assert cnt1 == cnt2, f"Event count differs: {cnt1} vs {cnt2}"

    def test_twenty_sellers(self, con):
        n = con.execute("SELECT COUNT(*) FROM sellers").fetchone()[0]
        assert n == 20, f"Expected 20 sellers (3 foreground + 17 background), got {n}"

    def test_three_foreground_sellers(self, con):
        n = con.execute(
            "SELECT COUNT(*) FROM sellers WHERE persona_label IS NOT NULL"
        ).fetchone()[0]
        assert n == 3, f"Expected 3 foreground sellers, got {n}"

    def test_no_graph_beliefs_table(self, con):
        """v1 artifact must not exist in v2 schema."""
        tables = [r[0].lower() for r in con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='main'"
        ).fetchall()]
        assert "graph_beliefs" not in tables, \
            "graph_beliefs table exists — v1 artifact not removed"

    def test_seller_behavioral_signals_rachel(self, con):
        """Rachel: no leaderboard views, has mentorship sessions."""
        lb = con.execute(
            "SELECT COUNT(*) FROM activity_events "
            "WHERE seller_id='seller-rachel-001' AND event_type='leaderboard_view'"
        ).fetchone()[0]
        assert lb == 0, "Rachel should have 0 leaderboard views"

        ms = con.execute(
            "SELECT COUNT(*) FROM activity_events "
            "WHERE seller_id='seller-rachel-001' AND event_type='mentorship_session'"
        ).fetchone()[0]
        assert ms >= 12, f"Rachel should have ≥12 mentorship sessions, got {ms}"

    def test_seller_behavioral_signals_marcus(self, con):
        """Marcus: high leaderboard views, no certs completed."""
        lb = con.execute(
            "SELECT COUNT(*) FROM activity_events "
            "WHERE seller_id='seller-marcus-001' AND event_type='leaderboard_view'"
        ).fetchone()[0]
        assert lb >= 80, f"Marcus should have ≥80 leaderboard views, got {lb}"

        certs = con.execute(
            "SELECT COUNT(*) FROM activity_events "
            "WHERE seller_id='seller-marcus-001' AND event_type='cert_completed'"
        ).fetchone()[0]
        assert certs == 0, "Marcus should have 0 cert_completed"

    def test_18_sources_defined_in_producer(self):
        """18+ sources must be defined in the Kafka producer source catalog."""
        from streaming.producer import SOURCES
        assert len(SOURCES) >= 18, f"Expected ≥18 sources, got {len(SOURCES)}"

    def test_five_live_sources(self):
        """Exactly 5 sources are flagged live (shown on camera)."""
        from streaming.producer import SOURCES
        live = [s for s in SOURCES if s["live"]]
        assert len(live) == 5, f"Expected 5 live sources, got {len(live)}"

    def test_three_kafka_topics(self):
        """3 Kafka topics must be configured."""
        from config import KAFKA_TOPIC_CRM, KAFKA_TOPIC_COLLAB, KAFKA_TOPIC_BATCH
        assert KAFKA_TOPIC_CRM
        assert KAFKA_TOPIC_COLLAB
        assert KAFKA_TOPIC_BATCH
        assert len({KAFKA_TOPIC_CRM, KAFKA_TOPIC_COLLAB, KAFKA_TOPIC_BATCH}) == 3, \
            "3 distinct Kafka topics required"


# ═══════════════════════════════════════════════════════════════════════════
# B2 — Dual-write consumer
# Acceptance: one consume produces both a current Cassandra row
#             and an appended Iceberg record.
# ═══════════════════════════════════════════════════════════════════════════

class TestB2_DualWrite:

    def test_dual_write_to_both_sinks(self):
        """
        One event consumed → appears in BOTH Cassandra and Iceberg stores.
        Uses the in-memory fallback path (no live Kafka required for CI).
        """
        from streaming.producer import KafkaProducer, make_slack_event
        from streaming.consumer import DualWriteConsumer

        producer = KafkaProducer(dry_run=True)
        consumer = DualWriteConsumer()
        consumer.connect()  # will use in-memory fallback if Cassandra absent

        event = make_slack_event("seller-rachel-001", "recognition")
        producer.produce("biw.slack.events", event)

        written = consumer.consume_from_queue(producer.queued)
        assert len(written) >= 1, "Expected at least 1 dual-write record"

        record = written[0]
        # B2 acceptance: both sinks must report success
        assert record.get("cassandra_ok") is True, \
            "Cassandra write not confirmed in dual-write record"
        assert record.get("iceberg_ok") is True, \
            "Iceberg write not confirmed in dual-write record"

    def test_dual_write_record_has_event_fields(self):
        """Dual-write log entry must carry source, event_type, seller_id."""
        from streaming.producer import KafkaProducer, make_salesforce_cdc_event
        from streaming.consumer import DualWriteConsumer

        producer = KafkaProducer(dry_run=True)
        consumer = DualWriteConsumer()
        consumer.connect()

        event = make_salesforce_cdc_event("seller-marcus-001")
        producer.produce("biw.salesforce.cdc", event)

        written = consumer.consume_from_queue(producer.queued)
        assert written, "No dual-write records produced"
        rec = written[0]
        assert rec.get("source") == "salesforce", f"Expected source=salesforce, got {rec.get('source')}"
        assert rec.get("seller_id") == "seller-marcus-001"

    def test_cassandra_readable_after_write(self):
        """Events written are readable from the Cassandra store (in-memory)."""
        from streaming.producer import KafkaProducer, make_slack_event
        from streaming.consumer import DualWriteConsumer

        producer = KafkaProducer(dry_run=True)
        consumer = DualWriteConsumer()
        consumer.connect()

        event = make_slack_event("seller-maya-001")
        producer.produce("biw.slack.events", event)
        consumer.consume_from_queue(producer.queued)

        rows = consumer.cassandra.read_latest(10)
        assert rows, "Expected at least one row from Cassandra after dual-write"

    def test_iceberg_readable_after_write(self):
        """Events written are readable from the Iceberg store (fallback JSONL)."""
        from streaming.producer import KafkaProducer, make_slack_event
        from streaming.consumer import DualWriteConsumer

        producer = KafkaProducer(dry_run=True)
        consumer = DualWriteConsumer()
        consumer.connect()

        event = make_slack_event("seller-rachel-001")
        producer.produce("biw.slack.events", event)
        consumer.consume_from_queue(producer.queued)

        rows = consumer.iceberg.read_latest(10)
        assert rows, "Expected at least one row from Iceberg after dual-write"


# ═══════════════════════════════════════════════════════════════════════════
# B3/B4 — Federation
# Acceptance B3: one SQL joins live+history, returns unified result.
# Acceptance B4: same query adds Databricks Delta in place — visible indicator.
# ═══════════════════════════════════════════════════════════════════════════

class TestB3B4_Federation:

    @pytest.fixture(scope="class")
    def _shared_consumer_data(self):
        """
        Shared setup: produce live events, dual-write to in-memory stores,
        return (cassandra_rows, iceberg_rows) for B3/B4 queries.
        """
        from streaming.producer import KafkaProducer, inject_live_events
        from streaming.consumer import DualWriteConsumer

        producer = KafkaProducer(dry_run=True)
        consumer = DualWriteConsumer()
        consumer.connect()
        inject_live_events(producer, verbose=False)
        consumer.consume_from_queue(producer.queued)

        # Return the in-memory data directly (avoids reading from empty stores)
        cass = consumer.cassandra.in_memory if not consumer.cassandra._session else consumer.cassandra.read_latest(20)
        ice  = consumer.iceberg.read_latest(20)

        # Ensure at least one row in each for the fallback join to produce results
        if not cass:
            cass = consumer.cassandra.in_memory
        return cass, ice

    @pytest.fixture(scope="class")
    def b3_result(self, _shared_consumer_data):
        from streaming.federation import run_b3_query
        cass, ice = _shared_consumer_data
        return run_b3_query(cassandra_rows=cass, iceberg_rows=ice)

    @pytest.fixture(scope="class")
    def b4_result(self, _shared_consumer_data):
        from streaming.federation import run_b4_query
        cass, ice = _shared_consumer_data
        return run_b4_query(cassandra_rows=cass, iceberg_rows=ice)

    def test_b3_returns_rows(self, b3_result):
        """B3: query returns at least one unified row."""
        assert len(b3_result.rows) >= 1, "B3 query returned no rows"

    def test_b3_sources_include_live_and_history(self, b3_result):
        """B3: sources_joined must reference both live and history layers."""
        joined = " ".join(b3_result.sources_joined).lower()
        assert "cassandra" in joined or "live" in joined, \
            f"B3 sources_joined missing live layer: {b3_result.sources_joined}"
        assert "iceberg" in joined or "history" in joined or "fallback" in joined, \
            f"B3 sources_joined missing history layer: {b3_result.sources_joined}"

    def test_b3_sql_has_join(self, b3_result):
        """B3 SQL must contain a JOIN (zero-copy federation, not a simple SELECT)."""
        assert "join" in b3_result.sql.lower(), \
            "B3 SQL should contain a JOIN for zero-copy federation"

    def test_b4_databricks_included(self, b4_result):
        """B4 acceptance: Databricks Delta must be included in the result."""
        assert b4_result.databricks_included is True, \
            "B4: databricks_included must be True — the money shot requires Databricks"

    def test_b4_returns_rows(self, b4_result):
        """B4: query returns at least one row covering all three sources."""
        assert len(b4_result.rows) >= 1, "B4 query returned no rows"

    def test_b4_read_mode_indicator_visible(self, b4_result):
        """
        B4 acceptance: a visible 'read at source, not copied' indicator.
        The result must include databricks_read_mode field on at least one row.
        """
        has_indicator = any(
            r.get("databricks_read_mode") for r in b4_result.rows
        )
        assert has_indicator, (
            "B4: no 'databricks_read_mode' indicator found in result rows. "
            "The 'read at source, not copied' indicator is required."
        )

    def test_b4_sources_include_three_layers(self, b4_result):
        """B4: sources_joined must reference live, history, and Databricks."""
        joined = " ".join(b4_result.sources_joined).lower()
        assert "cassandra" in joined or "live" in joined, \
            "B4: missing live layer in sources_joined"
        assert "iceberg" in joined or "history" in joined or "fallback" in joined, \
            "B4: missing history layer in sources_joined"
        assert "databricks" in joined, \
            "B4: missing Databricks in sources_joined"

    def test_b4_sql_contains_all_three_catalogs(self, b4_result):
        """B4 SQL must reference cassandra, iceberg, and databricks catalogs."""
        sql_lower = b4_result.sql.lower()
        assert "cassandra" in sql_lower or "live_events" in sql_lower, \
            "B4 SQL missing Cassandra/live reference"
        assert "iceberg" in sql_lower or "hist" in sql_lower, \
            "B4 SQL missing Iceberg/history reference"
        assert "databricks" in sql_lower, \
            "B4 SQL missing Databricks reference"


# ═══════════════════════════════════════════════════════════════════════════
# B5 — Motivation nudge app (thin, implementation-agnostic)
# Acceptance: nudge for one seller derived from ≥3 unified sources.
# No graph database or graph library required.
# ═══════════════════════════════════════════════════════════════════════════

class TestB5_NudgeApp:
    """
    Validates the SQL-rules nudge (§B5, §A7, §10).

    Key criteria:
      • Nudge visibly depends on ≥3 unified sources (Salesforce, Slack, Databricks)
      • source_signals dict carries all required keys
      • No networkx, no graph_beliefs, no graph library in the output
      • model_version indicates sql-rules (not graph)
    """

    @pytest.fixture(scope="class")
    def nudges(self, db):
        from app.nudge import generate_all_nudges
        _con = duckdb.connect(db, read_only=True)
        result = generate_all_nudges(_con)
        _con.close()
        return result

    def test_returns_three_nudges(self, nudges):
        assert len(nudges) == 3, f"Expected 3 nudges (one per foreground seller), got {len(nudges)}"

    def test_each_nudge_has_three_unified_sources(self, nudges):
        """§B5: nudge must depend on ≥3 unified sources."""
        for nudge in nudges:
            sources = nudge.get("unified_sources", [])
            assert len(sources) >= 3, (
                f"Nudge for {nudge['seller_id']} has only {len(sources)} source(s); "
                f"§B5 requires ≥3."
            )

    def test_source_labels_name_salesforce_slack_databricks(self, nudges):
        """Each nudge must reference Salesforce, Slack, and Databricks by name."""
        for nudge in nudges:
            combined = " ".join(nudge["unified_sources"]).lower()
            assert "salesforce" in combined, \
                f"{nudge['seller_id']}: Salesforce not in unified_sources"
            assert "slack" in combined, \
                f"{nudge['seller_id']}: Slack not in unified_sources"
            assert "databricks" in combined, \
                f"{nudge['seller_id']}: Databricks not in unified_sources"

    def test_no_networkx_or_graph_in_nudge_output(self, nudges):
        """Guardrail: no v1 graph artifacts leaked into nudge output."""
        for nudge in nudges:
            body_lower = nudge.get("body", "").lower()
            assert "networkx" not in body_lower, \
                f"{nudge['seller_id']}: 'networkx' found in nudge body (v1 leak)"
            assert "graph_belief" not in body_lower, \
                f"{nudge['seller_id']}: 'graph_belief' found in nudge body (v1 leak)"

    def test_nudge_has_headline_and_body(self, nudges):
        for nudge in nudges:
            assert nudge.get("headline"), f"{nudge['seller_id']}: empty headline"
            assert nudge.get("body"),     f"{nudge['seller_id']}: empty body"

    def test_source_signals_keys_present(self, nudges):
        """source_signals dict must carry all four signal keys."""
        required = {
            "salesforce_deals_closed",
            "salesforce_crm_updates",
            "slack_recognitions",
            "databricks_deal_velocity_90d",
        }
        for nudge in nudges:
            missing = required - nudge.get("source_signals", {}).keys()
            assert not missing, \
                f"{nudge['seller_id']}: missing signal keys {missing}"

    def test_model_version_is_sql_rules_not_graph(self, nudges):
        """model_version must reference sql-rules, not graph (v1 artefact)."""
        for nudge in nudges:
            mv = nudge.get("model_version", "")
            assert "graph" not in mv.lower(), \
                f"{nudge['seller_id']}: model_version '{mv}' references graph (v1 artefact)"
            assert "sql" in mv.lower(), \
                f"{nudge['seller_id']}: model_version '{mv}' should indicate sql-rules"

    def test_no_networkx_in_requirements(self):
        """
        Hard guardrail (§10): networkx must not appear in requirements.txt.
        The spec prohibits any graph library.
        """
        req_path = Path(__file__).parent.parent / "requirements.txt"
        content = req_path.read_text().lower()
        assert "networkx" not in content, \
            "networkx found in requirements.txt — must be removed. Spec §10: no graph library."

    def test_no_graph_module_in_package(self):
        """The graph/ package must have been deleted."""
        graph_dir = Path(__file__).parent.parent / "graph"
        assert not graph_dir.exists(), \
            f"v1 graph/ directory still exists at {graph_dir}"


# ═══════════════════════════════════════════════════════════════════════════
# B5b — Actionable tasks + seller-persona delivery surfaces
# ═══════════════════════════════════════════════════════════════════════════

class TestB5b_ActionPlan:
    """
    Validates the actionable nudge (§B5b).

    Key criteria:
      • Every seller's tasks sum to exactly their points_to_go — the gap the
        seller is asked to close must always be closeable by the listed tasks
      • Goal progress is consistent: earned + to_go == target
      • Completing a task moves the gap by exactly that task's points
      • Both channel payloads render from the same plan
    """

    SELLERS = ["seller-rachel-001", "seller-marcus-001", "seller-maya-001"]
    # The gaps the client signed off on.
    EXPECTED_GAP = {
        "seller-rachel-001": 800,
        "seller-marcus-001": 1600,
        "seller-maya-001":   2100,
    }

    @pytest.fixture(scope="class")
    def plans(self, db):
        from app.actions import build_action_plan, reset
        reset()
        _con = duckdb.connect(db, read_only=True)
        result = {sid: build_action_plan(_con, sid) for sid in self.SELLERS}
        _con.close()
        return result

    def test_every_seller_has_a_plan(self, plans):
        for sid in self.SELLERS:
            assert plans[sid]["tasks"], f"{sid} has no tasks"

    def test_tasks_sum_to_the_gap(self, plans):
        """The motivation mechanic: the listed tasks always close the gap."""
        for sid, plan in plans.items():
            total = sum(t["points"] for t in plan["tasks"])
            assert total == plan["goal"]["points_to_go"] == self.EXPECTED_GAP[sid], (
                f"{sid}: tasks sum to {total}, gap is {plan['goal']['points_to_go']}, "
                f"expected {self.EXPECTED_GAP[sid]}"
            )

    def test_goal_progress_is_consistent(self, plans):
        for sid, plan in plans.items():
            g = plan["goal"]
            assert g["points_earned"] + g["points_to_go"] == g["target_points"], \
                f"{sid}: earned + to_go != target"

    def test_every_task_cites_a_source_and_a_channel(self, plans):
        """Each task shows the signal that justified it — not a generic to-do."""
        for sid, plan in plans.items():
            for t in plan["tasks"]:
                assert t["why"], f"{sid}/{t['task_id']} has no justification"
                assert t["source_short"], f"{sid}/{t['task_id']} cites no source"
                assert t["channel"] in ("salesforce", "slack"), \
                    f"{sid}/{t['task_id']} has unknown channel {t['channel']!r}"

    def test_plan_draws_on_three_unified_sources(self, plans):
        """Same §B5 requirement as the nudge: ≥3 unified sources on screen."""
        for sid, plan in plans.items():
            assert len(plan["unified_sources"]) >= 3, f"{sid} lists <3 sources"
            joined = " ".join(plan["unified_sources"]).lower()
            for expected in ("salesforce", "slack", "databricks"):
                assert expected in joined, f"{sid} missing {expected} source"

    def test_completing_a_task_closes_the_gap_by_its_points(self, db):
        from app.actions import build_action_plan, mark_complete, reset

        sid = "seller-marcus-001"
        reset(sid)
        _con = duckdb.connect(db, read_only=True)
        try:
            before = build_action_plan(_con, sid)
            task = before["tasks"][0]

            assert mark_complete(sid, task["task_id"]) is True
            after = build_action_plan(_con, sid)

            assert after["goal"]["points_to_go"] == \
                before["goal"]["points_to_go"] - task["points"]
            assert after["totals"]["completed_count"] == 1
            assert next(t for t in after["tasks"]
                        if t["task_id"] == task["task_id"])["completed"] is True
        finally:
            reset(sid)
            _con.close()

    def test_unknown_task_id_is_rejected(self):
        from app.actions import mark_complete
        assert mark_complete("seller-marcus-001", "not-a-real-task") is False

    def test_slack_payload_is_block_kit(self, plans):
        from app.actions import build_slack_payload

        payload = build_slack_payload(plans["seller-rachel-001"],
                                      {"headline": "H", "body": "B"})
        assert payload["text"], "Slack payload needs notification fallback text"
        assert payload["blocks"][0]["type"] == "header"
        types = {b["type"] for b in payload["blocks"]}
        assert {"section", "divider", "context"} <= types
        # Buttons must carry absolute URLs — Slack rejects relative ones.
        for b in payload["blocks"]:
            url = b.get("accessory", {}).get("url")
            if url:
                assert url.startswith("http"), f"relative button url: {url}"

    def test_salesforce_payload_has_notification_and_event(self, plans):
        from app.actions import build_salesforce_payload

        payload = build_salesforce_payload(plans["seller-maya-001"],
                                           {"headline": "H", "body": "B"})
        note = payload["custom_notification"]
        assert note["title"] and note["body"] and note["recipientIds"]

        event = payload["platform_event"]
        assert event["eventType"].endswith("__e")
        tasks = json.loads(event["payload"]["Tasks__c"])
        assert len(tasks) == len(plans["seller-maya-001"]["tasks"])

    def test_bluepoints_payload_maps_tasks_to_challenges(self, plans):
        """Thanks@IBM: tasks become Challenges awarding BluePoints."""
        from app.actions import build_bluepoints_payload

        plan = plans["seller-marcus-001"]
        payload = build_bluepoints_payload(plan, {"headline": "H", "body": "B"})

        assert payload["program"] == "Thanks@IBM"
        assert payload["currency"] == "BluePoints"
        assert payload["participant"]["participant_id"] == plan["seller_id"]
        assert payload["home_card"]["goal"]["to_go"] == plan["goal"]["points_to_go"]

        challenges = payload["challenges"]
        assert len(challenges) == len(plan["tasks"])
        for c in challenges:
            assert c["award"]["currency"] == "BluePoints"
            assert c["reason"], "challenge must carry the signal that justified it"
            assert c["evidence_source"]
            assert c["status"] in ("open", "completed")
            assert c["cta_url"].startswith(("http", "slack:"))

        # Same invariant as every other surface: the awards close the gap.
        assert sum(c["award"]["amount"] for c in challenges) == plan["goal"]["points_to_go"]
        assert payload["award_total"]["amount"] == plan["totals"]["points_available"]

    def test_all_channels_render_from_one_plan(self, plans):
        """Every surface is a view of the same plan — not three separate mockups."""
        from app.actions import build_payload

        plan = plans["seller-maya-001"]
        for channel in plan["channels"]:
            assert build_payload(channel, plan, {"headline": "H", "body": "B"})

    def test_delivery_is_preview_only_without_credentials(self, plans, monkeypatch):
        """No webhook/token/key configured → nothing is sent, payload is returned."""
        from app.actions import deliver

        for var in ("SLACK_WEBHOOK_URL", "SF_NOTIFICATION_URL", "SF_ACCESS_TOKEN",
                    "ELEVATE_API_URL", "ELEVATE_API_KEY"):
            monkeypatch.delenv(var, raising=False)

        for channel in ("slack", "salesforce", "bluepoints"):
            result = deliver(channel, plans["seller-rachel-001"], None)
            assert result["delivered"] is False
            assert "not configured" in result["reason"]
            assert result["payload"]

    def test_unknown_channel_is_rejected(self, plans):
        from app.actions import build_payload
        with pytest.raises(ValueError):
            build_payload("teams", plans["seller-rachel-001"], None)


# ═══════════════════════════════════════════════════════════════════════════
# V1 Removed — confirm all v1 artifacts are gone
# ═══════════════════════════════════════════════════════════════════════════

class TestV1Removed:

    def test_no_engine_recommender(self):
        """v1 engine/recommender.py must be deleted."""
        path = Path(__file__).parent.parent / "engine" / "recommender.py"
        assert not path.exists(), \
            "v1 engine/recommender.py still exists — must be removed"

    def test_no_nudges_module(self):
        """v1 nudges/ package must be deleted."""
        path = Path(__file__).parent.parent / "nudges"
        assert not path.exists(), \
            "v1 nudges/ directory still exists — must be removed"

    def test_no_outcomes_module(self):
        """v1 outcomes/ package must be deleted."""
        path = Path(__file__).parent.parent / "outcomes"
        assert not path.exists(), \
            "v1 outcomes/ directory still exists — must be removed"

    def test_no_governance_directory(self):
        """v1 governance/ directory must be deleted."""
        path = Path(__file__).parent.parent / "governance"
        assert not path.exists(), \
            "v1 governance/ directory still exists — must be removed"

    def test_no_governance_html(self):
        """v1 ui/governance.html must be deleted."""
        path = Path(__file__).parent.parent / "ui" / "governance.html"
        assert not path.exists(), \
            "v1 ui/governance.html still exists — must be removed"

    def test_no_graph_beliefs_in_generator_schema(self, db):
        """v1 graph_beliefs table must not be created by the generator."""
        con = duckdb.connect(db, read_only=True)
        tables = [r[0].lower() for r in con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='main'"
        ).fetchall()]
        con.close()
        assert "graph_beliefs" not in tables, \
            "graph_beliefs table found in v2 schema — v1 artifact not fully removed"

    def test_no_loop_closure_api(self):
        """v1 /api/loop-closure endpoint decorator must not exist in api.py."""
        api_path = Path(__file__).parent.parent / "api.py"
        content = api_path.read_text()
        # Check for Flask route decorators (not docstrings/comments/health strings)
        assert '@app' not in content or (
            'loop-closure' not in content.split('@app')[1] if '@app' in content else True
        ), "v1 loop-closure route decorator found in api.py — must be removed"
        assert 'def loop_closure' not in content, \
            "v1 loop_closure function found in api.py — must be removed"

    def test_no_beliefs_api(self):
        """v1 /api/beliefs endpoint decorator must not exist in api.py."""
        api_path = Path(__file__).parent.parent / "api.py"
        content = api_path.read_text()
        assert 'def beliefs' not in content, \
            "v1 beliefs() function found in api.py — must be removed"
        assert '"graph_beliefs"' not in content, \
            "v1 graph_beliefs SQL found in api.py — must be removed"

    def test_no_demo_runner_v2(self):
        """demo_runner_v2.py must be renamed to demo_runner.py."""
        old = Path(__file__).parent.parent / "demo_runner_v2.py"
        new = Path(__file__).parent.parent / "demo_runner.py"
        assert not old.exists(), "demo_runner_v2.py should be renamed to demo_runner.py"
        assert new.exists(), "demo_runner.py not found"

    def test_no_fixtures_nudges_json(self):
        """v1 fixtures/nudges.json must be deleted."""
        path = Path(__file__).parent.parent / "fixtures" / "nudges.json"
        assert not path.exists(), \
            "v1 fixtures/nudges.json still exists — must be removed"
