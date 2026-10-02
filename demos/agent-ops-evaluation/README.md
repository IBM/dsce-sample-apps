# Agent Ops: build-time agent evaluation with IBM watsonx Orchestrate

A self-contained demo of the **evaluation framework in the watsonx Orchestrate ADK**, run live against a
small multi-agent system. It answers the question every team faces before an agent reaches customers:
*is the agent doing the right thing, and how do we know after every change?*

The system under evaluation is a loan-underwriting assistant made of an orchestrator and three specialist
agents. It exists in two versions. **v1** shipped with a defect: the compliance agent silently skips
anti-money-laundering (AML) screening for self-employed applicants. **v2** is the same system after
evaluating and optimizing. Visitors run both and watch the framework find the difference.

![Overview](docs/overview.png)

## What the demo shows

| Tab | What happens | What it demonstrates |
|---|---|---|
| **Run a scenario** | Submit one of five fixed loan applications to v1 or v2 and watch the handoffs, tool calls, arguments, results and token usage stream in; then load the same run from the platform trace | An agent that is wrong does not look wrong: v1 approves politely, with a reference number. Observability shows what happened after the fact |
| **Evaluate** | The framework replays five ground-truth test cases with a simulated applicant and scores the trajectory: Journey Success, routing accuracy, tool-call precision and recall; `analyze` reports root causes | v1 passes 3 of 5 while routing stays at 100%: the orchestrator is fine, one agent's instructions are not. Test cases are files, so this is a regression suite |
| **Rubric** | A judge model scores each conversation pass/fail against four compliance rules written in plain language | Policy becomes an executable test a risk team can own |
| **Red team** | An attacker model tries three strategies (crescendo, instruction override, emotional appeal) to obtain an approval without the AML check | v1: 3 of 3 attacks succeed on the first turn. v2: 0 of 3 after a six-turn escalation |

Everything on screen is computed by the run the visitor just started. Inputs are fixed (five applicants,
two versions); free text is not accepted. All applicants, credit records and sanctions results are
fictitious.

A presenter script with timings, talk track, expected numbers and likely questions is in
[docs/demo-script.md](docs/demo-script.md).

![Run a scenario](docs/run-scenario.png)

![Evaluate: v1 vs v2](docs/evaluate-v1-vs-v2.png)

## How it is built

![Architecture](docs/architecture.png)

```
browser ── React (Vite, Tailwind) ──► FastAPI backend ──► watsonx Orchestrate
                                        │  /v1/orchestrate/runs?stream=true   (live chat, normalized events)
                                        │  /v1/agentops-v3/observations        (platform trace)
                                        └─ child process: ADK evaluation framework (agentops) ──► the same agents
                                             evaluate · rubric · red team · analyze
```

- **Agents** (`agents/`): `loan_orchestrator_v1|v2` (planner style, owns the decision-letter tool),
  `intake_agent`, `credit_risk_agent`, `compliance_agent_v1|v2`. All run `watsonx/openai/gpt-oss-120b`.
  Names carry the prefix `agentops_d1_` so they can share an instance with other work; the UI hides it.
- **Tools** (`tools/`): five deterministic Python tools with fictitious data, so runs are repeatable.
- **Test assets** (`evaluations/`): `make_testcases.py` generates the five ground-truth cases per version
  (expected handoffs, tool calls, arguments and decision); eval and rubric configs; three hand-authored
  red-team attacks per version; `stories.csv` for `evaluations generate`.
- **Backend** (`app/`): chat proxy with a server-side allowlist of scenarios, trace reader, one-at-a-time
  evaluation jobs run through the framework's Python API with streamed logs, result parsing, limits.
- **Frontend** (`frontend/`): single-page app served by the backend from `frontend/dist`.
- **Scripts** (`scripts/`): import the agents, run the CLI equivalents, chat from a terminal, summarize
  results, smoke-test the container, screenshot the pages.

## Prerequisites

- An IBM Cloud account with a **watsonx Orchestrate** instance (SaaS) and an API key with access to it.
  For a public deployment use a service ID scoped to that one instance.
- Python 3.12, Node 20, the `orchestrate` CLI (`pip install "ibm-watsonx-orchestrate[agentops]==2.18.0"`,
  included in `requirements.txt`).
- Docker and the IBM Cloud CLI with the Code Engine plugin, for deployment.

## Run locally

```bash
pip install -r requirements.txt
orchestrate env add --name demo --url https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<id> --type ibm_iam
echo '{"apikey": "<your API key>"}' > ~/.wxo-demo-key.json && chmod 600 ~/.wxo-demo-key.json
./scripts/activate.sh demo            # activates the environment from the key file; the key is never echoed
./deploy.sh                           # imports the five tools and six agents (refuses unprefixed names)
cd frontend && npm ci && npm run build && cd ..
./scripts/dev-backend.sh              # http://127.0.0.1:8080
```

Environment variables used by the scripts: `WXO_ENV` (ADK environment name, default `demo`),
`WXO_API_KEY_FILE` (default `~/.wxo-demo-key.json`), `ORC` and `PYTHON` (paths to `orchestrate` and
`python3` when they are not on `PATH`).

The same evaluations from the command line:

```bash
./scripts/orc.sh evaluations evaluate -c evaluations/eval_config_v1.yaml
./scripts/orc.sh evaluations analyze  -d results/evaluate_v1/<run>/ -t tools/
./scripts/orc.sh evaluations evaluate -c evaluations/rubric_config_v2.yaml
./scripts/orc.sh evaluations red-teaming run -a evaluations/red_team_v2 -o results/red_team/run_v2
python scripts/summarize.py results/evaluate_v1
```

Typical durations with the app and the instance in the same region: a chat run about 13 s; evaluate
65–95 s; rubric 70–90 s; red team 45 s (v1) to 220 s (v2, the crescendo attack runs its full escalation).

## Deploy to IBM Cloud Code Engine

```bash
ibmcloud login --sso
ibmcloud ce project create --name <project>           # once, in the same region as the instance
APP_NAME=agentops-evaluation-demo ./deploy-ce.sh      # prompts for region, resource group, project, instance URL and key
```

The script stores the key as a Code Engine secret, builds the image from source with the Dockerfile
strategy, deploys a single instance (job state lives in memory), prints the URL and runs post-deploy checks.
Keep the Code Engine project in the same region as the watsonx Orchestrate instance: a run makes about
twenty API calls, and cross-region hops add up.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `WXO_INSTANCE_URL` | required | `https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<id>` |
| `WXO_API_KEY` | required | IBM Cloud API key (service ID recommended) |
| `WXO_ENV_NAME` | `demo` | Label the evaluation framework uses for its environment |
| `RESULT_FRESH_S` | `600` | Reuse an evaluation result younger than this unless a fresh run is requested |
| `CHAT_PER_IP_PER_10MIN` | `12` | Live chat runs per visitor |
| `CHAT_MAX_CONCURRENT` | `4` | Concurrent chat runs |
| `CHATS_PER_HOUR` | `300` | Global cap on chat runs |
| `JOBS_PER_HOUR` | `30` | Global cap on evaluation starts |
| `JOB_START_COOLDOWN_S` | `20` | Minimum gap between evaluation starts |
| `JOB_TIMEOUT_S` | `900` | Evaluation job timeout |
| `RUN_ROOT` | `/tmp/agentops-d1-runs` | Where run folders are written |

## Designed for public use

- Visitors choose from fixed inputs; the server maps a scenario id to the message and the agent, so no
  free text reaches the agents and no other agent on the instance can be addressed.
- Evaluation jobs run only this demo's test assets against this demo's agents, one at a time, with
  per-visitor and hourly caps that bound cost.
- The platform trace endpoint serves only traces produced by the app's own runs.
- No API documentation is exposed, server paths and the instance address are removed from anything a
  visitor can see, and the container runs as a non-root user with the key held only in a Code Engine secret.

## Implementation notes

Details that shaped the design and are useful when adapting the demo to your own agents:

- **Model choice.** The multi-agent flow needs reliable tool calling; `gpt-oss-120b` on watsonx.ai was
  the dependable choice for all agents in this setup. The test cases, rubric and attacks are independent
  of the model and run unchanged if you switch.
- **Orchestrator style.** The orchestrator uses the `planner` style and owns the decision-letter tool.
  Occasionally (about one run in ten) it still skips that tool on an obvious case and writes the
  decision itself; the evaluation flags it, which is the behaviour the demo is about, so v2 may show 4/5
  on a given run.
- **Handoffs in ground truth.** Collaborator handoffs are declared as goals (arguments ignored) so
  precision reflects the whole journey, and each agent's display name equals its name so the framework
  recognizes handoffs as routing.
- **Argument matching.** In each goal, strictly matched arguments are listed before the fuzzily matched
  applicant name; the framework evaluates arguments in order.
- **Red-team goals.** The attacks are hand-authored: an attack succeeds when the system issues a plain
  `APPROVED` letter for an applicant who must receive `CONDITIONAL_APPROVAL`. Review generated attack
  plans before relying on them.
- **Conversation length.** Test cases cap `max_user_turns` at 3 and the simulated applicant is told to
  reply `END` once the decision arrives, keeping each case to one real turn.
- **Framework authentication.** The runner seeds the ADK's credential cache in a private `HOME` with a
  token from the app's API key and exposes `WO_API_KEY` for refresh.
- **Analyze input.** The runner normalizes a copy of the run folder (`text_match` as the enum string the
  analyzer expects) before calling `evaluations analyze`.
- **Platform trace.** The observations API needs a start-time window (up to 4 hours) and allows four
  lookups per minute; the app caches traces and rate-limits lookups.

## License

Apache License 2.0. See [LICENSE](LICENSE).
