# Runbook: connecting a Slack app to a headless-bob deployment

Reusable recipe for any deployment of this service. One Slack app maps to
exactly one deployment URL; to run two deployments side by side, create two
apps.

## Prerequisites
- The deployment is live (its `/healthz` returns 200) — URL verification at app
  creation only succeeds against a running service.
- You are signed into the target Slack workspace in the browser.

## Steps

1. **Create the app from a manifest**
   - Go to https://api.slack.com/apps → **Create New App** → **From a manifest**
   - Pick the workspace → choose the **YAML** tab → paste the manifest
     (`docs/slack-app-manifest.yaml` in this folder; change `name`,
     `display_name`, and both `request_url` values to your deployment's URL)
   - Review screen → **Create**. Both URLs should show as verified since the
     service is live. (If events URL shows unverified: fix the URL under
     *Event Subscriptions* and click **Retry**.)

2. **Install it to the workspace**
   - On the app's page: **Install to Workspace** → **Allow**.
   - Reinstall is needed again any time scopes change later.

3. **Copy two credentials into the deployment folder's `.env`**
   - **Bot Token** (`xoxb-…`): *OAuth & Permissions* page →
     `HB_SLACK_BOT_TOKEN=`
   - **Signing Secret**: *Basic Information* → App Credentials → Show →
     `HB_SLACK_SIGNING_SECRET=`
   - ⚠️ In a copied folder the `.env` may hold ANOTHER app's values — replace,
     don't append.

4. **Push the credentials into the deployment**
   The service reads `HB_SLACK_BOT_TOKEN` and `HB_SLACK_SIGNING_SECRET` from
   its environment (alongside `BOBSHELL_API_KEY`). Update the deployment's
   secret with those two values and restart it so it re-reads them. On IBM
   Cloud Code Engine, for example:
   ```bash
   grep -E '^(BOBSHELL_API_KEY|HB_SLACK_BOT_TOKEN|HB_SLACK_SIGNING_SECRET)=.+' .env > /tmp/sec.env
   ibmcloud ce secret update --name <secret-name> --from-env-file /tmp/sec.env
   rm /tmp/sec.env
   ibmcloud ce app update --name <app-name> --env HB_CONFIG_REV=$(date +%s) --wait
   ```

5. **Smoke test in Slack**
   - Create a channel, `/invite @<bot-name>`, mention it with "hi".
   - No reply? Check the service logs — a 401 on `/slack/events` means the
     signing secret in the deployment doesn't match the app.

## Re-pointing an app to another deployment
Change both Request URLs (Event Subscriptions + Interactivity) to the other
deployment's host, and make sure that deployment's secret carries this app's
bot token and signing secret (step 4). No reinstall is needed for URL changes.

## Known quirk: bot handles are fixed at creation
A bot's underlying @handle is set when the app is created and cannot be
changed afterward — manifest/App Home edits only change the DISPLAY name,
and Slack clients cache even that aggressively. If a clean name matters,
recreate the app from a corrected manifest (names bind at creation) and
re-push its credentials to the deployment secret.
