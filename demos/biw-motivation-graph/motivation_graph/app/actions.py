"""
B5b — Actionable Nudge Delivery (seller persona surfaces)
=========================================================
Turns the B5 motivation nudge into a *list of actions the seller can take
right now to earn the points that close their gap*, and renders that list
as native payloads for the two surfaces the seller already lives in:

    Salesforce  — Lightning component + custom notification
    Slack       — Block Kit app message (DM from the Elevate app)

Design notes
------------
* The nudge answers "why should I care".  The action list answers "what do I
  do next".  Both are assembled from the same unified signals (Salesforce CDC
  live + Slack Events live + Databricks historical, query-in-place) so the
  data-integration value stays legible on every surface.

* Every task carries the *signal that justified it* (`why` + `source`), so the
  seller sees the platform reasoning, not a generic to-do list.

* Task points for each seller sum exactly to that seller's `points_to_go` —
  the gap is always closeable, which is the whole motivation mechanic.

* Completion state is in-memory only (demo scope).  Nothing is written back to
  Salesforce or Slack; `build_*_payload()` returns the exact JSON that *would*
  be POSTed, and `deliver()` only sends it when a real webhook/token is
  configured in the environment (absent by default).
"""

from __future__ import annotations

import copy
import json
import logging
import os
from datetime import datetime, timezone
from threading import Lock

log = logging.getLogger(__name__)

ENGINE_VERSION = "actions-v1.0"

# ── Channel constants ─────────────────────────────────────────────────────────

CH_SALESFORCE = "salesforce"
CH_SLACK = "slack"
CH_BLUEPOINTS = "bluepoints"

# Task deeplinks are stored as Lightning-relative paths; Slack buttons need an
# absolute URL, so they get prefixed with the org's instance URL.
SF_INSTANCE_URL = os.getenv("SF_INSTANCE_URL", "https://biw-sales.lightning.force.com").rstrip("/")

# Thanks@IBM — the live Elevate deployment. Tasks surface there as Challenges
# and the award currency is BluePoints rather than generic "points".
ELEVATE_PROGRAM = os.getenv("ELEVATE_PROGRAM", "Thanks@IBM")
ELEVATE_CURRENCY = os.getenv("ELEVATE_CURRENCY", "BluePoints")

# Source labels — kept identical to app/nudge.py so both lenses agree
SRC_SF = "Salesforce CDC (live → Cassandra/Iceberg via B2)"
SRC_SLACK = "Slack Events (real-time → Cassandra/Iceberg via B2)"
SRC_DBX = "Databricks Delta (historical — query-in-place via B4)"


# ── Per-seller action plans ───────────────────────────────────────────────────
# Points are tuned so sum(tasks) == goal.points_to_go for each seller.
# `why` strings are grounded in the seller's actual unified signals; the
# {placeholders} are filled from the live SQL signal extraction below.

_PLANS = {
    # ── Rachel — Veteran Expert · 800 pts to go ──────────────────────────────
    "seller-rachel-001": {
        "goal": {
            "label": "Executive Summit stage invite",
            "kind": "Q3 recognition tier",
            "icon": "🏆",
            "target_points": 12000,
        },
        "tasks": [
            {
                "task_id": "rachel-coaching",
                "points": 300,
                "title": "Log a coaching session",
                "subtitle": "Record the enablement time you already gave",
                "why": "Two reps on your team closed within 48h of your last session — "
                       "that lift only counts toward Summit if it's logged.",
                "source": SRC_DBX,
                "source_short": "Databricks · historical influence",
                "channel": CH_SALESFORCE,
                "cta": "Log session",
                "deeplink": "/lightning/o/Coaching_Session__c/new",
                "est_minutes": 4,
                "due": "This week",
            },
            {
                "task_id": "rachel-win-story",
                "points": 250,
                "title": "Submit a win story",
                "subtitle": "Write up the close the field keeps asking about",
                "why": "Salesforce has {sf_deals} closes under your name. Win stories from "
                       "veteran AEs are the most-reused enablement asset on the team.",
                "source": SRC_SF,
                "source_short": "Salesforce · deal closed",
                "channel": CH_SALESFORCE,
                "cta": "Write story",
                "deeplink": "/lightning/o/Win_Story__c/new",
                "est_minutes": 10,
                "due": "Fri",
            },
            {
                "task_id": "rachel-crm-audit",
                "points": 150,
                "title": "Complete CRM audit",
                "subtitle": "Clear next-step dates on open opportunities",
                "why": "You've logged {sf_updates} CRM updates this cycle — the audit "
                       "closes the last gaps before quarter-end forecasting.",
                "source": SRC_SF,
                "source_short": "Salesforce CDC · pipeline hygiene",
                "channel": CH_SALESFORCE,
                "cta": "Open audit",
                "deeplink": "/lightning/o/Opportunity/list?filterName=Needs_Next_Step",
                "est_minutes": 12,
                "due": "Fri",
            },
            {
                "task_id": "rachel-peer-kudos",
                "points": 100,
                "title": "Post a peer recognition",
                "subtitle": "Pass on some of what you've been getting",
                "why": "You've received {recognitions} recognitions this cycle. "
                       "Recognition you give travels further than recognition you get.",
                "source": SRC_SLACK,
                "source_short": "Slack Events · peer recognition",
                "channel": CH_SLACK,
                "cta": "Give kudos",
                "deeplink": "slack://channel?team=BIW&id=sales-wins",
                "est_minutes": 2,
                "due": "Today",
            },
        ],
    },

    # ── Marcus — Developing Contributor · 1,600 pts to go ────────────────────
    "seller-marcus-001": {
        "goal": {
            "label": "Smartwatch",
            "kind": "Wishlist reward · 14,000 pts",
            "icon": "⌚",
            "target_points": 14000,
        },
        "tasks": [
            {
                "task_id": "marcus-close-deal",
                "points": 500,
                "title": "Close a deal this week",
                "subtitle": "Your top opportunity is one signature out",
                "why": "Salesforce has {sf_deals} closes under your name and your "
                       "late-stage pipeline is the healthiest it's been all quarter.",
                "source": SRC_SF,
                "source_short": "Salesforce CDC · late-stage pipeline",
                "channel": CH_SALESFORCE,
                "cta": "Open pipeline",
                "deeplink": "/lightning/o/Opportunity/list?filterName=Closing_This_Week",
                "est_minutes": 30,
                "due": "Fri",
            },
            {
                "task_id": "marcus-pipeline-records",
                "points": 400,
                "title": "Update 5 pipeline records",
                "subtitle": "Stale opportunities are dragging your forecast",
                "why": "You've logged {sf_updates} CRM updates — your hygiene streak "
                       "is the team's best. Five records are still missing amounts.",
                "source": SRC_SF,
                "source_short": "Salesforce CDC · CRM updates",
                "channel": CH_SALESFORCE,
                "cta": "Update records",
                "deeplink": "/lightning/o/Opportunity/list?filterName=Stale_14d",
                "est_minutes": 15,
                "due": "Wed",
            },
            {
                "task_id": "marcus-cert",
                "points": 400,
                "title": "Complete a sales cert",
                "subtitle": "Advanced Negotiation — you're most of the way there",
                "why": "Databricks history shows {db_velocity} deals closed in 90 days. "
                       "Negotiation certification is the step that moves deal size, not count.",
                "source": SRC_DBX,
                "source_short": "Databricks · 90-day velocity",
                "channel": CH_SALESFORCE,
                "cta": "Resume cert",
                "deeplink": "/lightning/n/Enablement",
                "est_minutes": 45,
                "due": "Next Tue",
            },
            {
                "task_id": "marcus-best-practice",
                "points": 300,
                "title": "Share a best practice",
                "subtitle": "Post how you keep pipeline hygiene at 100%",
                "why": "Your CRM discipline is measurably above the team median — "
                       "the rest of the floor would use it if you wrote it down.",
                "source": SRC_SLACK,
                "source_short": "Slack Events · team channel",
                "channel": CH_SLACK,
                "cta": "Post to #sales-floor",
                "deeplink": "slack://channel?team=BIW&id=sales-floor",
                "est_minutes": 6,
                "due": "This week",
            },
        ],
    },

    # ── Maya — Team Transitioner · 2,100 pts to go ───────────────────────────
    "seller-maya-001": {
        "goal": {
            "label": "Team Dinner Experience",
            "kind": "Wishlist reward · 6,000 pts",
            "icon": "🎉",
            "target_points": 6000,
        },
        "tasks": [
            {
                "task_id": "maya-second-deal",
                "points": 700,
                "title": "Close your 2nd deal",
                "subtitle": "First one landed — the second one sets the pattern",
                "why": "Your first close on the new team already landed in Salesforce. "
                       "Databricks ramp curves say deal #2 is the real inflection point.",
                "source": SRC_SF,
                "source_short": "Salesforce CDC · first close",
                "channel": CH_SALESFORCE,
                "cta": "Open pipeline",
                "deeplink": "/lightning/o/Opportunity/list?filterName=My_Open_Opps",
                "est_minutes": 30,
                "due": "This month",
            },
            {
                "task_id": "maya-discovery-calls",
                "points": 500,
                "title": "Log 3 discovery calls",
                "subtitle": "Top of funnel is where ramp speed is decided",
                "why": "Databricks ramp data shows reps who log 3+ discovery calls a "
                       "week in month 6 hit quota a full quarter earlier.",
                "source": SRC_DBX,
                "source_short": "Databricks · ramp curve",
                "channel": CH_SALESFORCE,
                "cta": "Log calls",
                "deeplink": "/lightning/o/Task/new?recordType=Discovery_Call",
                "est_minutes": 8,
                "due": "Fri",
            },
            {
                "task_id": "maya-onboarding-cert",
                "points": 500,
                "title": "Complete onboarding cert",
                "subtitle": "Last two modules of the new-team track",
                "why": "You've consumed more enablement than anyone in your cohort — "
                       "finishing the track converts that into territory credit.",
                "source": SRC_DBX,
                "source_short": "Databricks · enablement history",
                "channel": CH_SALESFORCE,
                "cta": "Resume cert",
                "deeplink": "/lightning/n/Enablement",
                "est_minutes": 40,
                "due": "Next Fri",
            },
            {
                "task_id": "maya-peer-kudos",
                "points": 400,
                "title": "Get 2 more peer kudos",
                "subtitle": "Pair up on a live deal this week",
                "why": "Slack is where this team keeps score of each other. Two shout-outs "
                       "after a paired deal and you're fully on their recognition map.",
                "source": SRC_SLACK,
                "source_short": "Slack Events · peer recognition",
                "channel": CH_SLACK,
                "cta": "Open #new-team",
                "deeplink": "slack://channel?team=BIW&id=team-transitions",
                "est_minutes": 5,
                "due": "This week",
            },
        ],
    },
}

_DEFAULT_SELLER = "seller-rachel-001"


# ── In-memory completion state (demo scope) ───────────────────────────────────

_state_lock = Lock()
_completed: dict[str, set[str]] = {}


def _completed_for(seller_id: str) -> set[str]:
    with _state_lock:
        return set(_completed.get(seller_id, set()))


def mark_complete(seller_id: str, task_id: str) -> bool:
    """Mark one task done. Returns False if the task id is unknown."""
    plan = _PLANS.get(seller_id)
    if not plan or not any(t["task_id"] == task_id for t in plan["tasks"]):
        return False
    with _state_lock:
        _completed.setdefault(seller_id, set()).add(task_id)
    return True


def reset(seller_id: str | None = None) -> None:
    """Clear completion state — used between demo runs."""
    with _state_lock:
        if seller_id:
            _completed.pop(seller_id, None)
        else:
            _completed.clear()


# ── Signals ───────────────────────────────────────────────────────────────────

def _signals(con, seller_id: str) -> dict:
    """
    Pull the same unified signals the nudge uses, so the action list and the
    nudge are provably reading one set of numbers. Falls back to zeros when the
    connection is unavailable — the plan still renders.
    """
    fallback = {
        "display_name": seller_id,
        "persona_label": "",
        "points_balance": 0,
        "sf_deals": 0,
        "sf_updates": 0,
        "recognitions": 0,
        "db_velocity": 0,
    }
    if con is None:
        return fallback

    try:
        def qn(sql, params):
            row = con.execute(sql, params).fetchone()
            return (row[0] if row else 0) or 0

        seller = con.execute(
            "SELECT display_name, persona_label, points_balance "
            "FROM sellers WHERE seller_id=?", [seller_id],
        ).fetchone()

        return {
            "display_name":  seller[0] if seller else seller_id,
            "persona_label": seller[1] if seller else "",
            "points_balance": seller[2] if seller else 0,
            "sf_deals": qn(
                "SELECT COUNT(*) FROM activity_events "
                "WHERE seller_id=? AND event_type='deal_closed'", [seller_id]),
            "sf_updates": qn(
                "SELECT COUNT(*) FROM activity_events "
                "WHERE seller_id=? AND event_type='crm_update'", [seller_id]),
            "recognitions": qn(
                "SELECT COUNT(*) FROM activity_events WHERE seller_id=? "
                "AND event_type IN ('peer_recognition','mentorship_session')", [seller_id]),
            "db_velocity": qn(
                "SELECT COUNT(*) FROM activity_events WHERE seller_id=? "
                "AND event_type='deal_closed' "
                "AND event_ts >= (now() - INTERVAL '90 days')", [seller_id]),
        }
    except Exception as exc:  # noqa: BLE001
        log.info("action signal extraction failed (%s) — using zeros", exc)
        return fallback


# ── Plan assembly ─────────────────────────────────────────────────────────────

def build_action_plan(con, seller_id: str) -> dict:
    """
    Build the seller's actionable task list plus goal progress.

    Returns a channel-agnostic dict — `build_slack_payload()` and
    `build_salesforce_payload()` both render from this exact structure, which is
    what makes "same nudge, every surface" true rather than three mockups.
    """
    plan = copy.deepcopy(_PLANS.get(seller_id) or _PLANS[_DEFAULT_SELLER])
    sig = _signals(con, seller_id)
    done = _completed_for(seller_id)

    tasks = []
    for t in plan["tasks"]:
        t["why"] = t["why"].format(
            sf_deals=sig["sf_deals"],
            sf_updates=sig["sf_updates"],
            recognitions=sig["recognitions"],
            db_velocity=sig["db_velocity"],
        )
        t["completed"] = t["task_id"] in done
        tasks.append(t)

    total_points = sum(t["points"] for t in tasks)
    earned_now = sum(t["points"] for t in tasks if t["completed"])
    remaining = total_points - earned_now

    goal = plan["goal"]
    target = goal["target_points"]
    # Progress toward the goal, not raw redeemable balance: the seller starts
    # the plan `total_points` short and each completed task closes the gap.
    baseline = target - total_points
    goal.update({
        "points_to_go":   remaining,
        "points_earned":  baseline + earned_now,
        "percent":        round(100.0 * (baseline + earned_now) / target, 1) if target else 0.0,
        "start_percent":  round(100.0 * baseline / target, 1) if target else 0.0,
    })

    return {
        "seller_id":      seller_id,
        "display_name":   sig["display_name"],
        "persona_label":  sig["persona_label"],
        "points_balance": sig["points_balance"],
        "goal":           goal,
        "tasks":          tasks,
        "totals": {
            "task_count":       len(tasks),
            "completed_count":  len(done & {t["task_id"] for t in tasks}),
            "points_available": total_points,
            "points_remaining": remaining,
        },
        "unified_sources": [SRC_SF, SRC_SLACK, SRC_DBX],
        "channels":       [CH_SALESFORCE, CH_SLACK, CH_BLUEPOINTS],
        "currency":       ELEVATE_CURRENCY,
        "engine_version": ENGINE_VERSION,
        "generated_at":   datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "_simulated_data": True,
        "_real_engines":   True,
    }


# ── Channel payloads ──────────────────────────────────────────────────────────

def build_slack_payload(plan: dict, nudge: dict | None = None) -> dict:
    """
    Slack Block Kit payload — the exact body for `chat.postMessage`.
    Rendered as a DM to the seller from the Elevate app.
    """
    headline = (nudge or {}).get("headline") or f"{plan['display_name']}, here's your next move"
    body = (nudge or {}).get("body") or ""
    goal = plan["goal"]
    to_go = goal["points_to_go"]

    filled = int(round(goal["percent"] / 10))
    meter = "█" * filled + "░" * (10 - filled)

    blocks: list[dict] = [
        {"type": "header", "text": {"type": "plain_text", "text": f"{goal['icon']} {headline}", "emoji": True}},
    ]
    if body:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": body}})

    blocks += [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (f"*{goal['label']}*\n`{meter}` "
                         f"{goal['points_earned']:,} / {goal['target_points']:,} pts\n"
                         f"*{to_go:,} pts to go* — the tasks below add up to exactly that."),
            },
        },
        {"type": "divider"},
    ]

    for t in plan["tasks"]:
        check = "✅ ~" if t["completed"] else ""
        close = "~" if t["completed"] else ""
        section = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (f"{check}*+{t['points']} pts · {t['title']}*{close}\n"
                         f"{t['subtitle']}\n_{t['why']}_"),
            },
        }
        if not t["completed"]:
            section["accessory"] = {
                "type": "button",
                "text": {"type": "plain_text", "text": t["cta"], "emoji": True},
                "style": "primary" if t is plan["tasks"][0] else None,
                "action_id": f"elevate_task::{t['task_id']}",
                "value": f"{plan['seller_id']}::{t['task_id']}",
                "url": (SF_INSTANCE_URL + t["deeplink"]) if t["channel"] == CH_SALESFORCE else None,
            }
            # Slack rejects null keys — strip them
            section["accessory"] = {k: v for k, v in section["accessory"].items() if v is not None}
        blocks.append(section)
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn",
                          "text": f"⏱ ~{t['est_minutes']} min · due {t['due']} · from {t['source_short']}"}],
        })

    blocks += [
        {"type": "divider"},
        {
            "type": "context",
            "elements": [{
                "type": "mrkdwn",
                "text": ("Assembled from 3 unified sources: Salesforce CDC · Slack Events · "
                         "Databricks (query-in-place). _Simulated data._"),
            }],
        },
    ]

    return {
        "channel": f"@{plan['display_name'].lower()}",
        "text": f"{headline} — {to_go:,} pts to go",   # notification fallback
        "blocks": blocks,
        "unfurl_links": False,
    }


def build_salesforce_payload(plan: dict, nudge: dict | None = None) -> dict:
    """
    Salesforce payload pair:
      * `custom_notification` — body for the Messaging/CustomNotification API
        (the bell + mobile push the seller actually sees).
      * `platform_event` — Elevate_Nudge__e event carrying the full task list
        for the Lightning component to render on the record page.
    """
    headline = (nudge or {}).get("headline") or f"{plan['display_name']}, here's your next move"
    goal = plan["goal"]

    return {
        "custom_notification": {
            "customNotifTypeId": "Elevate_Nudge",
            "recipientIds": [f"user:{plan['seller_id']}"],
            "title": f"{goal['icon']} {goal['points_to_go']:,} pts to your {goal['label']}",
            "body": headline,
            "targetPageRef": {
                "type": "standard__navItemPage",
                "attributes": {"apiName": "Elevate_Nudges"},
            },
        },
        "platform_event": {
            "eventType": "Elevate_Nudge__e",
            "payload": {
                "Seller_Id__c":      plan["seller_id"],
                "Headline__c":       headline,
                "Body__c":           (nudge or {}).get("body", ""),
                "Goal_Label__c":     goal["label"],
                "Points_To_Go__c":   goal["points_to_go"],
                "Goal_Target__c":    goal["target_points"],
                "Goal_Earned__c":    goal["points_earned"],
                "Generated_At__c":   plan["generated_at"],
                "Tasks__c": json.dumps([
                    {
                        "id": t["task_id"], "points": t["points"], "title": t["title"],
                        "subtitle": t["subtitle"], "why": t["why"], "cta": t["cta"],
                        "url": t["deeplink"], "source": t["source_short"],
                        "done": t["completed"],
                    } for t in plan["tasks"]
                ]),
            },
        },
    }


def build_bluepoints_payload(plan: dict, nudge: dict | None = None) -> dict:
    """
    Thanks@IBM (Elevate) payload.

    This is the program's own surface, so the nudge doesn't arrive as a
    notification — it *is* content: a home-page card plus one Challenge per
    task, each awarding BluePoints. Award totals still close the same gap.
    """
    headline = (nudge or {}).get("headline") or f"{plan['display_name']}, here's your next move"
    goal = plan["goal"]

    return {
        "program":  ELEVATE_PROGRAM,
        "currency": ELEVATE_CURRENCY,
        "participant": {
            "participant_id": plan["seller_id"],
            "display_name":   plan["display_name"],
            "balance":        plan.get("points_balance", 0),
        },
        "home_card": {
            "card_type": "next_move",
            "eyebrow":   "Your next move",
            "headline":  headline,
            "body":      (nudge or {}).get("body", ""),
            "goal": {
                "reward":     goal["label"],
                "reward_kind": goal["kind"],
                "target":     goal["target_points"],
                "earned":     goal["points_earned"],
                "to_go":      goal["points_to_go"],
                "percent":    goal["percent"],
            },
        },
        "challenges": [
            {
                "challenge_id": t["task_id"],
                "title":        t["title"],
                "description":  t["subtitle"],
                "reason":       t["why"],
                "award": {"amount": t["points"], "currency": ELEVATE_CURRENCY},
                "cta_label":    t["cta"],
                "cta_url":      (SF_INSTANCE_URL + t["deeplink"])
                                if t["channel"] == CH_SALESFORCE else t["deeplink"],
                "evidence_source": t["source_short"],
                "estimated_minutes": t["est_minutes"],
                "due":          t["due"],
                "status":       "completed" if t["completed"] else "open",
            } for t in plan["tasks"]
        ],
        "award_total": {
            "amount": plan["totals"]["points_available"],
            "currency": ELEVATE_CURRENCY,
        },
        "surfaces": ["home_card", "challenges_tab", "activity_feed"],
        "generated_at": plan["generated_at"],
    }


def build_payload(channel: str, plan: dict, nudge: dict | None = None) -> dict:
    if channel == CH_SLACK:
        return build_slack_payload(plan, nudge)
    if channel == CH_SALESFORCE:
        return build_salesforce_payload(plan, nudge)
    if channel == CH_BLUEPOINTS:
        return build_bluepoints_payload(plan, nudge)
    raise ValueError(
        f"unknown channel: {channel!r} "
        f"(expected {CH_SALESFORCE}, {CH_SLACK} or {CH_BLUEPOINTS})"
    )


# ── Delivery ──────────────────────────────────────────────────────────────────

def deliver(channel: str, plan: dict, nudge: dict | None = None) -> dict:
    """
    Send the payload to the real channel *only* when credentials are present.

    Slack      → SLACK_WEBHOOK_URL (incoming webhook)
    Salesforce → SF_NOTIFICATION_URL + SF_ACCESS_TOKEN
    BluePoints → ELEVATE_API_URL + ELEVATE_API_KEY (Thanks@IBM)

    With no credentials configured — the default for this demo — nothing is
    sent and the payload is returned for preview, with `delivered=False` and a
    reason. That keeps the surfaces honest: what you see is what would ship.
    """
    payload = build_payload(channel, plan, nudge)
    result = {
        "channel":    channel,
        "delivered":  False,
        "reason":     "",
        "payload":    payload,
        "attempted_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }

    if channel == CH_SLACK:
        url = os.getenv("SLACK_WEBHOOK_URL", "").strip()
        if not url:
            result["reason"] = "SLACK_WEBHOOK_URL not configured — preview only"
            return result
        endpoint, token = url, None
    elif channel == CH_BLUEPOINTS:
        endpoint = os.getenv("ELEVATE_API_URL", "").strip()
        token = os.getenv("ELEVATE_API_KEY", "").strip()
        if not endpoint or not token:
            result["reason"] = "ELEVATE_API_URL / ELEVATE_API_KEY not configured — preview only"
            return result
    else:
        endpoint = os.getenv("SF_NOTIFICATION_URL", "").strip()
        token = os.getenv("SF_ACCESS_TOKEN", "").strip()
        if not endpoint or not token:
            result["reason"] = "SF_NOTIFICATION_URL / SF_ACCESS_TOKEN not configured — preview only"
            return result
        payload = payload["custom_notification"]

    try:
        import urllib.request

        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(
            endpoint, data=json.dumps(payload).encode(), headers=headers, method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result["delivered"] = 200 <= resp.status < 300
            result["status_code"] = resp.status
            result["reason"] = "sent" if result["delivered"] else f"HTTP {resp.status}"
    except Exception as exc:  # noqa: BLE001
        result["reason"] = f"{type(exc).__name__}: {exc}"

    return result
