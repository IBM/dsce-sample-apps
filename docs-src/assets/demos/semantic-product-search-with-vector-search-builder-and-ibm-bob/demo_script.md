# Semantic Product Search — Seller Demo Script (5 minutes)

## 1. Problem (0:00–0:30)
**Key message:** Shoppers search in their own words, but keyword search only matches literal product names — meaning-based search closes that gap.

- Introduce Fictional Online Store as the example.
- Explain: a search for "red sneakers" misses the product "Red Running Shoes" with keyword search.

## 2. Search screen (0:30–1:30)
**Key message:** Meaning-based search finds what shoppers intend, not just what they typed.

- Search **"red sneakers"**: the three red shoes rank first by meaning. Point at the similarity bars.
- Click **"beginner camera"** and show the entry-level camera ranked first.

## 3. IBM Bob (1:30–3:00)
**Key message:** Each new feature is added with a short natural-language instruction — IBM Bob changes the code while you review and approve.

- Show **Vector Search Builder** mode in IBM Bob.
- Give the image instruction and approve the commands Bob asks to run.
- If it changed the schema, reinsert the sample data, restart the app and reload: images appear.
- Mention the price filter and recommendation reasons are added the same way.

## 4. How it runs (3:00–4:00)
**Key message:** No API key required — the embedding model runs locally, so any participant can try this in about 60 minutes.

- Explain: the instructor hosts Milvus; participants need IBM Bob, the participant zip, and the connection details.
- The local embedding model (paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions) generates vectors with no external API call.
- The hands-on runs in about 60 minutes, in English or Japanese.

## 5. Where next (4:00–5:00)
**Key message:** The same pattern applies to enterprise document search, customer support, and any domain where titles use different words. For production, use IBM's managed services.

- The same pattern fits enterprise document search (where titles use different words) and customer support (similar past questions).
- For production: use **watsonx.ai** for embeddings and **watsonx.data** for Milvus.
- The full kit is on GitHub.
