"""
Generate JSONL data files for 3 key personas (Rachel, Marcus, Maya).

Output — data/sellers/{seller_id}/
  {seller_id}_workday.jsonl      Workday employee records (nightly batch)
  {seller_id}_salesforce.jsonl   Salesforce opportunity + account CDC events
  {seller_id}_teams.jsonl        Teams messages, presence, reactions

Re-run any time to regenerate (deterministic, SEED=20260812):
  cd motivation_graph
  python3 data/generate_seller_json.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from data.generator import FOREGROUND_SELLERS, SEED, rng
from streaming.source_schemas import SourceSchemaGenerator

SELLERS = [s["seller_id"] for s in FOREGROUND_SELLERS]  # Rachel, Marcus, Maya
OUTPUT_DIR = Path(__file__).parent / "sellers"


def main() -> None:
    rng.seed(SEED)
    OUTPUT_DIR.mkdir(exist_ok=True, parents=True)
    gen = SourceSchemaGenerator(seed=SEED)

    print(f"Generating JSONL for {len(SELLERS)} personas → {OUTPUT_DIR}\n")

    for idx, seller_id in enumerate(SELLERS, 1):
        seller_dir = OUTPUT_DIR / seller_id
        seller_dir.mkdir(exist_ok=True)
        print(f"[{idx}/{len(SELLERS)}] {seller_id}", end="  ", flush=True)

        # Workday — nightly batch employee records
        workday_events = []
        for variant in ["standard", "promotion", "compensation_change", "location_change"]:
            if variant == "standard" or gen.rng.random() < 0.25:
                workday_events.append(gen.make_workday_employee_record(seller_id, variant))

        with open(seller_dir / f"{seller_id}_workday.jsonl", "w") as fh:
            for event in workday_events:
                fh.write(json.dumps(event) + "\n")

        # Salesforce CDC — opportunities + account updates
        salesforce_events = []
        for _ in range(gen.rng.randint(5, 10)):
            subtype = gen.rng.choices(
                ["standard", "stage_change", "amount_change", "close_date_change", "new_opportunity"],
                weights=[30, 25, 20, 15, 10],
                k=1,
            )[0]
            salesforce_events.append(gen.make_salesforce_opportunity_event(seller_id, subtype))
        for _ in range(gen.rng.randint(1, 3)):
            salesforce_events.append(gen.make_salesforce_account_event(seller_id))

        with open(seller_dir / f"{seller_id}_salesforce.jsonl", "w") as fh:
            for event in salesforce_events:
                fh.write(json.dumps(event) + "\n")

        # Teams — messages, presence, reactions
        teams_events = []
        for _ in range(gen.rng.randint(3, 8)):
            msg_type = gen.rng.choices(
                ["standard", "recognition", "achievement", "question"],
                weights=[50, 20, 15, 15],
                k=1,
            )[0]
            teams_events.append(gen.make_teams_message_event(seller_id, msg_type))
        for _ in range(gen.rng.randint(1, 2)):
            teams_events.append(gen.make_teams_presence_event(seller_id))
        for _ in range(gen.rng.randint(0, 2)):
            teams_events.append(gen.make_teams_reaction_event(seller_id, gen.rng.choice(SELLERS)))

        with open(seller_dir / f"{seller_id}_teams.jsonl", "w") as fh:
            for event in teams_events:
                fh.write(json.dumps(event) + "\n")

        print(f"WD={len(workday_events)} | SF={len(salesforce_events):2d} | Teams={len(teams_events):2d}")

    print(f"\n✓  {len(SELLERS)} personas generated.")


if __name__ == "__main__":
    main()
