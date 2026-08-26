# Requirements: Agentic Product Search

## Skills to Load
Before implementing, load these skills using the skill tool:
- `watsonx-orchestrate` — ADK, agent YAML, `orchestrate` CLI, deploying and chat-testing agents
- `agent-builder` — building and deploying agents and tools via the ADK
- `agent-integrate` — integrating the deployed agent into the backend `/agentSearch` endpoint via REST API

---

## 1. Overview

Deploy a `product_search` agent to **watsonx Orchestrate (wxO)**. The backend `/agentSearch` endpoint queries ChromaDB for the top-4 matching products, passes the user's query plus those products to the agent, and returns the agent's natural-language reply alongside the product array. The frontend renders the agent reply in a "Product Assistant" chat bubble with product cards below it (see `specifications/frontend/design-mockups/agentic-search/agentic_search.png`).

The agent has **no tools**. It receives all product context in the message body and responds in 2–3 sentences.

---

## 2. Environment Variables

All variables are read from `.env`. Do **not** hard-code values.

| Variable | Value / Notes |
|---|---|
| `WO_INSTANCE_URL` | `https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/876f8193-ec39-4284-a14a-c38a38998de7` |
| `WO_API_KEY` | `sGgNbj-UD3zbfcS0bxVxuDJnvXcWorg6qH-P8DwX25GN` |
| `WO_ADK_ENVIRONMENT` | `ibm_cloud` |
| `WO_AGENT_ID` | *(populate after deployment — see §6)* |
| `WO_ENVIRONMENT_ID` | *(populate after deployment — see §6)* |

Add `WO_AGENT_ID` and `WO_ENVIRONMENT_ID` as empty placeholders to `.env` now; fill them in after the agent is deployed.

```dotenv
# WO: agent identifiers (populated post-deployment)
WO_AGENT_ID=
WO_ENVIRONMENT_ID=
```

---

## 3. ADK Setup

The shared virtual environment is `venv/` (Python 3.12).

### 3.1 Install the ADK

```bash
source venv/bin/activate
pip install ibm-watsonx-orchestrate
```

Verify:

```bash
orchestrate --version
```

### 3.2 Create the `ibm_cloud` environment

Run once. Uses the values already set in your shell from `.env`:

```bash
source venv/bin/activate

orchestrate env add \
  --name ibm_cloud \
  --url "$WO_INSTANCE_URL" \
  --api-key "$WO_API_KEY"
```

Activate it for all subsequent ADK commands:

```bash
orchestrate env activate ibm_cloud
```

The ADK stores environment config in `~/.orchestrate/` — this directory must **not** be committed. Confirm `.gitignore` contains:

```
# watsonx Orchestrate ADK
.orchestrate/
agent/.orchestrate/
```

---

## 4. Directory Structure

All agent files live under `agent/`.

```
agent/
├── product_search.yaml       # Agent definition (§5)
├── deploy.sh                 # Deployment helper script (§6)
└── docs/
    ├── setup.md              # ADK install + env setup
    ├── deployment.md         # Deploy / verify / update steps
    └── api-integration.md    # REST API call format for /agentSearch
```

---

## 5. Agent YAML Specification

File: `agent/product_search.yaml`

```yaml
agent_definition:
  spec_version: "v1"
  name: product_search
  display_name: Product Search Assistant
  description: >
    Reviews a set of retrieved product results in the context of a user's
    natural-language query and returns a concise, insight-driven summary
    that helps the user understand why the products are a good fit.
  model: ibm/granite-3-8b-instruct
  instructions: |
    You are a helpful product advisor for Orbital Suppliers.

    You will receive:
    - The user's search query
    - A list of up to 4 matching products, each with a name, category, and description

    Your task:
    1. Read all products carefully in the context of the user's query.
    2. Write 2–3 natural language sentences that explain why these products are
       a good fit for the user's specific need or situation.
    3. Do NOT simply restate product names or copy product descriptions.
       Instead, synthesise across the products to give meaningful, contextual
       insight — e.g. how they complement each other, what use-case they
       collectively address, or what makes them stand out for this query.
    4. Keep the tone friendly, concise, and helpful.
    5. Do not use bullet points, numbered lists, or headings in your reply.
  tools: []
```

> **Model note:** `ibm/granite-3-8b-instruct` is a cost-efficient, instruction-tuned model available in watsonx Orchestrate on IBM Cloud. Substitute `ibm/granite-3-3b-instruct` if the instance quota requires a smaller model, or `ibm/granite-3-2-8b-instruct-preview-rc` if that ID is required by your specific instance version.

---

## 6. Deployment Steps

All commands assume the `ibm_cloud` environment is active (§3.2).

### 6.1 Deploy the agent

```bash
source venv/bin/activate
orchestrate env activate ibm_cloud

orchestrate agents create --file agent/product_search.yaml
```

### 6.2 Verify deployment

List agents to confirm `product_search` appears and note its ID:

```bash
orchestrate agents list
```

Expected output includes a row like:

```
product_search   <AGENT_ID>   ibm/granite-3-8b-instruct   active
```

### 6.3 Chat-test from the CLI

```bash
orchestrate agents chat --agent product_search
```

Enter a test message (paste a query + product block as shown in §7 request body). Verify the reply is 2–3 sentences of insight, not a list of product names.

### 6.4 Retrieve environment ID

```bash
orchestrate env list
```

Note the `environment_id` for `ibm_cloud`. This is `WO_ENVIRONMENT_ID`.

### 6.5 Update `.env`

```dotenv
WO_AGENT_ID=<value from orchestrate agents list>
WO_ENVIRONMENT_ID=<value from orchestrate env list>
```

### 6.6 Update an existing deployment

If the agent YAML changes, redeploy with:

```bash
orchestrate agents update --file agent/product_search.yaml
```

---

## 7. REST API Integration

The backend `/agentSearch` endpoint calls the deployed agent via the watsonx Orchestrate REST API. Use `axios` (already required in `specifications/3-backend-apis.md`).

### 7.1 Authentication — get a bearer token

Before each call (or cache with refresh), exchange the API key for a short-lived IAM token:

```javascript
// backend/services/woAuth.js
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

async function getIamToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const resp = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: process.env.WO_API_KEY,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = resp.data.access_token;
  tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000; // refresh 60s early
  return cachedToken;
}

module.exports = { getIamToken };
```

### 7.2 Call the agent

```javascript
// backend/services/agentSearch.js
const axios = require('axios');
const { getIamToken } = require('./woAuth');

/**
 * @param {string} userQuery  - the user's natural-language search string
 * @param {Array}  products   - top-4 products from ChromaDB (name, category, description)
 * @returns {string}          - agent's natural-language response
 */
async function callProductSearchAgent(userQuery, products) {
  const token = await getIamToken();

  const productContext = products
    .map((p, i) => `Product ${i + 1}: ${p.name} (${p.category}) — ${p.description}`)
    .join('\n');

  const messageContent =
    `User query: ${userQuery}\n\nMatching products:\n${productContext}`;

  const url = `${process.env.WO_INSTANCE_URL}/v1/environments/${process.env.WO_ENVIRONMENT_ID}/agents/${process.env.WO_AGENT_ID}/chat`;

  const body = {
    input: {
      text: messageContent,
    },
    context: {},
  };

  const resp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  // Extract the agent's reply text
  return resp.data.output?.text
    ?? resp.data.output?.generic?.[0]?.text
    ?? resp.data.agent_response
    ?? '';
}

module.exports = { callProductSearchAgent };
```

### 7.3 `/agentSearch` endpoint (full flow)

```javascript
// backend/routes/agentSearch.js  (mounted as POST /agentSearch)
const { callProductSearchAgent } = require('../services/agentSearch');
const { embedAndQuery }          = require('../services/vectorSearch'); // existing ChromaDB helper

router.post('/agentSearch', async (req, res) => {
  const { query } = req.body; // { query: "dog entertainment for trips" }
  if (!query) return res.status(400).json({ error: 'query is required' });

  // 1. Vector search — top 4 products
  const products = await embedAndQuery(query, 4);

  // 2. Call the watsonx Orchestrate agent
  const agent_response = await callProductSearchAgent(query, products);

  // 3. Return agent reply + product array
  res.json({ agent_response, products });
});
```

### 7.4 Response shape

```json
{
  "agent_response": "These four products collectively support ...",
  "products": [
    {
      "product_id": "...",
      "name": "...",
      "category": "...",
      "description": "...",
      "price": 0.00,
      "image_url": "..."
    }
  ]
}
```

### 7.5 Request / response field summary

| Field | Direction | Type | Notes |
|---|---|---|---|
| `query` | request body | `string` | User's natural-language search |
| `agent_response` | response | `string` | 2–3 sentence agent reply |
| `products` | response | `Product[]` | Top-4 ChromaDB matches with full metadata |

---

## 8. Test Questions

Use these questions to validate the agent returns contextual insight (not just product name lists). Test via CLI (`orchestrate agents chat`) and via the deployed `/agentSearch` endpoint.

| # | Question | What to verify |
|---|---|---|
| 1 | *"What products do you recommend for entertaining my dog during a trip?"* | Reply should mention travel context, engagement, or portability — not just restate product names |
| 2 | *"What healthcare products are available for young adults?"* | Reply should contextualise why products suit younger adults (lifestyle, activity level, etc.) |
| 3 | *"Are there special communication devices for people with hearing loss?"* | Reply should describe how the products assist communication or address hearing impairment specifically |

For each question confirm:
- The `/agentSearch` response HTTP status is `200`
- `agent_response` is a non-empty string of 2–3 sentences
- `products` array contains exactly 4 items with `name`, `category`, `description`, `price`, `image_url`
- The UI renders the agent reply in the "Product Assistant" chat bubble, followed by 4 product cards with **ADD TO CART** buttons

---

## 9. Documentation Location

Place all agent documentation under `agent/docs/`. Max 3–4 pages per file.

| File | Contents |
|---|---|
| `agent/docs/setup.md` | Prerequisites, ADK install, creating the `ibm_cloud` environment |
| `agent/docs/deployment.md` | Deploy, list, chat-test, update, and retrieve agent/environment IDs |
| `agent/docs/api-integration.md` | IAM token exchange, REST call format, response parsing, `.env` variables |

---

## 10. `.gitignore` Additions

Ensure these entries exist in `.gitignore`:

```
# watsonx Orchestrate ADK
.orchestrate/
agent/.orchestrate/
```
