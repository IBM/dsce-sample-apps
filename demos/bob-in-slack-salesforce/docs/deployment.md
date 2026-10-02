# Deploying the service

One container, one Slack workspace, one Salesforce org. Any platform that
runs a container with the variables in [env.example](../env.example) works.

## The image

`Dockerfile` installs Python, Node and Bob Shell 2.0.4 from the published
package with its SHA-256 verified, and bakes the skills seed under
`/app/seeds/salesforce`. It runs as a non-root user. Bob's auto-update is
disabled by the service in every tenant home, so the pinned version is the
running version.

```bash
docker build -t bob-in-slack .
docker run --env-file .env -p 8080:8080 -v bob-workspace:/workspace bob-in-slack
```

## What the platform must provide

- **Persistent `/workspace`.** The service's SQLite database and Bob's own
  session store live there. Without it, every restart forgets every
  conversation and orphans the live case (recoverable with
  `scripts/cleanup.py`, but avoidable).
- **A public HTTPS URL** for Slack's events and interactivity requests. Slack
  verifies it when the app is created.
- **Outbound access** to the Bob API host, to Salesforce, to Slack, and to
  your mail transport if the closure email is on. For production, prefer a
  platform with hostname-aware egress policy so a shell command inside Bob
  cannot reach anything else; the environment allowlist and the read-only
  turns are the first wall, egress policy is the second.
- **Memory** of roughly 400 MB per live Bob session. `HB_WORKERS` sets the
  concurrent turns; idle sessions are reaped after 15 minutes.

## IBM Cloud Code Engine example

`scripts/deploy.sh <tag>` builds the image, pushes it to IBM Container
Registry and rolls one Code Engine app, reading the `CE_*` and `IMAGE`
variables from `.env`. Put the runtime variables in a Code Engine secret
bound to the app. Code Engine has no egress policy, which is fine for a demo
and not what you want for production.

A roll restarts the app. On startup the service reconciles: it archives the
previous case channel, removes the previous case and its deployed change,
and, with `HB_ATTRACT_LOOP=1`, spawns a fresh case. Do not roll while someone
is mid-demo.

## After deploying

1. Create the Slack app from `docs/slack-app-manifest.yaml` with your URL,
   install it, and put the bot token and signing secret in the secret
   ([slack-app-setup.md](slack-app-setup.md)).
2. Invite the members named in `HB_PO_SLACK_USER_IDS`; they are added to
   every case channel automatically.
3. `GET /healthz` returns `{"status":"ok"}`; `GET /demo/current` returns the
   live case channel when the loop is on.
4. Watch the `headless_bob.audit` log lines: one per turn, with permissions,
   cost and stop reason.

## Bob version bumps

Change `BOB_VERSION` and `BOB_SHA256` in the `Dockerfile` together, build,
then run `scripts/verify_bob_version.sh` inside the new image with a key. It
checks the `bob acp` option set, the permission option ids, and that
read-only turns cannot write.
