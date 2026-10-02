"""Tidy the org and the Slack workspace after a restart or a failed cycle.

    python scripts/cleanup.py

A restart wipes the service's local state, which can orphan the live case:
this archives orphan case channels, removes orphan sample cases together with
any Flow, field and Success Plan records they deployed, and leaves the newest
open case in place (the attract loop's fresh spawn). Idempotent. Reads the
same HB_SF_* and HB_SLACK_BOT_TOKEN variables as the service.
"""
import os
import sys
import time

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from headless_bob.caseflow import SUCCESSPLAN_CASE_SUBJECT  # noqa: E402
from headless_bob.salesforce import SalesforceClient  # noqa: E402
from headless_bob.successplan import SuccessPlanArtifact  # noqa: E402

client = SalesforceClient.from_env(dict(os.environ))
if client is None:
    sys.exit("HB_SF_* credentials are required")
headers = {"Authorization": f"Bearer {os.environ['HB_SLACK_BOT_TOKEN']}"}
deal = os.environ.get("HB_DEMO_OPP_NAME", "Meridian Renewal")
time.sleep(int(os.environ.get("CLEANUP_WAIT", "15")))   # let a fresh spawn land after a restart

channels, cursor = [], ""
while True:
    page = httpx.get("https://slack.com/api/conversations.list", headers=headers, timeout=30,
                     params={"types": "public_channel", "exclude_archived": "true", "limit": 200,
                             **({"cursor": cursor} if cursor else {})}).json()
    channels += page.get("channels", [])
    cursor = (page.get("response_metadata") or {}).get("next_cursor", "")
    if not cursor:
        break
open_cases = sorted([c for c in channels if c["name"].startswith("case-")], key=lambda c: c["created"])
live, orphans = (open_cases[-1] if open_cases else None), open_cases[:-1]
assert len(orphans) <= 3, f"{len(orphans)} orphan channels — investigate before cleaning"
for c in orphans:
    httpx.post("https://slack.com/api/conversations.archive", data={"channel": c["id"]}, headers=headers, timeout=30)
    print("archived", c["name"])

cases = client._soql(f"SELECT Id, CaseNumber FROM Case WHERE IsClosed = false AND Subject = '{SUCCESSPLAN_CASE_SUBJECT}' "
                     f"AND CreatedBy.Username = '{client.username}' ORDER BY CreatedDate DESC")
live_number = live["name"].split("-")[1] if live else None
orphan_cases = [c for c in cases if c["CaseNumber"].lstrip("0") != live_number]
assert len(orphan_cases) <= 3, f"{len(orphan_cases)} orphan cases — investigate before cleaning"
artifact = SuccessPlanArtifact(client)
for c in orphan_cases:
    n = c["CaseNumber"]
    issues = artifact.cleanup(n, {"flow": artifact.flow_name(n), "field": artifact.field_name(n),
                                  "deployed_at": "1970-01-01T00:00:00+00:00"}, deal)
    client.delete_case(c["Id"])
    print(f"orphan case {n} cleaned", f"(issues: {issues})" if issues else "")
state = client._soql(f"SELECT StageName, CloseDate FROM Opportunity WHERE Name = '{deal}'")
print("live channel:", live["name"] if live else None, "|", deal, ":", state[0] if state else "not found",
      "| success plans:", len(client._soql("SELECT Id FROM Success_Plan__c")))
