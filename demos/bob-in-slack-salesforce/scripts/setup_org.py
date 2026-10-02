"""Prepare a Salesforce org for the sample Success Plan flow. Idempotent.

    python scripts/setup_org.py [--owner USERNAME]

Reads HB_SF_LOGIN_URL, HB_SF_CLIENT_ID, HB_SF_USERNAME, HB_SF_PRIVATE_KEY_B64
from the environment (the same values the service uses). Creates, if missing:

- the custom object Success_Plan__c with its nine fields (the object the
  sample Flow creates records in), plus field permissions for the System
  Administrator profile;
- the custom notification type Success_Plan_Created (the bell notification);
- a sample account "Acme Corporation" with the "Meridian Renewal" deal used as
  the live proof (HB_DEMO_OPP_NAME), owned by --owner or the integration user.

Then probes Chatter with a temporary case, since the use-case summary is
posted to the case feed. Prerequisites done in the org UI first: an External
Client App with certificate authentication and an integration user; see
docs/salesforce-setup.md.
"""
import argparse
import os
import sys

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from headless_bob.salesforce import SalesforceClient  # noqa: E402

API = "/services/data/v60.0"

OBJECT = {"fullName": "Success_Plan__c", "label": "Success Plan", "pluralLabel": "Success Plans",
          "nameLabel": "Success Plan Name"}
FIELDS = [
    {"name": "Opportunity__c", "label": "Opportunity", "type": "Lookup", "referenceTo": "Opportunity", "required": True},
    {"name": "Account__c", "label": "Account", "type": "Lookup", "referenceTo": "Account"},
    {"name": "Account_Executive__c", "label": "Account Executive", "type": "Lookup", "referenceTo": "User"},
    {"name": "Success_Status__c", "label": "Success Status", "type": "Picklist",
     "values": ["Draft", "Active", "At Risk", "On Track", "Completed"]},
    {"name": "Renewal_Date__c", "label": "Renewal Date", "type": "Date"},
    {"name": "Account_Health__c", "label": "Account Health", "type": "Picklist", "values": ["Green", "Yellow", "Red"]},
    {"name": "Customer_Business_Objective__c", "label": "Customer Business Objective", "type": "LongTextArea"},
    {"name": "Expected_Business_Outcome__c", "label": "Expected Business Outcome", "type": "LongTextArea"},
    {"name": "Success_Criteria__c", "label": "Success Criteria", "type": "LongTextArea"},
]
NOTIFICATION = {"DeveloperName": "Success_Plan_Created", "MasterLabel": "Success Plan Created",
                "CustomNotifTypeName": "Success Plan Created", "Desktop": True, "Mobile": True}
ACCOUNT = "Acme Corporation"
DEALS = [("Meridian Renewal", 2400000), ("Northwind Expansion", 1800000)]


def field_metadata(f: dict) -> dict:
    md = {"label": f["label"], "type": f["type"]}
    if f["type"] == "Lookup":
        md.update({"referenceTo": f["referenceTo"], "relationshipName": f["name"].replace("__c", ""),
                   "relationshipLabel": OBJECT["pluralLabel"]})
        md.update({"required": True, "deleteConstraint": "Restrict"} if f.get("required")
                  else {"deleteConstraint": "SetNull"})
    elif f["type"] == "Picklist":
        md["valueSet"] = {"valueSetDefinition": {"sorted": False, "value": [
            {"fullName": v, "label": v, "default": False} for v in f["values"]]}}
    elif f["type"] == "LongTextArea":
        md.update({"length": 32768, "visibleLines": 5})
    return md


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--owner", default=os.environ.get("HB_CASE_OWNER_USERNAME", ""),
                        help="username that owns the sample deals (receives the bell notification); "
                             "defaults to HB_CASE_OWNER_USERNAME, then the integration user")
    parser.add_argument("--deal", default=os.environ.get("HB_DEMO_OPP_NAME", "Meridian Renewal"),
                        help="name of the deal used for the live proof (HB_DEMO_OPP_NAME)")
    args = parser.parse_args()

    org = SalesforceClient.from_env(dict(os.environ))
    if org is None:
        sys.exit("HB_SF_LOGIN_URL, HB_SF_CLIENT_ID, HB_SF_USERNAME and HB_SF_PRIVATE_KEY_B64 are required")
    org._ensure_token()
    headers = {"Authorization": f"Bearer {org._token}"}
    tooling = org._instance + f"{API}/tooling"

    def tq(q: str) -> list:
        r = httpx.get(f"{tooling}/query", params={"q": q}, headers=headers, timeout=30).json()
        return r.get("records", []) if isinstance(r, dict) else []

    print("org:", org._soql("SELECT Name FROM Organization")[0]["Name"], "| integration user:", org.username)
    owner_username = args.owner or org.username
    owner = org._soql(f"SELECT Id, Name FROM User WHERE Username = '{owner_username}' AND IsActive = true")
    if not owner:
        sys.exit(f"user {owner_username} not found or inactive")
    print("deal owner:", owner[0]["Name"], f"({owner_username})")

    # --- object ---
    if tq(f"SELECT Id FROM CustomObject WHERE DeveloperName = '{OBJECT['fullName'][:-3]}'"):
        print("object: exists")
    else:
        envelope = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
            'xmlns:met="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<soapenv:Header><met:SessionHeader><met:sessionId>{org._token}</met:sessionId></met:SessionHeader></soapenv:Header>'
            '<soapenv:Body><met:createMetadata><met:metadata xsi:type="met:CustomObject">'
            f'<met:fullName>{OBJECT["fullName"]}</met:fullName><met:label>{OBJECT["label"]}</met:label>'
            f'<met:pluralLabel>{OBJECT["pluralLabel"]}</met:pluralLabel>'
            f'<met:nameField><met:label>{OBJECT["nameLabel"]}</met:label><met:type>Text</met:type></met:nameField>'
            '<met:deploymentStatus>Deployed</met:deploymentStatus><met:sharingModel>ReadWrite</met:sharingModel>'
            '<met:enableFeeds>true</met:enableFeeds></met:metadata></met:createMetadata></soapenv:Body></soapenv:Envelope>'
        )
        r = httpx.post(org._instance + "/services/Soap/m/60.0", content=envelope, timeout=120,
                       headers={"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": "createMetadata"})
        assert "<success>true</success>" in r.text, r.text[:300]
        print("object: created")

    # --- fields + permissions ---
    describe = httpx.get(org._instance + f"{API}/sobjects/{OBJECT['fullName']}/describe", headers=headers, timeout=30).json()
    have = {f["name"] for f in describe.get("fields", [])}
    for f in FIELDS:
        if f["name"] in have:
            print(f"  field {f['name']}: exists"); continue
        r = httpx.post(f"{tooling}/sobjects/CustomField", headers=headers, timeout=60,
                       json={"FullName": f"{OBJECT['fullName']}.{f['name']}", "Metadata": field_metadata(f)})
        print(f"  field {f['name']}: {'created' if r.status_code < 300 else r.text[:120]}")
    permset = org._soql("SELECT Id FROM PermissionSet WHERE IsOwnedByProfile = true AND Profile.Name = 'System Administrator'")[0]["Id"]
    for f in FIELDS:
        httpx.post(org._instance + f"{API}/sobjects/FieldPermissions", headers=headers, timeout=30, json={
            "ParentId": permset, "SobjectType": OBJECT["fullName"], "Field": f"{OBJECT['fullName']}.{f['name']}",
            "PermissionsRead": True, "PermissionsEdit": not f.get("required", False)})
    print("field permissions: System Administrator")

    # --- notification type ---
    if tq(f"SELECT Id FROM CustomNotificationType WHERE DeveloperName = '{NOTIFICATION['DeveloperName']}'"):
        print("notification type: exists")
    else:
        r = httpx.post(f"{tooling}/sobjects/CustomNotificationType", headers=headers, timeout=60, json=NOTIFICATION)
        print("notification type:", "created" if r.status_code < 300 else r.text[:120])

    # --- sample account + deals ---
    accounts = org._soql(f"SELECT Id FROM Account WHERE Name = '{ACCOUNT}'")
    account = accounts[0]["Id"] if accounts else org._post(f"{API}/sobjects/Account", {"Name": ACCOUNT})["id"]
    deals = dict(DEALS)
    deals.setdefault(args.deal, 2400000)
    existing = {o["Name"]: o for o in org._soql(f"SELECT Id, Name, Owner.Username FROM Opportunity WHERE AccountId = '{account}'")}
    for name, amount in deals.items():
        if name not in existing:
            org._post(f"{API}/sobjects/Opportunity", {"Name": name, "AccountId": account, "StageName": "Qualification",
                                                       "CloseDate": "2026-12-15", "Amount": amount, "OwnerId": owner[0]["Id"]})
            print(f"  deal {name}: created")
        elif existing[name]["Owner"]["Username"] != owner_username:
            org._patch(f"{API}/sobjects/Opportunity/{existing[name]['Id']}", {"OwnerId": owner[0]["Id"]})
            print(f"  deal {name}: owner -> {owner_username}")
        else:
            print(f"  deal {name}: ok")

    # --- Chatter probe ---
    case = org.create_case("Chatter check (temporary)", "temporary")
    try:
        org._post(f"{API}/chatter/feed-elements", {"feedElementType": "FeedItem", "subjectId": case["Id"],
                                                   "body": {"messageSegments": [{"type": "Text", "text": "probe"}]}})
        print("chatter: enabled")
    except Exception as exc:
        print("chatter: NOT enabled (the summary falls back to a case comment) —", str(exc)[:80])
    finally:
        org.delete_case(case["Id"])
    print("READY")


if __name__ == "__main__":
    main()
