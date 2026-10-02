# Salesforce org setup

The service talks to one Salesforce org as an integration user through the
JWT bearer flow. A Developer Edition org is enough for the sample.

## 1. Integration user

Create a user for the service, for example `bob-agent@yourdomain.example`,
with a profile that can create and delete cases, read and update
opportunities, create custom fields and Flows, and post to Chatter. System
Administrator is the simplest choice for a demo org; narrow it for anything
shared. Records the service creates show this user as Created By.

## 2. Certificate and External Client App

1. Generate a key pair:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout sf_jwt.key -out sf_jwt.crt -subj "/CN=bob-in-slack"
   ```
   Keep `sf_jwt.key` out of git; both files are ignored by this repository.
2. In Setup, create an **External Client App** (or a Connected App) with
   OAuth enabled, the **Use digital signatures** option, upload `sf_jwt.crt`,
   and grant the scopes `api`, `refresh_token, offline_access`.
3. Under the app's policies, pre-authorize the integration user's profile,
   so the JWT flow needs no interactive consent.
4. Copy the **Consumer Key**.

Put these in `.env`:
```
HB_SF_LOGIN_URL=https://login.salesforce.com
HB_SF_CLIENT_ID=<consumer key>
HB_SF_USERNAME=<integration user's username>
HB_SF_PRIVATE_KEY_B64=$(base64 < sf_jwt.key | tr -d '\n')
```

## 3. Org features the sample uses

- **Chatter** enabled, so the use-case summary lands on the case feed. If
  it is off, the service falls back to a case comment.
- A **case feed layout** that shows feed items, so the summary is visible on
  the case page.
- A session timeout long enough for a demo day if people stay signed in on a
  shared laptop.

## 4. Stage the sample data

```bash
set -a; source .env; set +a
./.venv/bin/python scripts/setup_org.py --owner <username who should get the bell notification>
```

Idempotent. It creates the `Success_Plan__c` object with nine fields and the
System Administrator field permissions, the `Success_Plan_Created` custom
notification type, the sample account **Acme Corporation** with the deals
**Meridian Renewal** and **Northwind Expansion** owned by `--owner`, and
probes Chatter with a temporary case. Set `HB_DEMO_OPP_NAME` if you rename
the proof deal.

## 5. After a restart

The service keeps its state in SQLite under `HB_ROOT`. If that is not on a
persistent volume, a restart can orphan the live case. `scripts/cleanup.py`
archives orphan channels, removes orphan cases and their deployed change, and
leaves the newest open case in place.
