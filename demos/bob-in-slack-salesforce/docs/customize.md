# Making it your use case

The Slack adapter is generic. The case flow is one integration built on it.
A different use case changes some or all of four things.

## 1. The skills Bob loads

`HB_SEED_DIR` names a directory whose `.bob/` is copied into every new
session workspace: `skills/<name>/SKILL.md` for skills, `custom_modes.yaml`
for modes if you define any, `mcp.json` for MCP servers. The sample ships
twelve Salesforce skills and no custom mode
([seeds/salesforce/.bob/](../seeds/salesforce/.bob/)).

Replace the directory with your own. A skill is a Markdown playbook: a
persona, when to use it, a procedure, an output shape. One of them,
`sf-metadata-reference`, is different in kind: validated metadata XML for
the component types the package variant deploys, with the errors Salesforce
returns and the shapes that avoid them. The build and fix prompts tell Bob to
read it, and `scripts/verify_reference.py` validates every example against
your org so the reference stays true. Extend it when you widen
`HB_PACKAGE_TYPES`. Skills give Bob no
tools; tools come from Bob itself and from MCP servers you configure. Bob
2.0.4 supports stdio, HTTP and SSE MCP servers; prefer one shared HTTP server
over a stdio process per session. The package variant does exactly that: the
service hosts a read-only view of the org at `/mcp`
([org_mcp.py](../src/headless_bob/org_mcp.py)) and writes its address and a
bearer token into each session's `mcp.json`. Read-only tools for your own
system go in the same place; Bob sees data, never a credential.

`HB_SLACK_MODE` picks the mode for free-form questions. Empty, the default,
is Bob's `agent` mode, the same one the case turns use. Bob's built-in `ask`
mode has no edit or execute tools at all, a stricter ceiling for a read-only
assistant if you want one; skills load in either.

## 2. The prompts for each beat

All in [caseflow.py](../src/headless_bob/caseflow.py):

- `_proposal_prompt`: what Bob is asked when a case arrives, including the
  structure of the answer and the org context it must design against.
- `_summary_prompt`: the documentation beat.
- `chat_context`: the prefix for free-form questions. This is where Bob's
  scope is set. Today it frames every question as being about this case and
  its proposal, which is why Bob declines unrelated requests. Widen the
  framing to widen the assistant.

Prompts are self-contained on purpose: the case and the proposal are
embedded, so a turn works even if Bob's session was reaped. With a
persistent `/workspace` the runtime also reloads sessions, so history is
available either way.

## 3. The change deployed on approval

`HB_FLOW_VARIANT` selects who builds the change.

- `package`: Bob writes it as Salesforce metadata in its workspace; the
  service validates, deploys and rolls it back
  ([package_artifact.py](../src/headless_bob/package_artifact.py)). Tune
  `HB_PACKAGE_TYPES` to the metadata types your admins would accept from a
  proposal, and the build prompt (`_build_prompt`) to your conventions.
- `successplan` or `validation_rule`: a predefined artifact the service
  deploys ([successplan.py](../src/headless_bob/successplan.py) or the
  Salesforce client). An artifact implements `deploy`, `links` for the
  confirmation message and `cleanup` for close; add a module with those
  three and a branch in `approve_implement`.

For a system other than Salesforce, the package pipeline is the shape to
copy: `collect` what Bob wrote, `check` it without changing anything, take a
`snapshot`, `deploy` on approval, `rollback` on close. A Terraform plan, a
pull request or a configuration API all fit. The approvals, the audit and the
Slack mechanics stay. See [deployment-approaches.md](deployment-approaches.md)
before letting Bob execute a change itself.

## 4. The approval gates

Three buttons today: approve solution, approve deploy, approve close, plus
reject at any point. They are Slack block actions handled in
`handle_interaction` and routed to the case flow. Add or remove beats by
editing the state machine in the `caseflow` table
(`alerted → solution_approved → implemented → closed`) and the handlers that
advance it. Each transition is a single conditional update, so double clicks
are no-ops.

## Things you probably keep

- The runtime's permission policy and budgets in
  [acp_runner.py](../src/bob_runtime/acp_runner.py).
- The environment allowlist in [workspace.py](../src/bob_runtime/workspace.py).
- The attract loop and the startup reconcile, if you want a sample case
  always waiting.
- `scripts/verify_bob_version.sh`, run before every Bob version bump.
