import { Router } from 'express';
import axios from 'axios';
import { Client } from '@opensearch-project/opensearch';
import { pipeline } from '@xenova/transformers';

const router = Router();
let _opensearchClient = null;
function getOpenSearchClient() {
  if (!_opensearchClient) {
    _opensearchClient = new Client({
      node: `http://${process.env.OPENSEARCH_HOST || 'localhost'}:${process.env.OPENSEARCH_PORT || '9200'}`,
    });
  }
  return _opensearchClient;
}

let embedderPromise;
let iamTokenCache = null;

function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  return embedderPromise;
}

async function getIamToken() {
  if (iamTokenCache && iamTokenCache.expiresAt > Date.now() + 60000) {
    return iamTokenCache.token;
  }

  const response = await axios.post(
    'https://private.iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: process.env.WO_API_KEY,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  const expiresIn = Number(response.data.expires_in ?? 3600) * 1000;
  iamTokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return iamTokenCache.token;
}

function extractAgentText(payload) {
  if (typeof payload?.output === 'string') {
    return payload.output;
  }

  if (typeof payload?.response === 'string') {
    return payload.response;
  }

  if (typeof payload?.message === 'string') {
    return payload.message;
  }

  if (Array.isArray(payload?.messages)) {
    const text = payload.messages
      .map((message) => {
        if (typeof message?.content === 'string') {
          return message.content;
        }

        if (Array.isArray(message?.content)) {
          return message.content
            .map((entry) => (typeof entry?.text === 'string' ? entry.text : ''))
            .join(' ');
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');

    if (text) {
      return text;
    }
  }

  return '';
}

router.post('/', async (req, res) => {
  const { query } = req.body ?? {};

  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    const embed = await getEmbedder();
    const output = await embed(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data);

    const result = await getOpenSearchClient().search({
      index: process.env.OPENSEARCH_INDEX || 'products',
      body: {
        size: 4,
        query: {
          knn: {
            embedding: {
              vector: queryEmbedding,
              k: 4,
            },
          },
        },
      },
    });

    const hits = result.body?.hits?.hits ?? result.hits?.hits ?? [];
    const products = hits.map((hit) => ({
      product_id: hit._source.product_id,
      product_name: hit._source.product_name,
      product_description: hit._source.product_description,
      product_image_url: hit._source.product_image_url,
    }));

    if (products.length === 0) {
      return res.json({ agent_response: 'No products found for your query.', products: [] });
    }

    if (!process.env.WO_AGENT_ID) {
      return res.json({ agent_response: 'Agent not configured', products });
    }

    const iamToken = await getIamToken();
    const agentResponse = await axios.post(
      `${process.env.WO_INSTANCE_URL}/v1/orchestrate/${process.env.WO_AGENT_ID}/chat/completions`,
      {
        stream: false,
        messages: [
          {
            role: 'user',
            content: `Query: ${query}\n\nProducts:\n${JSON.stringify(products)}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${iamToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    let agentText = agentResponse.data?.choices?.[0]?.message?.content
      || extractAgentText(agentResponse.data)
      || 'No agent response available';

    // Strip common LLM preamble (e.g. "Hello! I am watsonx Orchestrate...")
    agentText = agentText
      .replace(/^Hello[^.!?]*[.!?]\s*/i, '')
      .replace(/^I am watsonx Orchestrate[^.!?]*[.!?]\s*/i, '')
      .replace(/^I'm here to help[^.!?]*[.!?]\s*/i, '')
      .trim();

    return res.json({
      agent_response: agentText,
      products,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to perform agent search' });
  }
});

export default router;
