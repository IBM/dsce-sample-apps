# ADK Setup — Orbital Suppliers Product Search Agent

## Prerequisites

- Python 3.12 (used by the project `venv/`)
- A watsonx Orchestrate IBM Cloud instance
- `WO_INSTANCE_URL` and `WO_API_KEY` set in `.env`

## 1. Install the ADK

The ADK is installed into the shared project virtual environment:

```bash
venv/bin/pip install ibm-watsonx-orchestrate
```

Verify the installation:

```bash
venv/bin/orchestrate --version
# Expected: ADK Version: 2.x.x
```

## 2. Register the `ibm_cloud` environment

This step is **run once** to register the watsonx Orchestrate instance URL. It does **not** require the API key at registration time — the key is supplied when activating.

```bash
venv/bin/orchestrate env add \
  --name ibm_cloud \
  --url "$WO_INSTANCE_URL"
```

> If the environment already exists the CLI will ask to confirm an update. Press `Y`.

## 3. Activate the environment

Activate before running any ADK command that targets the IBM Cloud instance:

```bash
venv/bin/orchestrate env activate ibm_cloud --api-key "$WO_API_KEY"
```

Expected output:
```
[INFO] - Environment 'ibm_cloud' is now active
[INFO] - Active workspace: Global workspace
```

## 4. Confirm activation

```bash
venv/bin/orchestrate env list
```

The `ibm_cloud` row should show as the active environment.

## 5. `.gitignore` entries

The ADK stores tokens in `~/.orchestrate/`. The following entries keep credentials out of the repo:

```
# watsonx Orchestrate ADK
.orchestrate/
agent/.orchestrate/
```

Both entries are present in the project `.gitignore`.
