"""
G — Synthetic Data Generator (v2 DataFabric)
=============================================
Seeded (SEED=20260812), deterministic, byte-identical on re-run.

Generates background signal data for 18+ sources:
  • 3 foreground sellers (Rachel, Marcus, Maya) with behavioral profiles
  • 17 background sellers on the same team
  • 12 months of activity_events  (Jul 2025 → Aug 2026)
  • points_ledger history
  • wishlist entries
  • marketplace_catalog
  • programs + program_paths ("Close Strong")

No graph_beliefs. No flywheel. No loop closure.
The v2 pipeline writes live state to Cassandra and history to Iceberg (B2).
Acceptance (spec G): byte-identical on re-run with SEED=20260812.
"""

import random
import uuid
import json
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Any

import numpy as np
import duckdb

from config import PROGRAM_END, PROGRAM_START, SEED, HISTORY_START
from ibm_services import WatsonxDataSession

# ── Reproducibility ───────────────────────────────────────────────────────────
# Module-level RNG objects — reset to SEED at the start of every generate() call
rng = random.Random(SEED)
np_rng = np.random.default_rng(SEED)

# ── Constants ─────────────────────────────────────────────────────────────────
TEAM_ID      = "team-ibm-001"
MANAGER_ID   = "mgr-001"
FUND_ACCOUNT = "fund-ibm-001"

HIST_START = datetime.fromisoformat(HISTORY_START)
HIST_END   = datetime.fromisoformat(PROGRAM_END)
PROG_START = datetime.fromisoformat(PROGRAM_START)
PROG_END   = datetime.fromisoformat(PROGRAM_END)

# ── Sellers ───────────────────────────────────────────────────────────────────

FOREGROUND_SELLERS = [
    {
        "seller_id":            "seller-rachel-001",
        "display_name":         "Rachel",
        "role":                 "Senior Account Executive",
        "tenure_company_years": 14,
        "tenure_team_months":   168,     # 14 years
        "persona_label":        "Veteran Expert",
        "points_balance":       148_000,
        "lifetime_earned":      190_000,
        "lifetime_redeemed":    42_000,
        "avg_monthly_earn":     1_400,   # ~190k / ~136 months active
    },
    {
        "seller_id":            "seller-marcus-001",
        "display_name":         "Marcus",
        "role":                 "Account Executive",
        "tenure_company_years": 5,
        "tenure_team_months":   60,
        "persona_label":        "Developing Contributor",
        "points_balance":       12_400,
        "lifetime_earned":      88_000,
        "lifetime_redeemed":    75_600,
        "avg_monthly_earn":     1_466,
    },
    {
        "seller_id":            "seller-maya-001",
        "display_name":         "Maya",
        "role":                 "Account Executive",
        "tenure_company_years": 7,
        "tenure_team_months":   6,
        "persona_label":        "Team Transitioner",
        "points_balance":       3_100,
        "lifetime_earned":      4_200,
        "lifetime_redeemed":    1_100,
        "avg_monthly_earn":     700,    # short team history
    },
]

# ── Catalog ───────────────────────────────────────────────────────────────────

CATALOG = [
    # id, name, category, points_cost, is_experiential
    ("cat-001", "Wireless Headphones",        "merchandise",  8_500,  False),
    ("cat-002", "Smartwatch",                 "merchandise", 14_000,  False),
    ("cat-003", "Outdoor Grill",              "merchandise", 22_000,  False),
    ("cat-004", "Team Dinner Experience",     "experience",   6_000,  True),
    ("cat-005", "Weekend Travel Voucher",     "travel",      18_000,  True),
    ("cat-006", "Executive Summit Pass",      "event",       95_000,  True),
    ("cat-007", "City Break (2 nights)",      "travel",      28_000,  True),
    ("cat-008", "Online Course Bundle",       "development",  3_500,  False),
    ("cat-009", "Charity Donation $100",      "charitable",   2_000,  False),
    ("cat-010", "Running Shoes",              "merchandise",  5_500,  False),
    ("cat-011", "Noise-Cancelling Earbuds",   "merchandise",  6_200,  False),
    ("cat-012", "Spa Day Voucher",            "experience",  12_000,  True),
    ("cat-013", "Sports Event Tickets (x2)",  "experience",   9_000,  True),
    ("cat-014", "Tablet",                     "merchandise", 31_000,  False),
    ("cat-015", "Coffee Machine",             "merchandise",  7_800,  False),
]

# ── Wishlists ─────────────────────────────────────────────────────────────────

WISHLISTS = {
    # seller_id → [(item_id, priority, days_ago)]
    "seller-rachel-001":  [],   # deliberately empty — catalog-gap signal
    "seller-marcus-001":  [("cat-001", 1, 45), ("cat-002", 2, 30), ("cat-003", 3, 60)],
    "seller-maya-001":    [("cat-004", 1, 20), ("cat-005", 2, 35)],
}

# ── Programs ──────────────────────────────────────────────────────────────────

PROGRAM_ID     = "prog-close-strong-001"
PROGRAM_PATHS  = [
    ("path-A", PROGRAM_ID, "A", "Update IBM Sales Cloud opportunity records in each of 4 consecutive weeks", 2_500, "crm_update"),
    ("path-B", PROGRAM_ID, "B", "Close at least one deal ≥ $25,000 by program end",                          2_500, "deal_closed"),
    ("path-C", PROGRAM_ID, "C", "Complete one mentorship session or publish one enablement asset",            2_500, "mentorship_session"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def _rand_dt(start: datetime, end: datetime) -> datetime:
    delta = (end - start).total_seconds()
    return start + timedelta(seconds=rng.uniform(0, delta))

def _ts(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")

def _uid() -> str:
    # deterministic UUIDs seeded via rng bytes
    return str(uuid.UUID(bytes=bytes(rng.randint(0, 255) for _ in range(16)), version=4))


# ═══════════════════════════════════════════════════════════════════════════════
# Event generators — one per persona, tightly spec-faithful
# ═══════════════════════════════════════════════════════════════════════════════

def _events_rachel(sid: str) -> list[dict]:
    events = []

    # CRM updates: 71% compliance, consistently late in the week (Thu/Fri)
    # 52 weeks of history; compliant in ~37 of them
    for week_offset in range(52):
        week_start = HIST_START + timedelta(weeks=week_offset)
        if rng.random() < 0.71:
            # Late in week → Thu(3) or Fri(4)
            day_shift = rng.choice([3, 4])
            dt = week_start + timedelta(days=day_shift, hours=rng.randint(9, 17))
            events.append({
                "event_id":      _uid(),
                "seller_id":     sid,
                "event_ts":      _ts(dt),
                "event_type":    "crm_update",
                "program_id":    None,
                "value_numeric": None,
                "metadata":      json.dumps({"compliance_week": week_offset}),
            })

    # Mentorship sessions: 14 in 12 months → roughly one per 3.7 weeks
    for _ in range(14):
        dt = _rand_dt(HIST_START, HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "mentorship_session",
            "program_id":    None,
            "value_numeric": 1,
            "metadata":      json.dumps({"mentee": f"bg-seller-{rng.randint(1,17):03d}"}),
        })

    # Advanced certifications: 3 started AND completed
    for i in range(3):
        dt_start = _rand_dt(HIST_START, HIST_END - timedelta(weeks=4))
        dt_end   = dt_start + timedelta(days=rng.randint(14, 45))
        for etype in ("cert_started", "cert_completed"):
            events.append({
                "event_id":      _uid(),
                "seller_id":     sid,
                "event_ts":      _ts(dt_start if etype == "cert_started" else dt_end),
                "event_type":    etype,
                "program_id":    None,
                "value_numeric": None,
                "metadata":      json.dumps({"cert_id": f"adv-cert-{i+1:02d}"}),
            })

    # Leaderboard views: 0 — deliberately absent (distinguishes from competitive motivation)

    # Catalog browse — Experiences category, 23 visits, 0 saves  (catalog-gap signal)
    for _ in range(23):
        dt = _rand_dt(HIST_START, HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "catalog_browse",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({"category": "experience", "item_id": None}),
        })

    # Deals closed — Rachel is a top performer; ~2–3 per month
    for _ in range(28):
        dt = _rand_dt(HIST_START, HIST_END)
        value = rng.randint(25_000, 180_000)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "deal_closed",
            "program_id":    None,
            "value_numeric": value,
            "metadata":      json.dumps({"deal_value": value}),
        })

    return events


def _events_marcus(sid: str) -> list[dict]:
    events = []

    # CRM updates: 60% compliance, erratic (any day of week)
    for week_offset in range(52):
        week_start = HIST_START + timedelta(weeks=week_offset)
        if rng.random() < 0.60:
            day_shift = rng.randint(0, 4)
            dt = week_start + timedelta(days=day_shift, hours=rng.randint(8, 18))
            events.append({
                "event_id":      _uid(),
                "seller_id":     sid,
                "event_ts":      _ts(dt),
                "event_type":    "crm_update",
                "program_id":    None,
                "value_numeric": None,
                "metadata":      json.dumps({"compliance_week": week_offset}),
            })

    # Leaderboard views: 87 in 12 months
    for _ in range(87):
        dt = _rand_dt(HIST_START, HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "leaderboard_view",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({}),
        })

    # Programs with weekly milestones: high completion; drops after appearing bottom-half
    # Simulate 4 prior programs; in 3 of them he drops after week 2 leaderboard
    for prog_idx in range(4):
        prog_dt = HIST_START + timedelta(weeks=prog_idx * 10)
        for week in range(1, 5):
            milestone_dt = prog_dt + timedelta(weeks=week - 1)
            if week <= 2:
                # Completes early weeks
                events.append({
                    "event_id":      _uid(),
                    "seller_id":     sid,
                    "event_ts":      _ts(milestone_dt + timedelta(days=rng.randint(0, 6))),
                    "event_type":    "crm_update",
                    "program_id":    f"hist-prog-{prog_idx+1:02d}",
                    "value_numeric": None,
                    "metadata":      json.dumps({"milestone_week": week, "prog": prog_idx+1}),
                })
            else:
                # After bottom-half leaderboard (week 2), dropout; only 1 of 4 continues
                if prog_idx == 0:
                    events.append({
                        "event_id":      _uid(),
                        "seller_id":     sid,
                        "event_ts":      _ts(milestone_dt + timedelta(days=rng.randint(0, 6))),
                        "event_type":    "crm_update",
                        "program_id":    f"hist-prog-{prog_idx+1:02d}",
                        "value_numeric": None,
                        "metadata":      json.dumps({"milestone_week": week, "prog": prog_idx+1}),
                    })

    # Certs: 2 started, 0 completed
    for i in range(2):
        dt_start = _rand_dt(HIST_START, HIST_END - timedelta(weeks=8))
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt_start),
            "event_type":    "cert_started",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({"cert_id": f"cert-marcus-{i+1:02d}"}),
        })

    # Deals: developing contributor — moderate deal volume
    for _ in range(10):
        dt = _rand_dt(HIST_START, HIST_END)
        value = rng.randint(8_000, 60_000)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "deal_closed",
            "program_id":    None,
            "value_numeric": value,
            "metadata":      json.dumps({"deal_value": value}),
        })

    return events


def _events_maya(sid: str) -> list[dict]:
    events = []

    # CRM updates: 95% compliance (high discipline)
    for week_offset in range(26):   # only 6 months on team
        week_start = HIST_END - timedelta(weeks=26 - week_offset)
        if rng.random() < 0.95:
            day_shift = rng.randint(0, 4)
            dt = week_start + timedelta(days=day_shift, hours=rng.randint(8, 17))
            events.append({
                "event_id":      _uid(),
                "seller_id":     sid,
                "event_ts":      _ts(dt),
                "event_type":    "crm_update",
                "program_id":    None,
                "value_numeric": None,
                "metadata":      json.dumps({"compliance_week": week_offset}),
            })

    # Peer profile views: 64 in 6 months (belonging signal)
    peer_ids = [f"bg-seller-{i:03d}" for i in range(1, 18)]
    for _ in range(64):
        dt = _rand_dt(HIST_END - timedelta(weeks=26), HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "peer_profile_view",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({"viewed_seller": rng.choice(peer_ids)}),
        })

    # Enablement content consumed: 31 assets in 6 months
    for i in range(31):
        dt = _rand_dt(HIST_END - timedelta(weeks=26), HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "login",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({"action": "enablement_content", "asset_id": f"asset-{i+1:03d}"}),
        })

    # Leaderboard views: 4 (very low — not competitive)
    for _ in range(4):
        dt = _rand_dt(HIST_END - timedelta(weeks=26), HIST_END)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "leaderboard_view",
            "program_id":    None,
            "value_numeric": None,
            "metadata":      json.dumps({}),
        })

    # Deals: strong once ramped (last 3 months)
    for _ in range(7):
        dt = _rand_dt(HIST_END - timedelta(weeks=13), HIST_END)
        value = rng.randint(28_000, 120_000)
        events.append({
            "event_id":      _uid(),
            "seller_id":     sid,
            "event_ts":      _ts(dt),
            "event_type":    "deal_closed",
            "program_id":    None,
            "value_numeric": value,
            "metadata":      json.dumps({"deal_value": value}),
        })

    return events


def _events_background(sid: str) -> list[dict]:
    """Generic background seller — varied behavior, no intentional psychographic."""
    events = []
    crm_rate = rng.uniform(0.5, 0.9)
    lb_views  = rng.randint(0, 60)
    deals     = rng.randint(2, 20)

    for week_offset in range(52):
        week_start = HIST_START + timedelta(weeks=week_offset)
        if rng.random() < crm_rate:
            day_shift = rng.randint(0, 4)
            events.append({
                "event_id":      _uid(),
                "seller_id":     sid,
                "event_ts":      _ts(week_start + timedelta(days=day_shift, hours=rng.randint(8, 18))),
                "event_type":    "crm_update",
                "program_id":    None,
                "value_numeric": None,
                "metadata":      json.dumps({}),
            })

    for _ in range(lb_views):
        dt = _rand_dt(HIST_START, HIST_END)
        events.append({"event_id": _uid(), "seller_id": sid, "event_ts": _ts(dt),
                        "event_type": "leaderboard_view", "program_id": None,
                        "value_numeric": None, "metadata": json.dumps({})})

    for _ in range(deals):
        dt = _rand_dt(HIST_START, HIST_END)
        value = rng.randint(5_000, 80_000)
        events.append({"event_id": _uid(), "seller_id": sid, "event_ts": _ts(dt),
                        "event_type": "deal_closed", "program_id": None,
                        "value_numeric": value, "metadata": json.dumps({"deal_value": value})})

    return events


# ── Ledger helpers ────────────────────────────────────────────────────────────

def _ledger_rows(sellers: list[dict], all_events: list[dict]) -> list[dict]:
    """Build points_ledger from seller history.

    Foreground sellers: exact balances from spec.
    Background sellers: proportional random history.
    """
    rows = []

    def _issue(sid, prog, pts, dt, item=None):
        return {
            "txn_id":           _uid(),
            "seller_id":        sid,
            "program_id":       prog,
            "txn_type":         "issue",
            "points":           pts,
            "ts":               _ts(dt),
            "catalog_item_id":  item,
            "funding_account_id": FUND_ACCOUNT,
        }

    def _redeem(sid, prog, pts, dt, item):
        return {
            "txn_id":           _uid(),
            "seller_id":        sid,
            "program_id":       prog,
            "txn_type":         "redeem",
            "points":           -pts,
            "ts":               _ts(dt),
            "catalog_item_id":  item,
            "funding_account_id": FUND_ACCOUNT,
        }

    # ── Rachel: earned 190k, redeemed 42k, last redemption 14 months ago ──
    sid = "seller-rachel-001"
    # Spread earning over 14 years in large chunks (historical programs)
    chunk_pts = [8_000, 12_000, 15_000, 20_000, 25_000, 18_000, 30_000, 22_000,
                 15_000, 12_000, 8_000, 5_000]
    for i, pts in enumerate(chunk_pts):
        dt = HIST_START - timedelta(days=i * 90 + rng.randint(0, 30))
        rows.append(_issue(sid, f"hist-prog-rachel-{i:02d}", pts, dt))
    # Recent 12 months
    rows.append(_issue(sid, None, 18_000, _rand_dt(HIST_START, HIST_END)))
    # Redemptions totaling 42k — last one ~14 months ago (before HIST_START)
    rows.append(_redeem(sid, None, 20_000, HIST_START - timedelta(days=450), "cat-006"))
    rows.append(_redeem(sid, None, 22_000, HIST_START - timedelta(days=430), "cat-006"))

    # ── Marcus: earned 88k, redeemed 75.6k, last redemption 3 weeks ago ──
    sid = "seller-marcus-001"
    # High-velocity, small-basket redemptions across 5 years
    earn_pts  = [5_000, 8_000, 10_000, 7_000, 6_500, 8_000, 9_000, 7_500,
                 6_000, 8_000, 7_000, 6_000]
    redeem_pts = [4_500, 7_000, 9_500, 6_500, 6_000, 7_500, 8_500, 7_000,
                  5_500, 7_600]
    for i, pts in enumerate(earn_pts):
        dt = HIST_START - timedelta(days=i * 60 + rng.randint(0, 20))
        rows.append(_issue(sid, f"hist-prog-marcus-{i:02d}", pts, dt))
    rows.append(_issue(sid, None, 4_900, _rand_dt(HIST_START, HIST_END)))
    catalog_items = ["cat-001", "cat-010", "cat-011", "cat-013", "cat-009",
                     "cat-008", "cat-010", "cat-001", "cat-011", "cat-009"]
    for i, pts in enumerate(redeem_pts):
        dt = HIST_START - timedelta(days=i * 30 + rng.randint(0, 15))
        rows.append(_redeem(sid, None, pts, dt, catalog_items[i % len(catalog_items)]))
    # Last redemption 3 weeks ago
    rows.append(_redeem(sid, None, 3_000, HIST_END - timedelta(weeks=3), "cat-001"))

    # ── Maya: earned 4.2k, redeemed 1.1k (short team history) ──
    sid = "seller-maya-001"
    rows.append(_issue(sid, None, 2_500, HIST_END - timedelta(weeks=20)))
    rows.append(_issue(sid, None, 1_700, HIST_END - timedelta(weeks=10)))
    rows.append(_redeem(sid, None, 1_100, HIST_END - timedelta(weeks=8), "cat-004"))

    # ── Background sellers ──
    for s in sellers:
        if s["seller_id"].startswith("bg-"):
            earned   = s["lifetime_earned"]
            redeemed = s["lifetime_redeemed"]
            # Single issue + partial redemption (simplified)
            rows.append(_issue(s["seller_id"], None, earned,
                               _rand_dt(HIST_START, HIST_END)))
            if redeemed > 0:
                item = rng.choice(["cat-001","cat-010","cat-008","cat-009"])
                rows.append(_redeem(s["seller_id"], None, redeemed,
                                    _rand_dt(HIST_START, HIST_END), item))
    return rows


# ═══════════════════════════════════════════════════════════════════════════════
# Main generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate(con: WatsonxDataSession | duckdb.DuckDBPyConnection | str) -> None:
    # Reset RNG to SEED so every call produces byte-identical output
    # regardless of what other code ran before this call.
    global np_rng
    rng.seed(SEED)
    np_rng = np.random.default_rng(SEED)

    should_close = False
    if isinstance(con, str):
        Path(con).parent.mkdir(parents=True, exist_ok=True)
        if Path(con).exists():
            Path(con).unlink()
        con = duckdb.connect(con)
        should_close = True

    _create_schema(con)

    # ── Sellers ───────────────────────────────────────────────────────────────
    bg_sellers = []
    for i in range(1, 18):
        earned   = rng.randint(5_000, 60_000)
        redeemed = int(earned * rng.uniform(0.1, 0.9))
        bg_sellers.append({
            "seller_id":            f"bg-seller-{i:03d}",
            "display_name":         f"Seller {i:02d}",
            "role":                 rng.choice(["Account Executive", "Sr. Account Executive",
                                                "Strategic Account Manager"]),
            "tenure_company_years": rng.randint(1, 12),
            "tenure_team_months":   rng.randint(6, 120),
            "persona_label":        None,
            "points_balance":       earned - redeemed,
            "lifetime_earned":      earned,
            "lifetime_redeemed":    redeemed,
            "avg_monthly_earn":     int(earned / rng.randint(6, 36)),
        })

    all_sellers = FOREGROUND_SELLERS + bg_sellers
    for s in all_sellers:
        con.execute(
            """INSERT INTO sellers VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            [s["seller_id"], s["display_name"], s["role"],
             s["tenure_company_years"], s["tenure_team_months"],
             s.get("persona_label"), TEAM_ID, MANAGER_ID,
             s["points_balance"], s["lifetime_earned"],
             s["lifetime_redeemed"], s.get("avg_monthly_earn", 0)],
        )

    # ── Catalog ───────────────────────────────────────────────────────────────
    for row in CATALOG:
        con.execute("INSERT INTO marketplace_catalog VALUES (?,?,?,?,?)", list(row))

    # ── Wishlists ─────────────────────────────────────────────────────────────
    for sid, items in WISHLISTS.items():
        for (item_id, priority, days_ago) in items:
            saved_ts = _ts(HIST_END - timedelta(days=days_ago))
            con.execute("INSERT INTO wishlist VALUES (?,?,?,?)",
                        [sid, item_id, saved_ts, priority])

    # ── Activity events ───────────────────────────────────────────────────────
    all_events: list[dict] = []
    all_events += _events_rachel("seller-rachel-001")
    all_events += _events_marcus("seller-marcus-001")
    all_events += _events_maya("seller-maya-001")
    for bg in bg_sellers:
        all_events += _events_background(bg["seller_id"])

    for e in all_events:
        con.execute(
            """INSERT INTO activity_events VALUES (?,?,?,?,?,?,?)""",
            [e["event_id"], e["seller_id"], e["event_ts"], e["event_type"],
             e.get("program_id"), e.get("value_numeric"), e["metadata"]],
        )

    # ── Points ledger ─────────────────────────────────────────────────────────
    for row in _ledger_rows(all_sellers, all_events):
        con.execute(
            """INSERT INTO points_ledger VALUES (?,?,?,?,?,?,?,?)""",
            [row["txn_id"], row["seller_id"], row["program_id"], row["txn_type"],
             row["points"], row["ts"], row["catalog_item_id"], row["funding_account_id"]],
        )

    # ── Programs ──────────────────────────────────────────────────────────────
    for arm in ("uniform", "personalized"):
        pid = f"{PROGRAM_ID}-{arm}"
        con.execute("INSERT INTO programs VALUES (?,?,?,?,?,?,?)",
                    [pid, "Close Strong", PROGRAM_START, PROGRAM_END, "8", 50_000, arm])
        for path in PROGRAM_PATHS:
            con.execute("INSERT INTO program_paths VALUES (?,?,?,?,?,?)",
                        [f"{path[0]}-{arm}", pid, path[2], path[3], path[4], path[5]])

    if should_close:
        con.close()
        print(f"[C1] Database generated → local duckdb test store")
    else:
        host = getattr(con, "engine_host", "watsonx.data")
        catalog = getattr(con, "catalog", "")
        schema = getattr(con, "schema", "")
        print(f"[C1] watsonx.data seeded → {host}/{catalog}/{schema}")
    print(f"[C1] Sellers: {len(all_sellers)} | Events: {len(all_events)}")



def _create_schema(con: WatsonxDataSession | duckdb.DuckDBPyConnection) -> None:
    # v2: graph_beliefs, outcomes, nudges, decisions are not in the schema.
    # History lives in Iceberg (B2); live state in Cassandra (B2).
    for table_name in [
        "program_paths",
        "programs",
        "wishlist",
        "marketplace_catalog",
        "points_ledger",
        "activity_events",
        "sellers",
    ]:
        con.execute(f"DROP TABLE IF EXISTS {table_name}")

    con.execute("""
    CREATE TABLE sellers (
        seller_id             VARCHAR PRIMARY KEY,
        display_name          VARCHAR,
        role                  VARCHAR,
        tenure_company_years  INTEGER,
        tenure_team_months    INTEGER,
        persona_label         VARCHAR,
        team_id               VARCHAR,
        manager_id            VARCHAR,
        points_balance        BIGINT,
        lifetime_earned       BIGINT,
        lifetime_redeemed     BIGINT,
        avg_monthly_earn      INTEGER
    )""")

    con.execute("""
    CREATE TABLE activity_events (
        event_id       VARCHAR PRIMARY KEY,
        seller_id      VARCHAR,
        event_ts       TIMESTAMP,
        event_type     VARCHAR,
        program_id     VARCHAR,
        value_numeric  DOUBLE,
        metadata       JSON
    )""")

    con.execute("""
    CREATE TABLE points_ledger (
        txn_id             VARCHAR PRIMARY KEY,
        seller_id          VARCHAR,
        program_id         VARCHAR,
        txn_type           VARCHAR,
        points             BIGINT,
        ts                 TIMESTAMP,
        catalog_item_id    VARCHAR,
        funding_account_id VARCHAR
    )""")

    con.execute("""
    CREATE TABLE marketplace_catalog (
        item_id        VARCHAR PRIMARY KEY,
        name           VARCHAR,
        category       VARCHAR,
        points_cost    INTEGER,
        is_experiential BOOLEAN
    )""")

    con.execute("""
    CREATE TABLE wishlist (
        seller_id  VARCHAR,
        item_id    VARCHAR,
        saved_ts   TIMESTAMP,
        priority   INTEGER
    )""")

    con.execute("""
    CREATE TABLE programs (
        program_id     VARCHAR PRIMARY KEY,
        name           VARCHAR,
        start_date     DATE,
        end_date       DATE,
        structure_type VARCHAR,
        budget_points  BIGINT,
        arm            VARCHAR
    )""")

    con.execute("""
    CREATE TABLE program_paths (
        path_id          VARCHAR PRIMARY KEY,
        program_id       VARCHAR,
        path_code        VARCHAR,
        requirement_desc VARCHAR,
        points_value     INTEGER,
        activity_type    VARCHAR
    )""")

    # No graph_beliefs, decisions, nudges, or outcomes tables in v2.
    # Those were v1 artifacts (flywheel / loop-closure).


if __name__ == "__main__":
    import os
    db_path = os.path.join(os.path.dirname(__file__), "motivation_graph.duckdb")
    generate(db_path)
