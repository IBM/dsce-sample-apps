# Who makes the change: the service, or Bob?

When a person approves a change in Slack, something has to execute it in
Salesforce. This sample ships two approaches, selected with `HB_FLOW_VARIANT`,
and documents a third.

## Approach C, Bob writes the change, the service deploys it (`package`)

The approach for a real use case. Bob designs the change and writes it as
Salesforce metadata, source format under `force-app/main/default`, in its own
workspace. The service turns the files into a package and drives it through
the Salesforce Metadata API. Bob never deploys and never holds a credential.

How a case runs:

1. **Alert.** The service asks Bob for a proposal. Bob reads the org through a
   read-only MCP endpoint the service hosts (`describe_object`, `list_objects`,
   `list_flows`, `query` for `SELECT` statements only) and designs against the
   org as it is.
2. **Approve solution.** Bob writes the use-case summary, then the build turn:
   Bob writes the metadata files and a manual test procedure. Every new
   component name ends with the case number.
3. **Validate.** The service collects the files, allowlisted metadata types
   only with size and count limits, converts them to metadata format and asks
   the org to validate the package (`checkOnly`; Apex tests Bob wrote run as
   `RunSpecifiedTests`). Errors go back to Bob for up to
   `HB_PACKAGE_FIX_ATTEMPTS` fix turns. Nothing in the org has changed yet.
4. **Approve deploy.** The Slack message lists exactly the components; the
   click deploys them. First the service retrieves the org's current version
   of everything the package touches, the snapshot for rollback.
5. **Test.** Bob's test steps are posted with links into Setup. The sample also
   proves the Success Plan Flow by watching for the record when a deal closes.
6. **Approve close.** The service restores the snapshot and removes what was
   new: Flows through the Tooling API (deactivate, delete versions), then
   the other types one destructive deploy at a time, references before the
   fields they use. The org is back where it started.

| | |
|---|---|
| **General** | Bob builds what the case asks for, Flow, field, validation rule, Apex with tests, using the Salesforce skills as written. |
| **Credentials** | Stay in the service. Bob's only path into the org is the read-only endpoint, bearer-token authenticated, so prompt injection cannot change anything. |
| **Governed** | Allowlisted types, validation against the org before anyone is asked, the exact component list on the approve button, a snapshot before deploy, rollback on close. |
| **Non-deterministic** | Every build differs. Validation proves the package deploys and its tests pass, not that the logic is right; Bob's test steps and a human tester close that gap. |
| **Cost and speed** | Minutes and a few coins per build; a fix turn per validation error round. |
| **Where it runs** | A sandbox, a scratch org or a Developer Edition. Do not point it at production from chat. |
| **If the service loses its database** | The rollback snapshot lives in the service database. On a platform with ephemeral disk a redeploy mid-case leaves the deployed components in the org; `scripts/rollback_case.py <case number>` finds them by their case suffix and removes them. Give `/workspace` a persistent volume to avoid this. |

For production, the same package should go to a pull request against the
customer's metadata repository and through their pipeline; `deploy` in
[package_artifact.py](../src/headless_bob/package_artifact.py) is the one
function to swap, the gates and the audit stay. That is the documented next
step, not part of this sample.

Configuration: `HB_FLOW_VARIANT=package`, `HB_MCP_URL` (loopback by default,
Bob runs in the same container), `HB_MCP_TOKEN`, `HB_PACKAGE_TYPES`,
`HB_PACKAGE_FIX_ATTEMPTS`, `HB_PACKAGE_MAX_COST` (the per-case Bob budget;
a build with fix turns costs more than a chat) and `HB_SLACK_MAX_COST_PER_DAY`.
Code: [metadata_api.py](../src/headless_bob/metadata_api.py)
(validate, deploy, retrieve), [package_artifact.py](../src/headless_bob/package_artifact.py)
(collect, check, snapshot, deploy, rollback), [org_mcp.py](../src/headless_bob/org_mcp.py)
(the read-only endpoint) and the `package` branches in
[caseflow.py](../src/headless_bob/caseflow.py).

## Approach A, a predefined change (`successplan`, `validation_rule`)

Bob reads the case, proposes, documents and answers questions. On approval,
the service deploys a **predefined change** through the Salesforce APIs.
Bob's proposal is constrained by the prompt to describe that change. The
change is a date field plus a record-triggered Flow, built in
[successplan.py](../src/headless_bob/successplan.py); the older variant is a
validation rule.

| | |
|---|---|
| **Deterministic** | The same change and the same clean-up every time. Safe to run in a loop all day, which is what a booth or a kiosk needs. |
| **Cost and speed** | Seconds per deployment, no coins spent on a build. |
| **Limits** | One artifact per use case, written in code. Bob is the designer in name more than in fact, and the implementation skills are not exercised. |

## Approach B, Bob drives the Salesforce CLI (documented, not built)

Install the Salesforce CLI in the image, authenticate it to the org, and let
Bob build and deploy from its workspace. Each deploy command reaches the
service as an `execute` permission request carrying the command text; the
policy can refuse it, allow it, or, with a small bridge, turn it into a Slack
**Approve** button and wait for the click before answering Bob.

| | |
|---|---|
| **Familiar** | The workflow a Salesforce developer already knows, end to end. |
| **Credentials** | The CLI's org login lives under Bob's home, readable by Bob, so exposed to prompt injection. Needs a least-privilege integration user, a non-shared org and an egress policy. |
| **Prerequisites** | The permission-to-Slack bridge, so a person sees the specific command being approved. |
| **Compared with C** | Same generality, weaker credential story, and the service can no longer validate, list or roll back what Bob deployed. |

## Our choice

C for a real use case. A when the point is a deterministic loop that runs
unattended. B for teams who want the CLI experience and accept that Bob
holds an org login.

## Verified facts behind this

- On Bob Shell 2.0.4, an `execute` permission request carries the command
  text in the tool call's title, so B's gate is real.
- Nothing in the seeded skills or the custom mode references the Salesforce
  CLI; no CLI is installed in this image and no org credentials reach Bob.
- On 2.0.4, a headless session reads an HTTP server from `.bob/mcp.json`
  and calls its tools during a prompt; Bob called the service's
  `describe_object` before writing metadata. Verified 2026-09-24.
- The full cycle ran against a Developer Edition org on 2026-09-24: Bob
  wrote a record-triggered Flow and a custom field in under a minute for
  about a quarter of a dollar, the package validated on the first try,
  deployed in seconds, and the rollback left the org exactly as before.
- A destructive deploy refuses a Flow that was ever active, so Flows are
  removed through the Tooling API; a field cannot be removed while a Flow
  or class still references it, so removal runs one type at a time,
  references first.
