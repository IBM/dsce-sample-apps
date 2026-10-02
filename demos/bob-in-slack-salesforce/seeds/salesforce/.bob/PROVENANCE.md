# Workspace seed: Salesforce skills

This `.bob/` directory is copied into every new Bob session workspace when
`HB_SEED_DIR` points here. It carries eleven Salesforce skills written by
IBM Consulting's Salesforce delivery practice (solution advice, Flow
development, Apex architecture, declarative and Data 360 architecture,
integrations, testing, business analysis, architecture decision records,
org diagnostics) and one skill written for this sample.

Skills are Markdown playbooks: a persona, when to use it, a procedure and an
output shape. Bob loads one when it judges it relevant, or when a prompt
names it. They give Bob no tools of their own; what Bob can do comes from
its built-in tools plus MCP servers. The package variant writes a `mcp.json`
into each session pointing at the service's read-only org endpoint. Replace
this directory with your own skills to point Bob at a different domain; see
docs/customize.md.

The eleven SFIDS skills were vendored from IBM's internal SFIDS skills
repository, September 2026, unmodified. Do not edit them in place; sync from
the source instead. Their text refers to "the orchestrator", a routing mode
and skill from the same repository that this sample does not ship: it
depended on a documentation knowledge base that is not deployed here, and
every turn runs in Bob's default agent mode instead.

`sf-metadata-reference/` is ours: validated metadata XML for the component
types the package variant deploys, with the validation errors Salesforce
returns and the shapes that avoid them. Every example is checked against the
org by `scripts/verify_reference.py`; last verified 2026-09-24 against a
Developer Edition org on API 60.0.
