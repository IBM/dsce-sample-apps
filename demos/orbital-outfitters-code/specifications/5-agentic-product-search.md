# Specification: Agentic Product Chat
The following specification outlines the steps required to build an agentic chat interface that provides interactive product searching.

## Prerequisites

Load the following skills plus any others that seem relevant — new ones may be added over time:
- `agent-builder` — building and deploying agents and tools via the ADK
- `agent-multi-orchestration` — Build multi-agent systems with watsonx Orchestrate
- `agent-integrate` — integrating the deployed agent into the backend `/search` endpoint via REST API

## Agentic Product Search
Build an interactive agentic search that looks like @specifications/frontend/design-mockups/agentic-search/agentic_search.png. Users reach this screen by starting  their search from the home page.

This page allow user to engage in multi-turn research into available products by speaking back-and-forth with an AI agent hosted in watsonx Orchestrate.  Users can continue research by typing additional questions into the text field at bottom plus click the refresh button to clear the existing search and start a new one.

### Requirements
The following guidelines must be followed when building the backend API endpoints:
- Place all your agent files under @agent/
- Use your skill tool to load skills about building and deploying agents to watsonx Orchestrate.  Be sure to read any supplemental skill's files for additional deeper details as needed.

## Step 1: Use watsonx Orchestrate Agent Developers Kit (ADK)
Deploy and test your agents using the [watsonx Orchestrate ADK](https://developer.watson-orchestrate.ibm.com).
1. Use the Skill tool to read the watsonx Orchestrate ADK skill.
2. Pip install the ADK into a python virtual environment: @venv/.
3. Create an ADK environment called "ibm_cloud" using WO_INSTANCE_URL and WO_API_KEY provided in [.env](.env).

## Step 2: Implement agentic search
The user's search results will display in an agentic chat web page.  Design a `product_search` agent then deploy to watsonX Orchestrate (wxo).  Refer to the design comps in @specifications/frontend/design-mockups/agentic-search/ for exactly how the agent response should look.

The backend server will provide an `/search` endpoint that:
1. Accepts the user's product query from the UI
2. Queries the vector database to retrieve the top 4 products matching this query
3. Sends the user query plus these products to the `product_search` agent in Orchestrate. 
4. The `/search` endpoint will then return the agents natural language response plus the 4 matching products.
5. The frontend UI should package the agent's response plus product results into HTML for presentation in the Agent's word bubble as in @specifications/frontend/design-mockups/agentic-search/agentic_search.png.

The `product_search` agent hosted in Orchestrate should:
1. Accept both the user's query plus products search results
2. Review the products in the context of the user's search and consider. 
3. Return an interesting but succinct reply that summarizes the products results in 2-3 natural language sentences that does not simply restate the product names or description.
  * NOTE: Do not create any tools for the agent.   

## Step 3: QA agentic search
Test these questions using the agentic search solution. The agent should reply with answers unique to the input question and detailed about why these products are a good fit:
1. What products do you recommend for entertaining my dog during the at trip?
2. What healthcare products are available for young adults?
3. Are their special communication devices for people with hearing loss?

The `/search` endpoint could get stubbed out due to concurrency overlaps between front/backend.  Ensure the `/search` endpoints call the agent and that the products plus natural language response are properly displayed in the UI.

## Step 4: Cleanup
- Update [.env](.env) with the agent environment and agent IDs to make updating easier between dev, staging and production.
- Write documentation but keep it super simple and non-verbose.
    - Max of 3-4 pages per .md file.  Place these into @agent/docs/.
    - Update the swagger files
- Ensure that the .gitignore contains all files that should not be checked into the repo.

