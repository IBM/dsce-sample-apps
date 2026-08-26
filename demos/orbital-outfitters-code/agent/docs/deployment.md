# Deployment Guide — product_search Agent

## Prerequisites

- ADK installed and `ibm_cloud` environment activated (see `setup.md`)
- `agent/product_search.yaml` present
- `WO_API_KEY` exported in shell or present in `.env`

---

## 1. Deploy the agent (first time)

```bash
source venv/bin/activate
venv/bin/orchestrate env activate ibm_cloud --api-key "$WO_API_KEY"
venv/bin/orchestrate agents create --file agent/product_search.yaml
```

Or use the helper script:

```bash
chmod +x agent/deploy.sh
./agent/deploy.sh
```

---

## 2. Verify deployment

List agents and confirm `product_search` appears:

```bash
venv/bin/orchestrate agents list
```

Expected row:
```
product_search   <AGENT_ID>   ibm/granite-3-8b-instruct   active
```

---

## 3. Chat-test from the CLI

```bash
venv/bin/orchestrate agents chat --agent product_search
```

Paste a test message such as:
```
User query: What products do you recommend for entertaining my dog during a trip?

Matching products:
Product 1: Space Rover Pet Toy (Toys) — Interactive robotic toy designed for long car journeys.
Product 2: Astro Chew Treat Dispenser (Pet Accessories) — Slow-release treat ball that keeps pets busy for hours.
Product 3: Galaxy Calming Collar (Pet Health) — Pheromone collar that reduces travel anxiety in dogs.
Product 4: Nebula Travel Mat (Pet Accessories) — Compact, foldable pet mat for comfortable travel resting.
```

The agent should respond with 2–3 sentences of contextual insight, **not** a list of product names.

---

## 4. Retrieve IDs and update `.env`

### Agent ID

From `orchestrate agents list`, copy the agent's ID column and set:

```bash
echo "WO_AGENT_ID=<agent_id>" >> .env
```

### Environment ID

```bash
venv/bin/orchestrate env list
```

Copy the `id` value for `ibm_cloud` and set:

```bash
echo "WO_ENVIRONMENT_ID=<environment_id>" >> .env
```

---

## 5. Update an existing deployment

If `product_search.yaml` changes, redeploy with:

```bash
venv/bin/orchestrate agents update --file agent/product_search.yaml
```

Or via the helper script:

```bash
./agent/deploy.sh --update
```

---

## 6. Test questions

| # | Question | What to verify |
|---|---|---|
| 1 | *"What products do you recommend for entertaining my dog during a trip?"* | Mentions travel context, engagement, or portability — not just product names |
| 2 | *"What healthcare products are available for young adults?"* | Contextualises why products suit younger adults |
| 3 | *"Are there special communication devices for people with hearing loss?"* | Describes how products assist communication or address hearing impairment |
