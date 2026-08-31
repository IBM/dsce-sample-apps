# Automate Retail Inventory Management with Agentic AI

## Table of Contents

- [Retail Agentic AI](#automate-reatil-inventory-management-with-agentic-ai)
  - [Table of Contents](#table-of-contents)
  - [Use case description](#use-case-description)
  - [Architecture](#architecture)
  - [Implementation](#implementation)
    - [Pre-requisites](#pre-requisites)
    - [Open Agent Builder](#open-agent-builder)
    - [PropensityAgent](#propensity-agent)
      - [Create the PropensityAgent](#create-the-propensity-agent)
      - [Test the Propensity Agent](#test-the-propensity-agent)
    - [Forecast Agent](#forecast-agent)
      - [Create the Forecast Agent](#create-the-forecast-agent)
      - [Test the Forecast Agent](#test-the-forecast-agent)
    - [AskRetail Agent](#ask-retail)
      - [Create the AskRetail Agent](#create-the-ask-retail)
      - [Test the AskRetail Agent](#test-the-ask-retail)
    - [Further testing via AI Chat](#further-testing-via-ai-chat)

## Use case description

AI-Driven Inventory Management Agents automate and optimize the entire inventory workflow, integrating seamlessly with existing systems and ensuring real-time, unified data flow. Specialized AI agents collaborate to forecast demand, manage stock replenishment, and detect anomalies, proactively generating recommendations to prevent stockouts and overstocking. Managers retain control through approval workflows and override capabilities, balancing automation with human judgment. The result is enhanced operational efficiency, reduced stockouts, and a better customer experience.
## Architecture

![Architecture](image.png)

This architecture illustrates how **Watsonx Orchestrate** manages an **AI-driven retail inventory workflow** through a supervisory agent called **AskRetail**.

## Orchestrate Layer

- **AskRetail Supervisory Agent**  
  Acts as the central coordinator, managing the execution flow of specialized agents.

- **Functional Agents**  
  - **Propensity Agent** → Analyzes customer behavior and buying likelihood.  
  - **Forecasting Agent** → Predicts future demand using historical and real-time data.  
  - **Reordering Agent** → Triggers stock replenishment through smart ordering optimization.  
  - **Reporting Agent** → Generates insights, dashboards, and summaries for managers.  

## Code Engine Layer

Provides the backend compute and ML services to support the Orchestrate agents.

- **DB** → Central storage for retail and inventory data.  
- **Predict / Train / Forecast** → ML pipelines for model training, demand forecasting, and prediction.  
- **Reorder Agent** → Applies optimization logic to generate purchase orders.  
- **Reporting Agent** → Compiles reports and KPIs.  


## How It Works

The Orchestrate supervisory agent (**AskRetail**) interacts with the specialized agents in sequence or in parallel, invoking the underlying **Code Engine services** as needed.  

This design balances automation with analytics, enabling retailers to:  
- Forecast demand  
- Optimize replenishment  
- Predict customer propensity  
- Detect anomalies  
- Report results efficiently  


✅ **Result:** Enhanced operational efficiency, reduced stockouts/overstocking, and a better customer experience.


## Learning Objective

By the end of this lab, you will be able to design and implement an AI-driven Inventory Management workflow using Watsonx Orchestrate. You will learn step by step how to set up specialized AI agents that collaborate to:
- Forecast demand using historical and real-time data.
- Trigger stock replenishment through smart ordering optimization for timely and cost-effective restocking.
- Cluster SKUs to identify fast movers, seasonal items, and slow movers for smarter stocking strategies.
- Cluster customers to uncover behavioral segments that influence inventory priorities.
- Predict out-of-stock (OOS) risks and proactively adjust inventory plans.
- Incorporate customer propensity scores to align stocking decisions with buying likelihood.


## Implementation

### Pre-requisites

- Check with your instructor to ensure **all systems** are up and running before you continue.
- Validate that you have access to the right TechZone environment for this lab.
- Validate that you have access to a credentials file that your instructor will share with you before starting the labs.
- If you're an instructor running this lab, check the Instructor's guides to set up all environments and systems.
- Make sure that your instructor has provided the following:
  - **OpenAPI Specs**
  - **Some new customers to test the flow, and pretrained models for propensity agent**

### Open Agent Builder

- Log in to IBM Cloud (cloud.ibm.com). Navigate to top left hamburger menu, then to Resource List. 
<img width="1000" alt="image" src="./assets/2.png">


- Open the AI/Machine Learning section. You should see a **watsonx Orchestrate** service, click to open.

  <img width="1000" alt="image" src="./assets/1.1.png">

- Click the "Launch watsonx Orchestrate" button.

  <img width="1000" alt="image" src="./assets/3.png">

- Welcome to watsonx Orchestrate. Open the hamburger menu, click on **Build** -> **Agent Builder**.

  <img width="1000" alt="image" src="./assets/5.png">

### Propensity Agent
#### Create the Propensity Agent

- Click on **Create Agent**

  <img width="1000" alt="image" src="./assets/6.png">

- Follow the steps according to the screenshot below.
  - Select **Create from scratch**
  - Name the agent `PropensityAgent`
  - Use the following description:
    ```
    The PropensityAgent will return propensity values for a customer and sku, you can also train the model or predict for new values.
    ```
  - Click **Create** 
  <img width="1000" alt="image" src="./assets/7.png">

- Choose the `model` On the `PropensityAgent` page and choose `llama-3-405b-instruct` , take the defaults for **Profile** and **Knowledge** sections.

  <img width="1000" alt="image" src="./assets/8.png">

- Choose Agent Style. Keep it as `default`. Keep Voice Modality as `No voice configuration`.
  <img width="1000" alt="image" src="./assets/9.png">


- Under the **Toolset** section, click on the **Add tool** button to upload the OpenAPI Spec
  <img width="1000" alt="image" src="./assets/10.png">

- Click on **Add from file or MCP server**.

  <img width="1000" alt="image" src="./assets/11.png">

- Click on **Import from file**
<img width="1000" alt="image" src="./assets/12.png">

- Upload the `open_api_spec_train.json` OpenAPI Spec which will be provided by the instructor.

  <img width="1000" alt="image" src="./assets/13.png">
  <img width="1000" alt="image" src="./assets/14.png">

- Once the file is uploaded, select **Next**.

  <img width="1000" alt="image" src="./assets/15.png">

- Select the all of the **Operations** and click **Done**

  <img width="1000" alt="image" src="./assets/16.png">

- Go to the **Behavior** section. Add the following for **Instructions**. This will define how the Agent should behave and what it should expect:
  ```
  You are an agent that does training and prediction for propensity score. 
  When a user suggests that they don't trust the result, use the "Train embedding models" tool to train the model asychronously, it is possible that the request may timeout , so just tell the user, it is training the model. 
  When asked to get predctions for "Get propensity predictions" for all the data, show only the top 10 values in tabular format
  When either customer id or  sku id is mentioned, show the details in a nice tabular format, summarize the explanation columns.
  ```
  <img width="1000" alt="image" src="./assets/17.png">

- Keep the channels setting as it is.
  <img width="1000" alt="image" src="./assets/18.png">

- Click on **Deploy** to deploy the agent
  <img width="1000" alt="image" src="./assets/19.png">

#### Test the Propensity Agent

  Type this query:
  ```
    Get cluster info for customer id C0001
  ```
  <img width="1000" alt="image" src="./assets/propensity_test.png">

### Forecast Agent
#### Create the Forecast Agent

- Click on hamburger menu, then **Build** -> **Agent Builder**

  <img width="1000" alt="image" src="./assets/5.png">

- On the next screen, click on **Create Agent**
  <img width="1000" alt="image" src="./assets/6.png">

- Follow the steps according the screenshot below
  - Select **Create from scratch**
  - Name the agent `ForecastAgent`
  - Use the following description:
    ```
    You are a demand forecasting and out of stock predicting agent. Your task is on prompt, show the demad that is forecasted for a 30 day period for a given SKU and store. If no sku or store is given by the user, forecast for all sku and all store, if sku is given and no store is given, forecast for sku for all stores. If store is given and no sku, then forecast for all for the given store. Always show result in tabular format.
    ```
    <img width="1000" alt="image" src="./assets/fa-1.png">
  - Click **Create**

- Choose `Model`. Change the model or keep it as the default one.

<img width="1000" alt="image" src="./assets/fa-2.png">

- Choose Agent Style. Keep it as `default`. Keep Voice Modality as `No voice configuration`.

<img width="1000" alt="image" src="./assets/fa-3.png">


- In the **Toolset** section, click on **Add tool** 

  <img width="1000" alt="image" src="./assets/fa-4.png">

- Click on **Add from file or MCP server**.

  <img width="1000" alt="image" src="./assets/fa-5.png">

- Click on **Import from file**
<img width="1000" alt="image" src="./assets/fa-6.png">

Import the `open_api_chat_forecast.json` OpenAPI Spec file provided by your instructor

  <img width="1000" alt="image" src="./assets/fa-7.png">

- Select **Next**

  <img width="1000" alt="image" src="./assets/fa-8.png">
- Select all of the **Operations** and click **Done**
  <img width="1000" alt="image" src="./assets/fa-9.png">

- In the **Behavior** section, add the following prompt to the **Instructions**:

  ```
   📌 Agent Instructions: Demand Forecasting & Out-of-Stock Prediction

    ## Role  
    You are a **demand forecasting and out-of-stock prediction agent**.  

    ---

    ## Goal  
    Provide **forecasted demand values for a 30-day period** based on the SKU(s) and store(s) mentioned in the user's request, if not mentioned, assume it's for all stores and sku

    ---

    ## Behavior & Rules  

    ### Input Handling  
    - If **no SKU and no store** are provided → forecast demand for **all SKUs across all stores**.  
    - If **only SKU(s)** is provided → forecast demand for the given SKU(s) across **all stores**.  
    - If **only store(s)** is provided → forecast demand for **all SKUs in that store(s)**.  
    - If **both SKU(s) and store(s)** are provided → forecast demand for the **given SKU(s) in the specified store(s)**.  

    ### Tool Usage  
    Use the tool named **`forecast`** to retrieve forecast values.  
    Always pass the following parameters:  
    - `start_date`: today's date (or user-specified start date).  
    - `sku_ids`: list of SKU IDs (if applicable).  
    - `store_ids`: list of Store IDs (if applicable).  

    ---

    ## Output Expectations  

    ### 1. Out-of-Stock (OOS) Table  
    Present OOS probabilities neatly in **percentages**, and include **Current Stock** and **OOS Days** (the number of days before stock is depleted).  
    Just show the skus that are going out of stock in 15 days. 
    | SKU_ID | Store_ID | Current Stock | Total Forecast (30 Days) | OOS Probability (%) | OOS Days |  Reorder amount
    |--------|----------|---------------|--------------------------|---------------------|----------| ------------|
    | SKU123 | StoreA   | 2,800         | 3,450                    | 72%                 | 24       |  2000

    Use your knowledge to point out the skus that need immediate reordering, depending on the number of days it was forecasted for, keep in mind while giving out the details the current stock and other details as well.
    Highlight the sku's that have to be ordered today itself and calculate the quantity for reorder using the current stock and demand forecast, values should always be an integer , show it in the same table .Only show skus that are going out of stock for next 7 days always. 
    Always show only the top 5 SKUS that need ordering immediately with the reorder amount in a tabular format
  ```
  <img width="1000" alt="image" src="./assets/fa-10.png">

- No need to change `Channels` settings. Click on **Deploy** to deploy the agent.

  <img width="1000" alt="image" src="./assets/fa-11.png">
  
#### Test the Forecast Agent
  
  Step 1. Enter a basic query:
   ```
    Get the items that are going out of stock
   ```

   <img width="1000" alt="image" src="./assets/forecast_test.png">


### Ask Retail
#### Create the Ask Retail

- Click on hamburger menu, then **Build** -> **Agent Builder**.

  <img width="1000" alt="image" src="./assets/5.png">

- Click on **Create Agent**

  <img width="1000" alt="image" src="./assets/6.png">

- Follow the steps according the screenshot below.
  - Select **Create from scratch**
  - Name the agent `AskRetail`
  - Use the following description:

    ```
        You are the Supervisor Agent. Your job is to route user queries to the correct specialized agent.
        There are some primary rules that you need to follow, always follow these rules to the dot, route to the necessay agent only.
        If the following inputs are given, either matching exactly or semantically are similar, route to the exact agent that it needs to be routed to.

        Show me the different types of customer clusters that are available? -> Route -> Reporting Agent
        which are the customers whose cluster info is unavailable in a table format? ->Route -> Reporting Agent
        Predict the clusters for the customers in the table above-> Route-> PropensityAgent
        what are the most bought items along with their names, category and total quantiy sold from customers that belong to cluster info as Premium Shoppers? -> Route -> Reporting Agent
        what other items along with their names and details are bought together with the The AquaStride Insulated Water Bottle for All-Weather Adventures? -> Route -> Reporting Agent
        which are the products that are going out of stock faster than expected? -> Route -> ForecastAgent
        I have a budget of $5000, i would like to stock up my seasonal items, can you generate a purchase order recommendation -> Route -> Reorder Agent
        what are my options for strategies? -> Route -> Reorder Agent
        can you show me the settings of peak season prep strategy in tabular format? -> Route -> Reorder Agent
        can you change the delivery_speed of the peak season prep strategy to 10 -> Route -> Reorder Agent
        can you remove the SKU0008 from the list and update SKU0072 order quantity to 50 -> Route -> Reorder Agent
        Okay, this looks good, can you submit the purchase order-> Route -> Reorder Agent



        Available agents :
        1. Reordering Agent
        Core Function: Manages the end-to-end Reordering Workflow. This agent handles all tasks related to planning, creating, modifying, and submitting a purchase order. It is also capable of viewing, editing, inferring and creating new settings and strategies. It is the active, task-oriented agent. NOTE: You are not allowed to submit the purchase order without seeking user approval!

        Handles:
        Generating purchase order recommendations and drafts.
        It is also capable of inferring the best strategy to pick based for the draft po recommendations based on the user description.
        Viewing and modifying the strategies and settings used for reordering recommendations.
        Editing the contents of a draft purchase order (adding/removing/updating SKUs).
        Submitting the finalized draft.
        Making direct data updates to product attributes (max capacity, reorder threshold) when it's part of the reordering thought process.

        Examples:
        "Can you generate a purchase order for me? Budget is $1400."
        "what are the settings for Peak Season Prep?"
        "Okay, for 'Peak Season Prep', change the 'profit' priority to 5."
        "Great, now generate a recommendation with the Peak Season Prep strategy."
        "Okay, let's make some changes. Please update the quantity for SKU0027 to 20 units. Also, remove SKU0067 from the order."
        "Update the max capacity of SKU0020 to 150."
        "Okay, can you submit the purchase order."

        2. Reporting Agent
        Core Function: Provides Business Intelligence and Analysis. This agent is the analytical expert. It answers questions by querying and synthesizing data from across the entire business, including inventory, sales, customers, and suppliers. It provides insights but does not execute the reordering workflow.
        IMPORTANT: YOU PASS THE QUESTION DIRECTLY, DO NOT MAKE AN SQL QUERY YOURSELF AS THE SUPERVISOR AGENT, JUST DELEGATE THE QUESTION TO THE REPORTING AGENT

        Handles:
        Answering questions about inventory status.
        Performing complex, cross-table queries to find insights.
        Reporting on sales, product performance, and categories.
        Analyzing customer and supplier data.

        Examples:
        "Can I see all inventory under the reorder threshold in a table?"
        "What are the supplier details of SKUs with the longest lead times of items with the highest sales?"
        "I want to get the quantity of items sold based on the product category, sorted in descending order."
        "Can you show me details of the top 5 customers with the highest return rate?"
        "Who is our top customer by sales volume?"
        "Show me the top 5 most sold SKUs along with the SKU name."
        "What is the supplier name I most buy from?"
        "What is the gender distribution among our customers?"

        3.Forecasting Agent
        Core Function:
        Provides demand forecasting and out-of-stock prediction. This agent specializes in projecting future demand for SKUs across stores and estimating the risk of stockouts. It uses forecasting models to generate 30-day demand predictions, summarize totals, and highlight potential inventory risks. It does not perform business intelligence queries or reordering operations.
        IMPORTANT : CALL THE AGENT JUST ONCE

        Handles:
        Forecasting demand for all SKUs across all stores (default).
        Forecasting demand for a specific SKU across all stores.
        Forecasting demand for all SKUs in a given store.
        Forecasting demand for specific SKU(s) in specific store(s).
        Summarizing total demand over 30 days for SKUs and stores.
        Calculating out-of-stock probability (%).
        Identifying OOS Days (days before inventory depletion).
        Reporting results in structured tabular formats (and charts, if supported).

        Examples:
        "Show me the 30-day forecast for all SKUs across all stores."
        "Forecast demand for SKU123 for the next 30 days."
        "What is the demand forecast for all SKUs in StoreA?"
        "Give me the forecasted demand for SKU456 in StoreB for the next 30 days."
        "Summarize the 30-day demand forecast for all SKUs along with out-of-stock probability."
        "Which SKUs are most likely to go out of stock in the next 30 days, and when?"
        "Show me the OOS probability and OOS days for the top 5 SKUs with the highest demand."
        "What products have moved faster than predicted?"
        "Which are the items that are going out of stock faster than expected?"
        4.Propensity Agent
        Core Function:
        Provides customer and SKU-level propensity scoring for purchase likelihood. This agent specializes in training models and generating predictions that assign customers to clusters and SKUs to clusters, along with a propensity score indicating the likelihood of purchase. It does not handle pricing, inventory, or forecasting tasks.
        Handles:
        Training propensity models on customer × SKU interaction data.
        Predicting propensity scores for all customers across all SKUs (default).
        Predicting propensity scores for a specific customer across all SKUs.
        Predicting propensity scores for all customers for a specific SKU.
        Generating customer cluster and SKU cluster assignments.
        Summarizing top-N customers most likely to purchase specific SKUs.
        Reporting results in structured tabular formats (and charts, if supported).

        Examples:
        "Train a propensity model on the latest transaction data."
        "Show and update the cluster info for the customers"
        "Show propensity scores for all customers across all SKUs."
        "What are the top 10 SKUs most likely to be purchased by Customer123?"
        "Give me propensity scores for SKU789 across all customers."
        "Cluster customers and SKUs and report the top clusters with high purchase likelihood."
        "Summarize customer cluster assignments along with average propensity scores."
        "Which customers are most likely to buy from SKU Cluster 5?"
    ```

  <img width="1000" alt="image" src="./assets/ar-1.png">

- Select the `model`.

  <img width="1000" alt="image" src="./assets/ar-2.png">

- Select the Agent Style as `Default`. Also no changes needed for Voice Modality. Keep it as No Voice Configuration

  <img width="1000" alt="image" src="./assets/ar-3.png">

- In the **Toolset** section, you have to add two tools (agents)

- Click on **Add tool** 

  <img width="1000" alt="image" src="./assets/ar-4.png">

- Click on **Add from file or MCP server**.

  <img width="1000" alt="image" src="./assets/ar-5.png">

- Click on **Import from file**
<img width="1000" alt="image" src="./assets/ar-6.png">

Import the `open_api_chat_reporting.json` OpenAPI Spec file provided by your instructor

  <img width="1000" alt="image" src="./assets/ar-8.1.png">

- Select **Next**

  <img width="1000" alt="image" src="./assets/ar-8.2.png">

- Select all of the **Operations** and click **Done**
  <img width="1000" alt="image" src="./assets/ar-8.3.png">

- Click on **Add tool** 

  <img width="1000" alt="image" src="./assets/ar-4.png">

- Click on **Add from file or MCP server**.

  <img width="1000" alt="image" src="./assets/ar-5.png">

- Click on **Import from file**
<img width="1000" alt="image" src="./assets/ar-6.png">

Import the `open_api_chat_reorder.json` OpenAPI Spec file provided by your instructor

  <img width="1000" alt="image" src="./assets/ar-9.1.png">

- Select **Next**

  <img width="1000" alt="image" src="./assets/ar-9.2.png">
- Select all of the **Operations** and click **Done**
  <img width="1000" alt="image" src="./assets/ar-9.3.png">

- Click on **Add Agent**

  <img width="1000" alt="image" src="./assets/ar-10.png">

- Click **Add from local instance**

  <img width="1000" alt="image" src="./assets/ar-11.png">

- Select **PropensityAgent** and **ForecastAgent** then the **Add to Agent button**

  <img width="1000" alt="image" src="./assets/ar-12.png">

- In the **Behavior** section, add the following for **Instructions**:
  ```
    You present the output of the agents in a way thats presentable. If there are any json outputs, you are to output it as a markdown table, you are prohibited from not showing the information to the user. if the user is not detailed with their query, ask for clarification with a suggestion. All agents require the log of conversations to be passed as inputs along with the user question
    When forecasting agent returns results, only show top 10 
    Ensure that for Reporting Agent and Reorder Agent , use the following input schema, only for these two agents
    {
      "messages": [{"role": "user", "content": user input}],
      "model": "sql_agent/reorder_agent",
      "stream": "false",
      "thread_id": "1"
    }
    Ensure the input schema for PropensityAgent for the predict tool is as follows ,
    {
    "customer_ids":List[string],
    "sku_ids":List[string],
    "full_data":true/false}
    Do not use it for any other agents or tools
  ```

  <img width="1000" alt="image" src="./assets/ar-14.png">

- Keep the Channels as it is. Click on **Deploy** to deploy the agent

  <img width="1000" alt="image" src="./assets/ar-16.png">

#### Test the Ask Retail 
**Explantory Flow**
  Step 1. 

   ```
    Show me the different types of customer clusters that are available?
   ```

  <img width="1000" alt="image" src="./assets/ar-flow-1.png">

  Step 2.
  ```
    which are the customers whose cluster info is unavailable in a table format?
  ```

  <img width="1000" alt="image" src="./assets/ar-flow-2.png">

  Step 3. 
  ```
    Predict the clusters for the customers in the table above
  ```

  <img width="1000" alt="image" src="./assets/ar-flow-3.png">

  Step 4. 

   ```
    what are the most bought items along with their names, category and total quantiy sold from customers that belong to cluster info as Premium Shoppers? 
   ```

   <img width="1000" alt="image" src="./assets/ar-flow-4.png">

  Step 5. 
  ```
    what other items along with their names and details are bought together with the The AquaStride Insulated Water Bottle for All-Weather Adventures?
  ```
  <img width="1000" alt="image" src="./assets/ar-flow-5.png">

**Reordering Optimization Flow**

Step 1:
  ```
    which are the products that are going out of stock faster than expected?
  ```
<img width="1000" alt="image" src="./assets/ar-flow-6.png">

Step 2 :
  ```
    I have a budget of $5000, i would like to stock up my seasonal items, can you generate a purchase order recommendation
  ```
<img width="1000" alt="image" src="./assets/ar-flow-7.png">

Step 3 :
  ```
    what are my options for strategies?
  ```
<img width="1000" alt="image" src="./assets/ar-flow-8.png">

Step 4 :
  ```
    can you show me the settings of peak season prep strategy in tabular format? 
  ```
<img width="1000" alt="image" src="./assets/ar-flow-9.png">

Step 5 :
  ```
    can you change the delivery_speed of the peak season prep strategy to 10 
  ```
<img width="1000" alt="image" src="./assets/ar-flow-10.png">

Step 6 :
  ```
    can you generate a new purchase order recommendation using the updated peak season prep strategy along with the same $5000 budget
  ```
<img width="1000" alt="image" src="./assets/ar-flow-11.png">

Step 7 :
  ```
    can you remove the SKU0008 from the list and update SKU0072 order quantity to 50
  ```
<img width="1000" alt="image" src="./assets/ar-flow-11.png">

Step 8 :
  ```
    Okay, this looks good, can you submit the purchase order
  ```
<img width="1000" alt="image" src="./assets/ar-flow-12.png">



### Further testing via AI Chat
>
> ***You can also test the agents from AI chat.***

Navigate to AI chat by going to the hamburger menu at top left and select **Chat**.

<img width="1000" alt="image" src="./assets/chat1.png">
<img width="1000" alt="image" src="./assets/chat2.png">

Then select the agent to test: 

<img width="1000" alt="image" src="./assets/chat3.png">

You can use the same same testing flows mentioned above to test on agent chat as well. 
