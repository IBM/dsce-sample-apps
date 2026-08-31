Code perspective:
- Latest code repository with readme steps? like environment variables, testing steps. Do not hard code the project ids, keys, port, external API URLs instead make it as ENV.
- If IBM Watsonx Assistant is used in the app, share the assets as a ZIP file or JSON, custom plugin configuration screenshots, and the OpenAPI JSON file.
- If IBM Watson Discovery is used in the app, share the configuration screenshots.
- If IBM Watsonx.ai is used in the app, share the assets, such as prompts, prompt variables, model parameters.
- Add proper error loggers so we can find solutions if any errors occur.
Demo perspective:
- What is the uniqueness in application? It is a multi-agent setup for smart inventory management using watsonx orchestrate
- Is this proper GenAI app ? Yes, it uses agents to communicate and follow the process
- Provide a architecture diagram as per DSCE format, if possible.
- Provide a demo overview/explainer in text and video.
- Provide test files and ensure test data files are fixed so users can't upload unintended files.
- Any similar use case available in DSCE?
- Give downloadable code, readme file with steps to setup a application.
Product perspective:
- What IBM products are required to run the application?
- What external products are required to run the application?
- Are all products included in the app publicly accessible?
- What is the product pricing, and what sizing is required?
- What AI models is bing used?

DSCE UI tile details
Tile name: Agentic AI for Retail Inventory Management  
Short Description: An AI-powered inventory system that plugs into existing tools, predicts demand, automates replenishment, and prevents stockouts—while keeping humans in control through approvals and overrides for smoother operations and happier customers.
Long Description:
The Agentic AI for Retail Inventory Management coordinates multiple specialized AI agents to create a unified, intelligent inventory workflow. It triggers tasks sequentially or in parallel, calling tools and agents whenever deeper analytics or computation is needed.
These collaborating agents handle core responsibilities:

- forecasting demand from historical and real-time signals,
- optimizing replenishment and generating smart purchase recommendations,
- predicting customer buying propensity,
- clustering SKUs and customers for smarter stocking strategies,
- predicting stock outs 

Together, they transform raw data into meaningful, automated actions. Retail teams stay in control with clear insights, approval steps, and full visibility into AI decisions. The result is faster planning, lower stock-related losses, and a consistently better experience for customers who find what they need—when they need it.
Demo explainer text:
Used model list: meta-llama/llama-3-2-90b-vision-instruct
Prompt List : 
1. RESPONSE_PROMPT_TEMPLATE = os.getenv(
    "SQL_RESPONSE_PROMPT_TEMPLATE",
"""You are a helpful inventory management assistant.
A user asked the following question: "{question}"

The database returned the following information:
{results}

Provide a clear, concise, and friendly natural language response based on the database results.
- If the query was to find data (a SELECT query), summarize the results in a readable format (like a table or list).
- If the query was to update data (an UPDATE query), simply confirm that the action was completed successfully.
- Do not mention SQL, databases, or columns unless the user's question was about them.
- Your entire response must be in English.
"""
)
2. SQL_PROMPT_TEMPLATE = os.getenv(
    "SQL_AGENT_PROMPT_TEMPLATE",
    """You are an expert SQL assistant for an inventory management system.
Given a user's question, you must generate syntactically correct SQL queries for a SQLite database.
Only return the SQL query and nothing else. Do not include ```sql or any explanations.

**Rules for generating the query:**
1.  If a user requests multiple changes (e.g., "update X and remove Y"), you **MUST** generate multiple SQL statements separated by a semicolon (;).
2.  For any request to view, modify, update, or delete from the **current draft purchase order**, you **MUST** query the `draft_purchase_order` table.
3.  For general questions about product information (like stock levels, categories, reorder thresholds), you **MUST** query the `products` table.
4.  For questions asking to "show", "list", "find", "get", or "what is", generate a `SELECT` query.
5.  For questions asking to "update", "change", or "modify", generate an `UPDATE` query.
6.  For questions asking to "remove" or "delete", generate a `DELETE` query.
7.  Pay close attention to the `sku_id` in the user's question for `WHERE` clauses.
8.  Unless the user specifies a number, limit `SELECT` results to {top_k}.
**Database Schema:**
{schema}

**User Question:**
{question}
{additional_context}
**SQL Query:**
"""
)
Used IBM product List: watsonx.ai, watsonx.orchestrate, Code Engine
Architecture diagram in DrawIO format:
Repository link: