# API Integration — watsonx Orchestrate Agent

The backend `/agentSearch` endpoint combines a ChromaDB vector search with a call to the deployed `product_search` agent. The agent returns a 2–3 sentence natural-language response that the frontend renders in a "Product Assistant" chat bubble.

---

## 1. Required `.env` variables

| Variable | Description |
|---|---|
| `WO_INSTANCE_URL` | Base URL of the watsonx Orchestrate instance |
| `WO_API_KEY` | IBM Cloud API key for IAM authentication |
| `WO_AGENT_ID` | Agent ID from `orchestrate agents list` |
| `WO_ENVIRONMENT_ID` | Environment ID from `orchestrate env list` |

---

## 2. IAM token exchange

IBM Cloud API keys must be exchanged for a short-lived bearer token before each API call. Tokens are cached until 60 seconds before expiry.

**File:** `backend/services/woAuth.js`

```javascript
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
  tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = { getIamToken };
```

---

## 3. Calling the agent

**File:** `backend/services/agentSearch.js`

```javascript
const axios = require('axios');
const { getIamToken } = require('./woAuth');

async function callProductSearchAgent(userQuery, products) {
  const token = await getIamToken();

  const productContext = products
    .map((p, i) => `Product ${i + 1}: ${p.name} (${p.category}) — ${p.description}`)
    .join('\n');

  const messageContent =
    `User query: ${userQuery}\n\nMatching products:\n${productContext}`;

  const url = `${process.env.WO_INSTANCE_URL}/v1/environments/${process.env.WO_ENVIRONMENT_ID}/agents/${process.env.WO_AGENT_ID}/chat`;

  const body = {
    input: { text: messageContent },
    context: {},
  };

  const resp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return resp.data.output?.text
    ?? resp.data.output?.generic?.[0]?.text
    ?? resp.data.agent_response
    ?? '';
}

module.exports = { callProductSearchAgent };
```

---

## 4. `/agentSearch` endpoint

**File:** `backend/routes/agentSearch.js` (mounted as `POST /agentSearch`)

```javascript
const { callProductSearchAgent } = require('../services/agentSearch');
const { embedAndQuery }          = require('../services/vectorSearch');

router.post('/agentSearch', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  // 1. Vector search — top 4 products
  const products = await embedAndQuery(query, 4);

  // 2. Call the watsonx Orchestrate agent
  const agent_response = await callProductSearchAgent(query, products);

  // 3. Return agent reply + product array
  res.json({ agent_response, products });
});
```

---

## 5. Response shape

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

---

## 6. REST API endpoint reference

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/environments/{WO_ENVIRONMENT_ID}/agents/{WO_AGENT_ID}/chat` |
| Auth header | `Authorization: Bearer <iam_token>` |
| Request body key | `input.text` — formatted user query + product list |
| Response key | `output.text` or `output.generic[0].text` or `agent_response` |

---

## 7. Field summary

| Field | Direction | Type | Notes |
|---|---|---|---|
| `query` | request body | `string` | User's natural-language search |
| `agent_response` | response | `string` | 2–3 sentence agent reply |
| `products` | response | `Product[]` | Top-4 ChromaDB matches with full metadata |
