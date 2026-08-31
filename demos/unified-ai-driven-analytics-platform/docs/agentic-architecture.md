# Agentic Architecture for Order Intelligence System

## Overview
This document describes the agentic architecture that powers the intelligent order analysis and decision-making system for the watsonx.data demo.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          AGENTIC SYSTEM ARCHITECTURE                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐          ┌─────────────────────────────────────────────────────┐
│          │          │                                                     │
│    UI    │─────────▶│                    AGENT                            │
│  (Bob)   │          │                                                     │
│          │          │  • Infers user's intent                             │
└──────────┘          │  • Multi-step reasoning and query planning          │
                      │  • Validates responses                              │
                      │  • Refines queries (repeats if needed)              │
                      │                                                     │
                      └─────────────────────────────────────────────────────┘
                                            │
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                      TOOL CALLING & RETRIEVAL                               │
│                                                                             │
│  ┌──────────────┐      ┌──────────────────┐      ┌────────────────────┐   │
│  │              │      │                  │      │                    │   │
│  │    Tools     │      │  Data Sources    │      │  Additional        │   │
│  │              │      │                  │      │  Sources           │   │
│  │  ┌────────┐  │      │  ┌────────────┐  │      │  ┌──────────────┐  │   │
│  │  │ SQL    │  │      │  │ Iceberg    │  │      │  │ Vector DB    │  │   │
│  │  │ Query  │  │      │  │ (Orders)   │  │      │  │ (Runbooks)   │  │   │
│  │  └────────┘  │      │  └────────────┘  │      │  └──────────────┘  │   │
│  │              │      │                  │      │                    │   │
│  │  ┌────────┐  │      │  ┌────────────┐  │      │  ┌──────────────┐  │   │
│  │  │ Vector │  │      │  │ Snowflake  │  │      │  │ Past         │  │   │
│  │  │ Search │  │      │  │ (Customer) │  │      │  │ Incidents    │  │   │
│  │  └────────┘  │      │  └────────────┘  │      │  └──────────────┘  │   │
│  │              │      │                  │      │                    │   │
│  │  ┌────────┐  │      │  ┌────────────┐  │      │  ┌──────────────┐  │   │
│  │  │ List   │  │      │  │ Postgres   │  │      │  │ SLA Policies │  │   │
│  │  │ Tables │  │      │  │ (Metadata) │  │      │  └──────────────┘  │   │
│  │  └────────┘  │      │  └────────────┘  │      │                    │   │
│  │              │      │                  │      │                    │   │
│  └──────────────┘      └──────────────────┘      └────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. User Interface (UI)
- **Bob AI Assistant**: Natural language interface for querying order status, delays, and recommendations
- **Input**: User questions like "Why is order O-10452 delayed?"
- **Output**: Comprehensive analysis with actionable recommendations

### 2. Agent (Core Intelligence)
The agent is the brain of the system that:

#### Intent Inference
- Analyzes user queries to understand what information is needed
- Determines which data sources and tools to use
- Plans the sequence of operations

#### Multi-Step Reasoning
- Breaks down complex questions into sub-queries
- Coordinates multiple tool calls
- Synthesizes information from different sources

#### Query Planning
- Decides optimal query strategy
- Determines when to use SQL vs vector search
- Plans federated queries across multiple data sources

#### Validation & Refinement
- Validates results for completeness
- Refines queries if initial results are insufficient
- Iterates until satisfactory answer is obtained

### 3. Tool Calling & Retrieval Layer

#### Tools
Available operations the agent can perform:

1. **SQL Query Execution**
   - Execute SELECT queries on structured data
   - Join across multiple tables
   - Filter and aggregate data

2. **Vector Search**
   - Semantic search through runbooks and incident reports
   - Retrieve relevant context for decision-making
   - Find similar past cases

3. **List Tables/Schemas**
   - Discover available data sources
   - Understand data structure
   - Navigate catalog hierarchy

#### Data Sources
Structured data repositories:

1. **Iceberg (Orders & Inventory)**
   - `icebergdefault.demo_data.orders`
   - `icebergdefault.demo_data.order_items`
   - `iceberg_data.curated_demo.shipment_events`
   - `iceberg_data.curated_demo.inventory_daily`
   - `iceberg_data.curated_demo.compensation_policy`

2. **Snowflake (Customer Analytics)**
   - `snowflake.ANALYTICS.customer_tier_ltv`
   - `snowflake.ANALYTICS.customer_region_segment`

3. **Postgres (Metadata)**
   - System metadata and configuration

#### Additional Sources
Unstructured and semi-structured data:

1. **Vector Database (Astra DB)**
   - Runbooks (operational procedures)
   - Past incident reports
   - SLA documentation
   - Best practices

2. **Document Types**
   - `rb-1`: PLATINUM delay handling
   - `rb-2`: SKU-881 known issues
   - `rb-3`: PREMIUM SLA summary
   - `rb-4`: Warehouse reroute procedures
   - `inc-1`, `inc-2`: Past incident reports

## Query Flow Example

### User Query: "Why is order O-10452 delayed?"

```
1. Agent receives query
   ↓
2. Infers intent: Need order details, delay reason, and recommendations
   ↓
3. Plans multi-step approach:
   a. Query order details (SQL)
   b. Check inventory status (SQL)
   c. Search runbooks for handling procedures (Vector Search)
   d. Get customer tier for SLA (SQL)
   ↓
4. Executes tools in sequence:
   
   Tool Call 1: execute_select
   Query: SELECT * FROM orders WHERE order_id = 'O-10452'
   Result: Order status = DELAYED, SKU-881 involved
   
   Tool Call 2: execute_select
   Query: Check inventory for SKU-881 at WH-BER
   Result: Stockout situation
   
   Tool Call 3: vector_search
   Query: "SKU-881 stockout handling"
   Result: Runbook rb-2 - reroute from WH-FRA/WH-HAM
   
   Tool Call 4: vector_search
   Query: "PLATINUM delay handling"
   Result: Runbook rb-1 - escalation procedures
   ↓
5. Synthesizes information:
   - Root cause: SKU-881 stockout at WH-BER
   - Customer impact: PLATINUM tier affected
   - Recommended actions: Escalate + reroute + compensate
   ↓
6. Validates completeness and returns answer
```

## Key Features

### 1. Federated Query Capability
- Queries across multiple data sources (Iceberg, Snowflake, Postgres)
- Joins data from structured and unstructured sources
- Single unified view of order status

### 2. Context-Aware Reasoning
- Combines real-time data with historical knowledge
- References past incidents for similar situations
- Applies business rules and SLA policies

### 3. Iterative Refinement
- Agent can make multiple tool calls
- Refines approach based on intermediate results
- Ensures comprehensive answers

### 4. Semantic Understanding
- Vector search for unstructured content
- Finds relevant runbooks and procedures
- Matches user intent to appropriate actions

## Technology Stack

- **Agent Framework**: MCP (Model Context Protocol)
- **LLM**: Claude (Anthropic)
- **Query Engine**: Presto/Trino
- **Data Lake**: Iceberg
- **Data Warehouse**: Snowflake
- **Vector Database**: Astra DB (Cassandra)
- **Embedding Model**: For vector search
- **Interface**: VS Code Extension (Bob)

## Benefits

1. **Natural Language Interface**: Users ask questions in plain English
2. **Intelligent Routing**: Agent automatically determines best data sources
3. **Comprehensive Answers**: Combines multiple data sources for complete picture
4. **Actionable Insights**: Not just data, but recommendations based on runbooks
5. **Learning from History**: References past incidents for better decisions
6. **Real-time Analysis**: Queries live data for current status

## Use Cases

1. **Order Status Inquiry**: "What's the status of order O-10452?"
2. **Delay Analysis**: "Why is this order delayed?"
3. **Inventory Check**: "Do we have SKU-881 in stock?"
4. **Customer Impact**: "Which PLATINUM customers are affected?"
5. **Action Recommendations**: "What should we do about this delay?"
6. **Policy Lookup**: "What's our SLA for PREMIUM customers?"
7. **Historical Context**: "Have we had similar issues before?"

## Future Enhancements

1. **Proactive Monitoring**: Agent detects issues before users ask
2. **Automated Actions**: Execute remediation steps automatically
3. **Predictive Analytics**: Forecast potential delays
4. **Multi-modal Input**: Support images, documents, voice
5. **Continuous Learning**: Improve from user feedback