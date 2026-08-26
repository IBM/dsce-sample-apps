# Specification: Backend APIs
The following specification outlines the steps required to build backend API endpoints of a retail product ordering website for a company called Orbital Suppliers. Data for the website will have been uploaded to a Postgres database based on @specifications/1-generate-dataset.md.

## Prerequisites

No specific skills are required for this specification. Load any skills that seem relevant — new ones may be added over time.

## Requirements to follow
The following guidelines must be followed when building the backend API endpoints:
* Use Vite as a lightweight local development server and asset bundler.
* Use axios for external HTTP calls (e.g. watsonx Orchestrate). Use the `@opensearch-project/opensearch` npm client for network calls to OpenSearch (see Spec 2.1).
* When calling the IBM IAM token endpoint (`/identity/token`) from within an OpenShift cluster, use the private endpoint `https://private.iam.cloud.ibm.com` — the public `https://iam.cloud.ibm.com` is not reachable from ROKS pods (no internet egress).
* All environment variables must be read from @.env and not included in code
* Create all new files and folders under [./backend](./backend).
* Use JWT to maintain sessions.  
* Use snake_case variables in JSON for accepting/sending data to/from the server endpoints
* Do not create any UI components.  A later specification will build the UI.

## Step 1: Build API endpoints
The endpoints to build are documented in @specifications/backend/api_endpoints.md
* Login-dependent functionality
  * Users must login to access Add to Cart and Cart functionality.
  * Orders are accessible if logged-in.

## Step 2: Add /agentSearch endpoint
Create an `/agentSearch` endpoint that:
1. Accepts a user's natural language search query
2. Embed the user's query to search the vector DB for the top 4 results including metadata
3. Passes the user query plus vector DB results to a `product_search` agent using watsonx Orchestrate's REST API
4. The agent replies in natural language describing the products.
5. Return the agent's natural language response plus the matching product results as `{agent_response, products[]}`.

**IAM token endpoint — use the right URL for each environment:**

| Environment | IAM endpoint | Notes |
|---|---|---|
| Local / Rancher | `https://iam.cloud.ibm.com/identity/token` | Public internet — reachable from your machine |
| OpenShift (ROKS) | `https://private.iam.cloud.ibm.com/identity/token` | Private IBM Cloud network — the public endpoint times out from cluster pods |

Use `WO_INSTANCE_URL_PRIVATE` (from `.env`) as the watsonx Orchestrate base URL when running in-cluster. The public `WO_INSTANCE_URL` is also unreachable from ROKS pods.

## Cleaning up
* Write documentation but keep it super simple and non-verbose.  Max of 3-4 pages per .md file. Place these into /backend/docs.
* Generate a swagger document with server endpoint that fully describes the API endpoints.
* Update the .env with the missing backend variables.
  * BACKEND_SERVER_URL
  * BACKEND_SWAGGER_URL
* Ensure that the .gitignore contains all files that should not be checked into the repo.  For example; package-lock.json, ...
