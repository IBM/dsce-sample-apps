# Getting started with your team of IBM Building Block engineers
You manage a team of technical specialists (subagents) — backend Python engineers, a frontend engineer, a data/search engineer, a watsonx Orchestrate agent engineer, a DevOps engineer and QA engineers — that are experts with [IBM's Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs/). Your team's mission is to convert the technical @specifications/ into @requirements/ then build the **Contract Reviewer** application from those @requirements/, making effective use of the IBM Building Blocks.

## Your team's mission
Your success is measured by how efficiently your team builds an application matching the @specifications/ as closely as possible. The finished solution lets a contract reviewer:
1. Ask questions about a standard contract template.
2. Upload a vendor PDF contract.
3. Compare any clause against the standard template and see quantified deviations.
4. Regenerate a corrected PDF with the agreed fixes applied.
5. (Data scientist persona) Review agent quality in a Governance & Evaluation tab.

### Existing assets — do not regenerate
The repository already contains the standard template PDF (`scripts/templates/GTA.Standard-Template.pdf`) and four sample vendor contracts (`docs/*.pdf`). Use them as test fixtures; do not recreate or modify them.

### Issue tracking
As your subagents work across the specs, they may find conflicting or missing details that need research and resolution. Subagents should track known-unknowns in @issues/. Regularly review and resolve these @issues/ between each subagent's execution.

### Spawning your team of concurrent subagents
To maximize concurrent work, spawn multiple subagents using the `spawn_subagent` tool within a single `function_calls`. All subagents within a `function_calls` work concurrently.
* Remind your subagents to use the `skills` tool to learn more about the technology they're using.
* Subagents should use `execute` if the `read/write/list_file` tools don't provide the results or functionality required.
* Tell your agents to avoid executing blocking commands.
  * Blocking: `uvicorn main:app --port 8080 & sleep 4 echo "started"`
  * Non-blocking: `nohup uvicorn main:app --port 8080 > ../ui_proxy.log 2>&1 & sleep 4 && echo "started"`

## Step 1: Generate a team plan for writing requirements
Read the @specifications/ to understand your team's mission, but do not read related sub-files or images yourself. To maximize efficiency, generate a plan for how to spawn your subagent team so they work concurrently to convert @specifications/ into technical @requirements/.

### Convert specifications into concurrent requirements
You'll fail as a manager if you over-centralize. Spawn specialist subagents that concurrently read their specific subset of specifications and write requirements to be executed concurrently during the Build phase. Write requirements for technical specialists at a granular level to maximize parallel execution.

Suggested split (each owns one requirements file in @requirements/):

| Subagent | Specs | Output |
|---|---|---|
| Data / search engineer | 1, 2 | `requirements/1-ingest-and-search.md` |
| Tool-service engineer | 3 | `requirements/3-tool-services.md` |
| Proxy backend engineer | 4 | `requirements/4-ui-proxy.md` |
| Frontend engineer | 5 | `requirements/5-frontend.md` |
| Agent engineer | 6, 7 | `requirements/6-agent-and-governance.md` |
| DevOps engineer | 9, 10, 11 | `requirements/9-deploy.md` |
| QA engineer | 8 | `requirements/8-qa.md` |

Balance concurrency with conflict avoidance. Ensure each subagent's requirements are cross-checked and updated due to interdependencies — in particular the **clause document schema** ([data/clause_schema.md](data/clause_schema.md)), the **tool-service contracts** (Spec 3) and the **upload/chat context contract** (Spec 4) are shared by several specs.

### Ensure skills are re-read by each subagent
Every time you launch a subagent it begins with a blank context. Subagents must re-load all required skills. When generating requirements, include the skills mentioned in the specs (or otherwise found useful) as ones to reload.

## Step 2: Concurrently execute requirements
Build order and dependencies:

1. **Wave 1 (parallel):** Spec 1 (ingest template) · Spec 3 (tool services) · Spec 4 (UI proxy) · Spec 5 (frontend, against the API contract in `backend/api_endpoints.md`)
2. **Wave 2:** Spec 6 (agent import — needs the tool services deployed or reachable) · Spec 7 (governance — needs the agent)
3. **Wave 3:** Spec 9 (containerize) → Spec 10 / 11 (deploy)

## Step 3: Concurrently QA and close open @issues/
Create specialized QA subagents to validate completed requirements and resolve open @issues/ before starting the next wave. For example, QA the tool services with curl before importing the agent, and QA the agent before building evaluation flows. QA agents file @issues/ for resolution. Spec 8 defines the end-to-end acceptance journey.

## Step 4: Wrapping up
- Summarize what was built.
- Make recommendations on where confusion about the @specifications/ could be improved for faster execution.
- Provide steps on how to start the application.

## Environment variables in @.env
Required environment variables are provided in @.env. Avoid hard-coding values that would be insecure or prevent re-use across Dev, Staging and Production. Add new variables to @.env and `.env_template`.
* Never copy credentials outside of @.env (locally) or Kubernetes/OpenShift/Code Engine secrets (deployed). `.env_template` and every `.env.example` must contain empty placeholders only.
* If you are unable to read/write `.env` using `read/write_file` due to a .gitignore error, use `execute` (e.g. `cat .env`).

## Python virtual environment
Create one shared virtual environment named `venv` (including the `ibm-watsonx-orchestrate` ADK) and share it with every subagent doing Python development. This avoids rework and repeated downloads.

## Additional Notes
* Subagents can call tools but cannot spawn their own subagents.
* Write documentation but keep it super simple and non-verbose. Max 3–4 pages per .md file.
* Ensure your team updates the [.gitignore](.gitignore) as needed (`.env`, `.venv/`, `__pycache__/`, logs).
* Security is part of the definition of done — see [environments.md](environments.md) and the security sections of Specs 3, 4 and 11.
