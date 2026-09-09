"""
Source-specific schemas and data generators
============================================

Defines realistic schemas for:
  • Workday (batch/nightly): employee records, compensation, org hierarchy
  • Salesforce (streaming/CDC): opportunities, accounts, deal changes, pipeline moves
  • Teams (streaming): messages, reactions, presence, channel activity

All generators accept a list of seller_ids to ensure consistent seller references
across sources, and support deterministic seeding for reproducibility.
"""

import json
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any


class SourceSchemaGenerator:
    """Unified generator for all three sources with shared seller references."""

    def __init__(self, seed: int = 20260812):
        self.rng = random.Random(seed)
        self.seed = seed

    def _ts_now(self) -> str:
        """ISO 8601 timestamp with milliseconds."""
        return datetime.now(timezone.utc).isoformat(timespec="milliseconds")

    def _ts_past(self, hours_ago: int = 0, days_ago: int = 0, minutes_ago: int = 0) -> str:
        """ISO 8601 timestamp in the past."""
        dt = datetime.now(timezone.utc) - timedelta(hours=hours_ago, days=days_ago, minutes=minutes_ago)
        return dt.isoformat(timespec="milliseconds")

    def _uid(self, prefix: str = "") -> str:
        """Generate a deterministic UUID."""
        return f"{prefix}{str(uuid.UUID(bytes=bytes(self.rng.randint(0, 255) for _ in range(16)), version=4))[:8]}"

    # ═══════════════════════════════════════════════════════════════════════════════
    # WORKDAY — Batch (nightly) source
    # ═══════════════════════════════════════════════════════════════════════════════

    def make_workday_employee_record(
        self, seller_id: str, record_variant: str = "standard"
    ) -> dict:
        """
        Simulated Workday employee record (nightly batch load).

        Variants:
          - standard: baseline employee record
          - promotion: recent role change
          - compensation_change: salary/bonus adjustment
          - location_change: desk/office move
        """
        role_options = ["Account Executive", "Senior Account Executive", "Strategic Account Manager"]
        dept_options = ["Sales", "Enterprise Sales", "Commercial Sales"]
        country_options = ["USA", "Canada", "UK", "APAC"]

        base_record = {
            "record_type": "employee",
            "source": "workday",
            "event_type": "employee.record.sync",
            "seller_id": seller_id,
            "event_id": self._uid("wd-"),
            "event_ts": self._ts_now(),
            "payload": {
                "employee_id": seller_id,
                "legal_name": f"Employee {seller_id.split('-')[-1]}",
                "work_email": f"{seller_id}@company.com",
                "role": self.rng.choice(role_options),
                "department": self.rng.choice(dept_options),
                "cost_center": f"CC-{self.rng.randint(100, 999)}",
                "manager_id": "mgr-001",
                "hire_date": (datetime.now() - timedelta(days=self.rng.randint(365, 3650))).strftime("%Y-%m-%d"),
                "team_start_date": (datetime.now() - timedelta(days=self.rng.randint(30, 1095))).strftime("%Y-%m-%d"),
                "employment_status": "Active",
                "country": self.rng.choice(country_options),
                "office_location": f"Office-{self.rng.choice(['SF', 'NYC', 'LON', 'SYD'])}",
                "base_salary_usd": self.rng.randint(80_000, 250_000),
                "target_bonus_pct": self.rng.choice([10, 15, 20, 25]),
                "tenure_years": self.rng.randint(1, 15),
                "performance_rating": self.rng.choice(["Exceeds Expectations", "Meets Expectations", "Needs Improvement"]),
            },
            "_source_id": "S3",
            "_simulated": True,
        }

        # Apply variant-specific overrides
        if record_variant == "promotion":
            base_record["event_type"] = "employee.promotion"
            base_record["payload"]["previous_role"] = self.rng.choice(role_options)
            base_record["payload"]["promotion_date"] = self._ts_now()
            base_record["payload"]["salary_increase_pct"] = self.rng.randint(5, 15)

        elif record_variant == "compensation_change":
            base_record["event_type"] = "employee.compensation.update"
            base_record["payload"]["previous_salary"] = base_record["payload"]["base_salary_usd"] - self.rng.randint(5_000, 50_000)
            base_record["payload"]["salary_increase_usd"] = base_record["payload"]["base_salary_usd"] - base_record["payload"]["previous_salary"]
            base_record["payload"]["effective_date"] = self._ts_past(days_ago=self.rng.randint(0, 30))

        elif record_variant == "location_change":
            base_record["event_type"] = "employee.location.change"
            base_record["payload"]["previous_location"] = self.rng.choice(["Office-SF", "Office-NYC", "Office-LON"])
            base_record["payload"]["change_date"] = self._ts_past(days_ago=self.rng.randint(0, 30))

        return base_record

    def make_workday_batch_file(self, seller_ids: list[str], variant: str = "standard") -> list[dict]:
        """
        Generate a nightly Workday batch file (multiple employee records).

        Represents a typical nightly extract of all sellers from Workday.
        Returns list of records that would be in a single batch file.
        """
        records = []
        for sid in seller_ids:
            # Most records are standard; occasional variants for realism
            v = self.rng.choices(
                ["standard", "promotion", "compensation_change", "location_change"],
                weights=[80, 5, 10, 5],
                k=1,
            )[0]
            records.append(self.make_workday_employee_record(sid, record_variant=v))

        # Add file metadata record
        records.insert(
            0,
            {
                "record_type": "batch_metadata",
                "source": "workday",
                "event_type": "batch.started",
                "seller_id": None,
                "event_id": self._uid("wd-batch-"),
                "event_ts": self._ts_past(hours_ago=self.rng.randint(0, 2)),
                "payload": {
                    "batch_id": self._uid("batch-"),
                    "record_count": len(seller_ids),
                    "extract_timestamp": self._ts_past(hours_ago=self.rng.randint(0, 2)),
                    "format": "JSON_LINES",
                },
                "_source_id": "S3",
                "_simulated": True,
            },
        )

        return records

    # ═══════════════════════════════════════════════════════════════════════════════
    # SALESFORCE — Streaming (CDC) source
    # ═══════════════════════════════════════════════════════════════════════════════

    def make_salesforce_opportunity_event(
        self, seller_id: str, event_subtype: str = "standard"
    ) -> dict:
        """
        Simulated Salesforce opportunity CDC record (real-time streaming).

        Subtypes:
          - standard: baseline opportunity record
          - stage_change: pipeline progression (Proposal → Negotiation → Closed)
          - amount_change: deal value adjustment
          - close_date_change: timeline slip
          - new_opportunity: fresh deal created
        """
        stages = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]

        base_event = {
            "event_id": self._uid("sf-"),
            "source": "salesforce",
            "event_type": "opportunity.updated",
            "seller_id": seller_id,
            "event_ts": self._ts_now(),
            "payload": {
                "opportunity_id": self._uid("opp-"),
                "account_id": self._uid("acc-"),
                "opportunity_name": f"Acme Corp Deal {self.rng.randint(1000, 9999)}",
                "stage": self.rng.choice(stages),
                "amount_usd": round(self.rng.uniform(10_000, 500_000), 2),
                "close_date": (datetime.now() + timedelta(days=self.rng.randint(1, 180))).strftime("%Y-%m-%d"),
                "probability_pct": self.rng.randint(10, 100),
                "owner_id": seller_id,
                "created_at": self._ts_past(days_ago=self.rng.randint(1, 90)),
                "last_modified_at": self._ts_now(),
                "type": self.rng.choice(["New Business", "Expansion", "Renewal"]),
                "crm_compliance": self.rng.choice([True, True, True, False]),  # 75% compliant
            },
            "_source_id": "S1",
            "_simulated": True,
        }

        # Apply subtype-specific changes
        if event_subtype == "stage_change":
            base_event["event_type"] = "opportunity.stage_changed"
            old_stage = self.rng.choice(stages[:-2])
            new_idx = stages.index(old_stage) + self.rng.randint(1, 2)
            base_event["payload"]["previous_stage"] = old_stage
            base_event["payload"]["stage"] = stages[min(new_idx, len(stages) - 1)]
            base_event["payload"]["stage_change_date"] = self._ts_now()

        elif event_subtype == "amount_change":
            base_event["event_type"] = "opportunity.amount_changed"
            old_amount = base_event["payload"]["amount_usd"]
            base_event["payload"]["previous_amount_usd"] = old_amount
            base_event["payload"]["amount_usd"] = round(old_amount * self.rng.uniform(0.8, 1.5), 2)
            base_event["payload"]["amount_change_pct"] = round(
                ((base_event["payload"]["amount_usd"] - old_amount) / old_amount) * 100, 2
            )

        elif event_subtype == "close_date_change":
            base_event["event_type"] = "opportunity.close_date_changed"
            old_date = base_event["payload"]["close_date"]
            new_days = self.rng.randint(1, 180)
            new_date = (datetime.now() + timedelta(days=new_days)).strftime("%Y-%m-%d")
            base_event["payload"]["previous_close_date"] = old_date
            base_event["payload"]["close_date"] = new_date

        elif event_subtype == "new_opportunity":
            base_event["event_type"] = "opportunity.created"
            base_event["payload"]["stage"] = "Prospecting"
            base_event["payload"]["probability_pct"] = 10
            base_event["payload"]["created_at"] = self._ts_now()

        return base_event

    def make_salesforce_account_event(self, seller_id: str, event_subtype: str = "standard") -> dict:
        """Simulated Salesforce account/relationship record update."""
        base_event = {
            "event_id": self._uid("sf-acc-"),
            "source": "salesforce",
            "event_type": "account.updated",
            "seller_id": seller_id,
            "event_ts": self._ts_now(),
            "payload": {
                "account_id": self._uid("acc-"),
                "account_name": f"Customer {self.rng.randint(1000, 9999)}",
                "industry": self.rng.choice(["Technology", "Finance", "Healthcare", "Retail", "Manufacturing"]),
                "annual_revenue_usd": self.rng.randint(1_000_000, 10_000_000_000),
                "employee_count": self.rng.randint(100, 50000),
                "account_owner_id": seller_id,
                "relationship_status": self.rng.choice(["Active", "Prospect", "Inactive"]),
                "ltv_usd": self.rng.randint(50_000, 5_000_000),
                "created_at": self._ts_past(days_ago=self.rng.randint(1, 365)),
                "last_modified_at": self._ts_now(),
            },
            "_source_id": "S1",
            "_simulated": True,
        }

        if event_subtype == "owner_change":
            base_event["event_type"] = "account.owner_changed"
            base_event["payload"]["previous_owner_id"] = self._uid("user-")
            base_event["payload"]["account_owner_id"] = seller_id

        return base_event

    # ═══════════════════════════════════════════════════════════════════════════════
    # TEAMS — Streaming (chat/presence) source
    # ═══════════════════════════════════════════════════════════════════════════════

    def make_teams_message_event(self, seller_id: str, message_type: str = "standard") -> dict:
        """
        Simulated Microsoft Teams message event (real-time streaming).

        Types:
          - standard: regular message
          - recognition: peer praise/recognition
          - achievement: milestone or win announcement
          - question: asking for help/advice
        """
        channels = [
            "#elevate-close-strong",
            "#sales-enablement",
            "#deal-wins",
            "#team-general",
            "#wins-recognition",
        ]
        message_templates = {
            "standard": [
                "Great call with the client today. Lots of positive feedback on the proposal.",
                "Following up on the discovery call scheduled for tomorrow.",
                "Can someone share best practices for enterprise deals?",
                "Just closed a deal! Excited to share details at tomorrow's huddle.",
            ],
            "recognition": [
                f"Amazing work closing that big deal! You're a rockstar. 🌟",
                f"Thanks for jumping on that escalation. Really appreciated your expertise.",
                f"Incredible effort this quarter. You crushed your targets! 🏆",
                f"Your mentorship has really helped me grow. Thank you!",
            ],
            "achievement": [
                "Just hit my 50th deal closed this year! 🎉",
                "Monthly top performer! Grateful for the team's support.",
                "Promoted to Senior Account Executive! Ready for the next chapter.",
                "Certified in new advanced sales methodology. Let's apply it together!",
            ],
            "question": [
                "Anyone have experience with large pharma deals? Need advice on vertical.",
                "What's everyone's approach to champion development?",
                "Best way to handle pricing objections at contract stage?",
                "How do you all structure multi-threaded relationships?",
            ],
        }

        templates = message_templates.get(message_type, message_templates["standard"])
        message_text = self.rng.choice(templates)

        base_event = {
            "event_id": self._uid("teams-"),
            "source": "teams",
            "event_type": "message.posted",
            "seller_id": seller_id,
            "event_ts": self._ts_now(),
            "payload": {
                "message_id": self._uid("msg-"),
                "channel": self.rng.choice(channels),
                "user_id": seller_id,
                "user_display_name": f"User {seller_id.split('-')[-1]}",
                "text": message_text,
                "message_type": message_type,
                "has_attachments": self.rng.choice([True, False]),
                "reaction_count": self.rng.randint(0, 10) if message_type != "standard" else self.rng.randint(0, 3),
                "reply_count": self.rng.randint(0, 5),
                "created_at": self._ts_now(),
            },
            "_source_id": "S2",
            "_simulated": True,
        }

        return base_event

    def make_teams_presence_event(self, seller_id: str) -> dict:
        """Simulated Teams presence/status update (user online/away/busy)."""
        statuses = ["Available", "Busy", "Away", "Offline", "In a Call", "In a Meeting"]

        return {
            "event_id": self._uid("teams-pres-"),
            "source": "teams",
            "event_type": "presence.changed",
            "seller_id": seller_id,
            "event_ts": self._ts_now(),
            "payload": {
                "user_id": seller_id,
                "status": self.rng.choice(statuses),
                "status_message": self.rng.choice(
                    ["In a customer call", "Focused time - do not disturb", "Back soon", "Available for chats", None]
                ),
                "activity": self.rng.choice(["InCall", "InAMeeting", "Idle", "Available", "Away"]),
                "last_activity_at": self._ts_past(minutes_ago=self.rng.randint(0, 60)),
            },
            "_source_id": "S2",
            "_simulated": True,
        }

    def make_teams_reaction_event(self, seller_id: str, reactor_id: str) -> dict:
        """Simulated Teams message reaction (emoji response)."""
        reactions = ["👍", "❤️", "😂", "🔥", "🎉", "👏", "🚀"]

        return {
            "event_id": self._uid("teams-react-"),
            "source": "teams",
            "event_type": "message.reaction_added",
            "seller_id": seller_id,  # message author
            "event_ts": self._ts_now(),
            "payload": {
                "message_id": self._uid("msg-"),
                "reactor_id": reactor_id,  # who reacted
                "reaction": self.rng.choice(reactions),
                "channel": self.rng.choice(
                    [
                        "#elevate-close-strong",
                        "#sales-enablement",
                        "#deal-wins",
                        "#wins-recognition",
                    ]
                ),
            },
            "_source_id": "S2",
            "_simulated": True,
        }

    # ═══════════════════════════════════════════════════════════════════════════════
    # Bulk generation utilities
    # ═══════════════════════════════════════════════════════════════════════════════

    def generate_streaming_batch(
        self, seller_ids: list[str], batch_size: int = 20
    ) -> dict[str, list[dict]]:
        """
        Generate a batch of streaming events for demo injection.

        Returns:
            {
                "salesforce": [...events],
                "teams": [...events],
            }
        """
        salesforce_events = []
        teams_events = []

        # Generate Salesforce events (~60% of batch)
        for _ in range(int(batch_size * 0.6)):
            seller_id = self.rng.choice(seller_ids)
            subtype = self.rng.choices(
                ["standard", "stage_change", "amount_change", "close_date_change"],
                weights=[50, 20, 15, 15],
                k=1,
            )[0]
            event_type = self.rng.choice(["opportunity", "account"])
            if event_type == "opportunity":
                salesforce_events.append(self.make_salesforce_opportunity_event(seller_id, subtype))
            else:
                salesforce_events.append(self.make_salesforce_account_event(seller_id, subtype))

        # Generate Teams events (~40% of batch)
        for _ in range(int(batch_size * 0.4)):
            seller_id = self.rng.choice(seller_ids)
            event_type = self.rng.choices(
                ["message", "presence", "reaction"],
                weights=[70, 20, 10],
                k=1,
            )[0]

            if event_type == "message":
                msg_type = self.rng.choices(
                    ["standard", "recognition", "achievement", "question"],
                    weights=[50, 20, 15, 15],
                    k=1,
                )[0]
                teams_events.append(self.make_teams_message_event(seller_id, msg_type))
            elif event_type == "presence":
                teams_events.append(self.make_teams_presence_event(seller_id))
            else:  # reaction
                reactor = self.rng.choice(seller_ids)
                teams_events.append(self.make_teams_reaction_event(seller_id, reactor))

        return {
            "salesforce": salesforce_events,
            "teams": teams_events,
        }
