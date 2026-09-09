"""
API Backend — v2 DataFabric
============================
Serves the B5 thin nudge app, B6 control view, and B3/B4 federation queries.
No graph, no beliefs, no loop closure, no governance. (v2 spec §B5, §B6, §10)

All v1 endpoints (/api/beliefs, /api/loop-closure, /api/catalog-gap,
/api/decisions, /api/outcomes) have been removed.
"""

import json
import sys
import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_PATH

app = Flask(__name__)
CORS(app)

# ── v2 DataFabric endpoints ───────────────────────────────────────────────────

# Register B6 control-view + B3/B4 federation endpoints
from streaming.control_view import bp as v2_bp
app.register_blueprint(v2_bp)


# ── B5 — Nudge (thin lens, implementation-agnostic) ───────────────────────────

@app.get("/api/nudge/<seller_id>")
def nudge(seller_id: str):
    """
    B5: Return a personalized motivation nudge for one seller.
    Draws on ≥3 unified sources: Salesforce CDC, Slack Events, Databricks historical.
    No graph, no networkx. (§B5, §A7, §10)
    """
    try:
        con = _open_db()
        try:
            # Cached so the Elevate card, the Salesforce component and the
            # Slack DM all show the identical wx.ai text (see _cached_nudge).
            result = _cached_nudge(con, seller_id)
        finally:
            con.close()
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc), "seller_id": seller_id}), 500


@app.get("/api/nudge")
def nudge_default():
    return nudge("seller-rachel-001")


# ── B5b — Actionable tasks + seller-persona delivery surfaces ─────────────────

def _open_db():
    import duckdb
    return duckdb.connect(DB_PATH, read_only=True)


# The nudge headline/body come from watsonx.ai and take a few seconds. Cache
# them briefly per seller so switching channels, previewing payloads and
# delivering all show the *same* text the seller is looking at — a different
# LLM headline on each surface would undercut the whole "one nudge, every
# surface" point (and add a 5s wait to every tab click).
_NUDGE_TTL_SECONDS = 300
_nudge_cache: dict[str, tuple[float, dict]] = {}
_nudge_locks: dict[str, "threading.Lock"] = {}
_nudge_locks_guard = threading.Lock()


def _cached_nudge(con, seller_id: str) -> dict:
    import time

    from app.nudge import generate_motivation_nudge_duckdb

    def _hit():
        entry = _nudge_cache.get(seller_id)
        if entry and (time.time() - entry[0]) < _NUDGE_TTL_SECONDS:
            return entry[1]
        return None

    cached = _hit()
    if cached:
        return cached

    # The UI loads several surfaces at once; without a per-seller lock each
    # concurrent request would fire its own wx.ai generation and they'd all
    # come back with different headlines.
    with _nudge_locks_guard:
        lock = _nudge_locks.setdefault(seller_id, threading.Lock())
    with lock:
        cached = _hit()          # another thread may have filled it while we waited
        if cached:
            return cached
        fresh = generate_motivation_nudge_duckdb(con, seller_id)
        _nudge_cache[seller_id] = (time.time(), fresh)
        return fresh


def _plan_and_nudge(seller_id: str, with_nudge: bool = True):
    """Build the action plan and (optionally) the nudge from one DB connection."""
    from app.actions import build_action_plan

    con = _open_db()
    try:
        plan = build_action_plan(con, seller_id)
        n = _cached_nudge(con, seller_id) if with_nudge else None
    finally:
        con.close()
    return plan, n


@app.get("/api/actions/<seller_id>")
def actions(seller_id: str):
    """
    B5b: the seller's actionable task list — what to do right now to earn the
    points that close their gap. Same unified signals as the nudge; the nudge
    is embedded so a single call renders any delivery surface.
    """
    try:
        include_nudge = request.args.get("nudge", "1") != "0"
        plan, n = _plan_and_nudge(seller_id, with_nudge=include_nudge)
        if n:
            plan["nudge"] = {
                "headline":      n.get("headline"),
                "body":          n.get("body"),
                "framing":       n.get("framing"),
                "ai_generated":  n.get("ai_generated", False),
                "ai_model_id":   n.get("ai_model_id"),
                "ai_request_id": n.get("ai_request_id"),
            }
        return jsonify(plan)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc), "seller_id": seller_id}), 500


@app.post("/api/actions/<seller_id>/complete")
def actions_complete(seller_id: str):
    """Mark one task done and return the updated plan (demo state, in-memory)."""
    from app.actions import build_action_plan, mark_complete

    body = request.get_json(silent=True) or {}
    task_id = body.get("task_id", "")
    if not mark_complete(seller_id, task_id):
        return jsonify({"error": f"unknown task_id {task_id!r} for {seller_id}"}), 400

    con = _open_db()
    try:
        return jsonify(build_action_plan(con, seller_id))
    finally:
        con.close()


@app.post("/api/actions/<seller_id>/reset")
def actions_reset(seller_id: str):
    """Clear completion state for one seller — used between demo runs."""
    from app.actions import build_action_plan, reset

    # Only task state is cleared — the cached wx.ai nudge is deliberately kept
    # so a reset mid-demo doesn't swap the headline out from under the seller.
    reset(seller_id)
    con = _open_db()
    try:
        return jsonify(build_action_plan(con, seller_id))
    finally:
        con.close()


@app.get("/api/actions/<seller_id>/payload/<channel>")
def actions_payload(seller_id: str, channel: str):
    """
    The exact JSON that would be POSTed to the channel:
      slack      → chat.postMessage body (Block Kit)
      salesforce → CustomNotification body + Elevate_Nudge__e platform event
    """
    from app.actions import build_payload

    try:
        plan, n = _plan_and_nudge(seller_id)
        return jsonify({
            "channel":   channel,
            "seller_id": seller_id,
            "payload":   build_payload(channel, plan, n),
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc), "seller_id": seller_id}), 500


@app.post("/api/actions/<seller_id>/deliver")
def actions_deliver(seller_id: str):
    """
    Push the nudge to Salesforce or Slack. Sends for real only when the
    channel credentials are configured (SLACK_WEBHOOK_URL / SF_ACCESS_TOKEN);
    otherwise returns the payload as a preview with delivered=false.
    """
    from app.actions import deliver

    body = request.get_json(silent=True) or {}
    channel = body.get("channel", "slack")
    try:
        plan, n = _plan_and_nudge(seller_id)
        return jsonify(deliver(channel, plan, n))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc), "seller_id": seller_id}), 500


# ── Sellers ───────────────────────────────────────────────────────────────────

@app.get("/api/sellers")
def sellers():
    """Return foreground sellers for the UI."""
    import duckdb
    con = duckdb.connect(DB_PATH, read_only=True)
    rows = con.execute(
        "SELECT seller_id, display_name, role, persona_label, "
        "points_balance, lifetime_earned, lifetime_redeemed, "
        "tenure_company_years, tenure_team_months "
        "FROM sellers WHERE persona_label IS NOT NULL"
    ).fetchall()
    con.close()
    return jsonify([{
        "seller_id":            r[0],
        "display_name":         r[1],
        "role":                 r[2],
        "persona_label":        r[3],
        "points_balance":       r[4],
        "lifetime_earned":      r[5],
        "lifetime_redeemed":    r[6],
        "tenure_company_years": r[7],
        "tenure_team_months":   r[8],
    } for r in rows])


# ── B8 Console — short-path aliases (proxies to /api/v2 endpoints) ───────────

@app.post("/api/inject")
def inject_alias():
    """
    B8 console shortcut: POST /api/inject → /api/v2/events/inject
    Accepts optional JSON body {seller_id, source}.
    """
    from streaming.control_view import inject_event
    return inject_event()


@app.get("/api/federated-result")
def federated_result_alias():
    """
    B8 console shortcut: GET /api/federated-result → /api/v2/federation/b4
    Returns the B4 money-shot result (live + history + Databricks in place).
    """
    from streaming.control_view import federation_b4
    return federation_b4()


# ── UI static files ───────────────────────────────────────────────────────────

_UI_DIR = Path(__file__).parent / "ui"

@app.get("/")
@app.get("/console")
def console_ui():
    """Serve the demo console UI."""
    return send_from_directory(_UI_DIR, "console.html")

@app.get("/seller")
def seller_ui():
    """Serve the seller-persona view (Salesforce + Slack delivery surfaces)."""
    return send_from_directory(_UI_DIR, "seller.html")

@app.get("/seller_surfaces.<ext>")
def seller_assets(ext: str):
    """
    Serve the surface bundle at the document root as well as under /ui/.
    seller.html references these relatively so it also opens straight off
    disk (file://), which is how run.sh launches the UIs.
    """
    if ext not in ("js", "css"):
        return jsonify({"error": "not found"}), 404
    return send_from_directory(_UI_DIR, f"seller_surfaces.{ext}")

@app.get("/ui/<path:filename>")
def ui_static(filename: str):
    """Serve any file from the ui/ directory (CSS, JS, assets)."""
    return send_from_directory(_UI_DIR, filename)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "version": "v2-datafabric",
        "v2_endpoints": [
            "GET  /api/nudge/<seller_id>",
            "GET  /api/actions/<seller_id>",
            "POST /api/actions/<seller_id>/complete",
            "POST /api/actions/<seller_id>/reset",
            "GET  /api/actions/<seller_id>/payload/<channel>",
            "POST /api/actions/<seller_id>/deliver",
            "GET  /api/sellers",
            "GET  /api/v2/sources",
            "GET  /api/v2/pipeline/status",
            "GET  /api/v2/federation/b3",
            "GET  /api/v2/federation/b4",
            "POST /api/v2/events/inject",
            "POST /api/v2/events/feed",
            "GET  /api/v2/events/live",
            "GET  /api/v2/events/stream  (SSE — real-time push)",
        ],
        "b8_console_aliases": [
            "POST /api/inject           → /api/v2/events/inject",
            "GET  /api/federated-result → /api/v2/federation/b4",
        ],
        "console_ui": "ui/console.html",
        "seller_ui":  "ui/seller.html  (served at /seller)",
        "removed_v1_endpoints": [
            "/api/beliefs",
            "/api/loop-closure",
            "/api/catalog-gap",
            "/api/decisions",
            "/api/outcomes",
        ],
    })


if __name__ == "__main__":
    import os

    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5050")), debug=False, threaded=True)
