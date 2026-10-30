# Spec-Driven Contract Reviewer
Use these `Specifications` to perform `Spec-Driven Development` and build the **Contract Reviewer** — an AI contract review assistant on **IBM watsonx Orchestrate** — using [IBM Bob](https://bob.ibm.com/) and the [IBM Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs).

A reviewer uploads a vendor PDF, compares its clauses against a standard contract template using vector search, sees deviations with actionable recommendations, and regenerates a corrected PDF — all from one chat-based web UI.

## What you'll build

```
Browser (single-page UI served by ui_proxy)
    ├─ POST /upload             → ui_proxy → PyMuPDF → AstraDB (vendor_contract) + IBM COS
    ├─ POST /chat               → ui_proxy → injects context → WXO agent
    ├─ GET  /template_clauses   → ui_proxy → AstraDB (standard_template)
    └─ GET/POST /governance/*   → ui_proxy → WXO Evaluation API v2

WXO Agent (contract_reviewer · react_core · groq/openai/gpt-oss-120b)
    ├─ searchClause tool → search_contract_clause (Code Engine) → AstraDB
    └─ rectifyPdf tool   → regenerate_pdf (Code Engine)         → IBM COS
```

## Get Started. Provide the Specifications to Bob to build the asset yourself
**A.** Update [.env_template](.env_template) with the required variables, then rename to `.env`.

**B.** Add the [Building Blocks Skills](https://ibm-self-serve-assets.github.io/building-blocks-docs/ibm-bob/skills/) to your global `~/.bob` folder.

**C.** Ask Bob to:
```
Follow the instructions in @specifications/0-team-manager-ibm-building-blocks
```
Bob will [spawn a team of subagents](https://bob.ibm.com/docs/ide/features/subagents) to convert these [Specifications](specifications) into requirements and then into the working solution.

- [Spec 0:](specifications/0-team-manager-ibm-building-blocks.md) Teach Bob to spawn a subagent team
- [Spec 1:](specifications/1-ingest-standard-template.md) Ingest the standard contract template into AstraDB
- [Spec 2:](specifications/2-vector-search-astradb.md) Vector search design (AstraDB `$vectorize`, clause schema, query patterns)
- [Spec 3:](specifications/3-tool-services.md) Build the `searchClause` and `rectifyPdf` tool services
- [Spec 4:](specifications/4-ui-proxy-backend.md) Build the UI proxy backend (auth, upload, chat, governance)
- [Spec 5:](specifications/5-frontend-ui.md) Build the single-page web UI
- [Spec 6:](specifications/6-contract-review-agent.md) Build and deploy the `contract_reviewer` agent to watsonx Orchestrate
- [Spec 7:](specifications/7-governance-evaluation.md) Governance & Evaluation (WXO Evaluation API v2)
- [Spec 8:](specifications/8-qa-end-to-end.md) QA the final solution

### D. Containerize and run locally
- [Spec 9:](specifications/9-containerize-local.md) Dockerfiles and local run for all three services

### E. Deploy to IBM Cloud
- [Spec 10:](specifications/10-deploy-code-engine.md) Deploy the tool services to IBM Code Engine
- [Spec 11:](specifications/11-deploy-openshift.md) Deploy the UI proxy to OpenShift

Shared reference: [environments.md](specifications/environments.md) · [API endpoints](specifications/backend/api_endpoints.md) · [clause schema](specifications/data/clause_schema.md) · [UI layout](specifications/frontend/ui-layout.md)

## Sample data used by the specs
These already exist in the repository root and must not be regenerated:

| Asset | Path |
|---|---|
| Standard template PDF | `scripts/templates/GTA.Standard-Template.pdf` |
| Sample vendor contracts | `docs/GTA.AGON-Contract.pdf`, `docs/GTA.Ebikes-Contract.pdf`, `docs/GTA.Everton-Contract.pdf`, `docs/GTA.HELY-Contract.pdf` |
| Clause type taxonomy | [`specifications/data/clause_types.yaml`](specifications/data/clause_types.yaml) |

## Spec-Driven Development
`Spec-Driven Development` replaces crafting complex, quirky prompts with straightforward technical `Specifications` that guide frontier models to autonomously design, build, test and refine production-ready solutions over 30–60 minutes.
