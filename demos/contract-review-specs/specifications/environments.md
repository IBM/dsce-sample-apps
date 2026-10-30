# Environment Configuration Reference

Key variables that differ between environments. All values live in `.env` (local) or in Kubernetes / OpenShift / Code Engine secrets (deployed) — never hard-coded, never committed.

## Environment-specific values

| Variable / setting | Local (native) | Local containers | Code Engine (tools) | OpenShift (UI proxy) |
|---|---|---|---|---|
| `ui_proxy` URL | `http://localhost:8080` | `http://localhost:8080` | n/a | OpenShift Route (TLS edge) |
| `search_contract_clause` URL | `http://localhost:8081` | `http://localhost:8081` | `https://search-contract-clause.<id>.<region>.codeengine.appdomain.cloud` | n/a |
| `regenerate_pdf` URL | `http://localhost:8082` | `http://localhost:8082` | `https://regenerate-pdf.<id>.<region>.codeengine.appdomain.cloud` | n/a |
| `ALLOWED_ORIGIN` | empty | empty | n/a | empty (same-origin) |
| Secret source | `.env` | `--env-file` | CE secret / env | OpenShift `Secret` |
| Replicas | 1 | 1 | ≥ 1 (stateless) | **1** (sessions in memory) |

## Variables by service

| Variable | `ui_proxy` | `search_contract_clause` | `regenerate_pdf` | `scripts/` |
|---|:-:|:-:|:-:|:-:|
| `WXO_BASE_URL`, `WXO_API_KEY`, `WXO_AGENT_ID` | ✔ | | | |
| `UI_USERNAME`, `UI_PASSWORD`, `ALLOWED_ORIGIN` | ✔ | | | |
| `ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION` | ✔ | ✔ | | ✔ |
| `COS_API_KEY`, `COS_SERVICE_INSTANCE_ID`, `COS_ENDPOINT`, `COS_BUCKET` | ✔ | | ✔ | |
| `COS_HMAC_ACCESS_KEY_ID`, `COS_HMAC_SECRET_ACCESS_KEY` (optional) | | | ✔ | |
| `SERVICE_API_KEY` (min 24 chars) | | ✔ | ✔ | |
| `DEFAULT_TEMPLATE_ID` | ✔ | | | |

`SERVICE_API_KEY` is a **different value per service**. The same value is entered in the WXO connection that calls that service (header `X-API-Key`). In the root `.env_template` these are named `SEARCH_SERVICE_API_KEY` and `REGENERATE_SERVICE_API_KEY`; each service's own `.env` uses the plain name `SERVICE_API_KEY`.

## Why the COS endpoint must match across services
`ui_proxy` writes `original_{vendor_id}_{session_id}.pdf` and builds `cos_pdf_url = {COS_ENDPOINT}/{COS_BUCKET}/{key}`. `/chat` and `regenerate_pdf` both accept a URL only if it starts with that exact `COS_ENDPOINT/COS_BUCKET` prefix. If the two services use different `COS_ENDPOINT` values, every regeneration is rejected with `422`. Keep the value identical.

## Credentials: what is never needed
* No NVIDIA key — AstraDB does embeddings server-side (`$vectorize`).
* No watsonx.ai key — the agent LLM is hosted by WXO.

## Handling rules
* Real values only in gitignored `.env` files (local) or secrets (deployed).
* `.env.example` / `.env_template` contain empty placeholders only.
* Each service's `.dockerignore` excludes `.env` from the image.
* Generate shared secrets: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`.
* Rotate any credential that was ever copied outside those locations.
