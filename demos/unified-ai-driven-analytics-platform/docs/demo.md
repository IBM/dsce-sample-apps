# Live Demo Script - End-to-End watsonx.data Architecture

**Duration**: 15-20 minutes  
**Audience**: Technical stakeholders, architects, data engineers

---

## 🎯 Demo Objectives

Show how watsonx.data enables:
1. **Unified Query Layer** - Query structured + unstructured data in one place
2. **Real-Time Streaming** - Kafka → Iceberg with <500ms latency
3. **AI-Powered Insights** - Natural language queries via Bob AI
4. **Federated Queries** - Combine SQL + Vector search seamlessly

---

## 📋 Pre-Demo Checklist

### Before You Start
- [ ] Open this project in VSCode with Bob AI extension
- [ ] Have Astra DB console open in browser (show data is loaded)
- [ ] Have 2 terminals ready (one for consumer, one for producer)
- [ ] Open [`PRESENTATION_DECK.md`](PRESENTATION_DECK.md) for reference
- [ ] Ensure MCP server is running (check Bob status bar)

### Quick Verification
```bash
# Verify Kafka consumer is ready
cd confluent/structured-data
ls -la kafka_to_iceberg_consumer.py orders_producer.py

# Verify PDFs exist
ls -la demo/runbooks/pdfs/*.pdf

# Verify MCP server config
cat .bob/mcp.json | grep query-layer
```

---

## 🎬 Demo Flow (5 Parts)

---

## **PART 1: Introduction & Architecture Overview** (3 min)

### What to Say:
> "Today I'll show you a complete data architecture that combines historical data, real-time streaming, and AI-powered insights using watsonx.data, Confluent Kafka, and Astra DB."

### What to Show:

**1. Open Architecture Diagram**
```bash
# Show the high-level architecture
code architecture-high-level.drawio
```

**Key Points to Highlight:**
- **3-Tier Architecture**: Bob AI → MCP Query Layer → Data Sources
- **Structured Data**: Iceberg lakehouse (9 tables, 70 rows)
- **Real-Time**: Confluent Kafka streaming
- **Unstructured**: Astra DB vector store (6 PDF documents)

**2. Show Project Structure**
```bash
# Show clean project structure
tree -L 2 -I '.venv|__pycache__|.git'
```

**Explain:**
- `mcp-servers/query-layer/` - Unified query interface
- `confluent/structured-data/` - Real-time streaming pipeline
- `demo/runbooks/pdfs/` - Unstructured data (runbooks, incidents)

---

## **PART 2: Query Historical Data (Iceberg)** (4 min)

### What to Say:
> "Let's start by querying our historical data in the Iceberg lakehouse. We have operational data, customer analytics, and shipment events all in one place."

### Demo Steps:

**1. Ask Bob About Order O-10452**

**You Say to Bob:**
```
Show me the details of order O-10452
```

**What Bob Will Do:**
- Use `execute_select` tool from MCP server
- Query `postgres.ops.orders` table
- Return order details

**Expected Response:**
```
Order O-10452:
- Customer: C-9001 (Acme Industries)
- Status: DELAYED
- Amount: €1,250
- Warehouse: WH-BER
- Promised Delivery: 2026-02-15 07:00:00
```

**Explain to Audience:**
> "Notice Bob automatically knew which table to query and returned structured results. This is the MCP server's `execute_select` tool in action."

---

**2. Ask About Customer Profile**

**You Say to Bob:**
```
Tell me about customer C-9001
```

**What Bob Will Do:**
- Query `iceberg_data.curated_demo.customer_tier_ltv`
- Query `iceberg_data.curated_demo.customer_region_segment`
- Combine results

**Expected Response:**
```
Customer C-9001 (Acme Industries):
- Tier: PLATINUM
- Lifetime Value: €250,000
- Region: BERLIN
- Segment: ENTERPRISE
- SLA Class: PREMIUM
```

**Explain to Audience:**
> "Bob performed a federated query across multiple Iceberg tables to build a complete customer profile. This is the power of the lakehouse architecture."

---

**3. Show Root Cause Analysis**

**You Say to Bob:**
```
Why is order O-10452 delayed?
```

**What Bob Will Do:**
- Query shipment events
- Check inventory levels
- Identify root cause

**Expected Response:**
```
Order O-10452 is delayed due to:
- SKU-881 stockout at WH-BER (0 units on hand)
- SKU-100 is available (79 units)
- Last shipment event: DELAY_REASON at 2026-02-14

Inventory Check:
- WH-BER: SKU-881 = 0 units ❌
- WH-FRA: SKU-881 = 15 units ✅
- WH-HAM: SKU-881 = 8 units ✅
```

**Explain to Audience:**
> "Bob analyzed shipment events and inventory data to identify the root cause. This demonstrates how the lakehouse enables operational analytics."

---

## **PART 3: Query Unstructured Data (Astra DB)** (3 min)

### What to Say:
> "Now let's see how we handle unstructured data. We have operational runbooks and past incidents stored as PDFs in Astra DB with vector embeddings for semantic search."

### Demo Steps:

**1. Show PDF Documents**
```bash
# Show the PDF files
ls -la demo/runbooks/pdfs/
```

**Explain:**
- 4 runbooks (operational procedures)
- 2 incident reports (historical cases)
- Loaded into Astra DB with 384-dimension embeddings

---

**2. Show Astra DB Console**

**Open Browser:**
- Navigate to Astra DB console
- Show `runbooks` keyspace
- Show `runbooks_table` with data
- Point out the `embedding` column (384 dimensions)

**Explain:**
> "Each PDF was processed: text extracted, embedded using sentence-transformers, and stored with vector embeddings for semantic search."

---

**3. Ask Bob for Runbook Guidance**

**You Say to Bob:**
```
What's our procedure for handling PLATINUM customer delays?
```

**What Bob Will Do:**
- Use `vector_search` tool from MCP server
- Query Astra DB with semantic search
- Return relevant runbooks

**Expected Response:**
```
Per runbook rb-1 (PLATINUM delay handling):
1. Escalate to account manager within 2 hours
2. Proactive outbound call before customer contacts us
3. Apply compensation per policy
4. Log in CRM and set follow-up

Per runbook rb-3 (PREMIUM SLA summary):
- Delay 0-24h: 5% credit
- Delay 24-72h: 10% credit
- Delay 72h+: 20% credit + case-by-case

Past incident inc-2:
- Similar SKU-881 shortage at WH-BER
- Resolved by rerouting from WH-FRA
```

**Explain to Audience:**
> "Bob performed semantic search on our runbooks and found relevant procedures. Notice it cited the source documents (rb-1, rb-3, inc-2) - this is RAG (Retrieval Augmented Generation) in action."

---

## **PART 4: Real-Time Streaming (Confluent Kafka)** (5 min)

### What to Say:
> "Now let's see real-time data in action. We'll stream a new order through Kafka into our Iceberg lakehouse with sub-second latency."

### Demo Steps:

**0. Install Dependencies (if not already done)**

**Terminal 1:**
```bash
# Navigate to the confluent directory
cd /Users/bhargavmankad/Library/CloudStorage/OneDrive-IBM/Work/projects/watsonx.data\ demo\ -\ structure\&unstructured/maximize-value-enterprise-data-main-realtimedata/confluent

# Create a virtual environment (recommended to avoid path issues)
/usr/bin/python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install required packages
pip install "confluent-kafka>=2.3.0"
pip install "python-dotenv>=1.0.0"
pip install presto-python-client
```

**What You'll See:**
```
created virtual environment...
Successfully installed pip-26.0.1
Successfully installed confluent-kafka-2.3.0
Successfully installed python-dotenv-1.0.0
Successfully installed presto-python-client-0.8.4
```

**Explain to Audience:**
> "We're creating a virtual environment to isolate our dependencies. This ensures the Kafka client and Presto connector are properly installed and accessible. We use presto-python-client instead of prestodb for Python 3.9+ compatibility."

**Important:** Keep this terminal with the activated virtual environment for running the consumer!

---

**1. Start Kafka Consumer**

**Terminal 1 (with venv activated):**
```bash
# Navigate to the structured-data directory
cd /Users/bhargavmankad/Library/CloudStorage/OneDrive-IBM/Work/projects/watsonx.data\ demo\ -\ structure\&unstructured/maximize-value-enterprise-data-main-realtimedata/confluent/structured-data

# Start the consumer (venv should still be activated from step 0)
/usr/bin/python3 kafka_to_iceberg_consumer.py
```

**Note:** If you see `(venv)` in your prompt, the virtual environment is active. If not, run `source ../venv/bin/activate` first.

**What You'll See:**
```
🔗 Connecting to Kafka...
✅ Connected to brokers: YOUR_KAFKA_HOST:9094,9095,9096
📊 Subscribed to topics: orders, order_items
🔗 Connecting to watsonx.data Presto...
✅ Connected to Presto
⏳ Waiting for messages...
```

**Explain to Audience:**
> "This consumer is listening to Kafka topics and will write incoming orders directly to Iceberg tables in real-time."

---

**2. Produce a New Order**

**Terminal 2 (new terminal):**
```bash
# Navigate to the confluent directory
cd /Users/bhargavmankad/Library/CloudStorage/OneDrive-IBM/Work/projects/watsonx.data\ demo\ -\ structure\&unstructured/maximize-value-enterprise-data-main-realtimedata/confluent

# Activate the same virtual environment
source venv/bin/activate

# Navigate to structured-data
cd structured-data

# Run the producer
/usr/bin/python3 orders_producer.py
```

**What You'll See:**
```
🔗 Connecting to Kafka...
✅ Connected to brokers
📦 Producing order...

Order Created:
- Order ID: O-12345
- Customer: C-9002
- Warehouse: WH-MUC
- Items: 2
- Total: €850.00

✅ Order sent to Kafka
✅ Order items sent to Kafka
```

**Explain to Audience:**
> "We just produced a new order to Kafka. Watch the consumer terminal..."

---

**3. Watch Consumer Process the Order**

**Terminal 1 (Consumer) Will Show:**
```
📨 Received order: O-12345
   Customer: C-9002
   Warehouse: WH-MUC
   Total: €850.00
✅ Inserted into postgres.ops.orders

📨 Received order item: O-12345 / SKU-100
   Quantity: 1
   Price: €500.00
✅ Inserted into postgres.ops.order_items

📨 Received order item: O-12345 / SKU-200
   Quantity: 2
   Price: €175.00
✅ Inserted into postgres.ops.order_items

⏱️  Total latency: 347ms
```

**Explain to Audience:**
> "The order was processed in under 500 milliseconds! It's now in our Iceberg lakehouse and immediately queryable."

---

**4. Query the New Order via Bob**

**You Say to Bob:**
```
Show me orders from the last 5 minutes
```

**What Bob Will Do:**
- Query with time filter
- Return recent orders including the one we just created

**Expected Response:**
```
Recent Orders (last 5 minutes):
1. Order O-12345
   - Customer: C-9002
   - Status: PROCESSING
   - Amount: €850.00
   - Created: 2026-06-16 10:30:15
```

**Explain to Audience:**
> "The order we just streamed through Kafka is now queryable via Bob. This demonstrates the real-time nature of our architecture - from Kafka to Iceberg to query in under a second."

---

## **PART 5: Federated Query (The Grand Finale)** (4 min)

### What to Say:
> "Now for the grand finale - let's ask Bob a complex question that requires combining structured data from Iceberg AND unstructured guidance from our runbooks."

### Demo Steps:

**1. Ask the Ultimate Question**

**You Say to Bob:**
```
Why is order O-10452 delayed, and what should we do about it according to our runbooks?
```

**What Bob Will Do:**
1. Query Iceberg for order details, shipment events, inventory
2. Query Astra DB for relevant runbooks
3. Combine both results into a comprehensive answer

**Expected Response:**
```
ROOT CAUSE ANALYSIS:
Order O-10452 is delayed due to SKU-881 stockout at WH-BER.

ORDER DETAILS:
- Customer: C-9001 (PLATINUM tier, €250K LTV)
- Amount: €1,250
- Promised Delivery: 2026-02-15 07:00:00
- Current Delay: 48 hours (24-72h band)

INVENTORY STATUS:
- WH-BER: 0 units (stockout) ❌
- WH-FRA: 15 units available ✅
- WH-HAM: 8 units available ✅

RECOMMENDED ACTIONS (from runbooks):
1. Escalate to account manager within 2 hours (rb-1)
2. Proactive customer call (PLATINUM SLA - rb-1)
3. Apply 10% credit (€125) for 24-72h delay (rb-3)
4. Reroute from WH-FRA (15 units available - rb-4)
5. Reference past incident inc-2 (similar case resolved)

REVENUE AT RISK:
- Order value: €1,250
- Customer LTV: €250,000
- Recommended action: Immediate reroute + compensation
```

**Explain to Audience:**
> "This is the power of federated queries! Bob combined:
> - SQL queries on Iceberg (order, customer, inventory)
> - Vector search on Astra DB (runbooks, incidents)
> - Business logic (delay calculation, compensation policy)
> 
> All in a single natural language query. This is what we mean by 'Maximize the Value of Enterprise Data' - bringing structured and unstructured data together for actionable insights."

---

**2. Show the MCP Server in Action**

**Open VSCode:**
- Show `.bob/mcp.json` configuration
- Explain the `query-layer` MCP server
- Show the 7 tools available

**Explain:**
> "Behind the scenes, Bob is using our MCP server which provides:
> - `execute_select` for SQL queries
> - `vector_search` for semantic search
> - Other tools for data exploration
> 
> This single server handles both structured and unstructured data, enabling seamless federated queries."

---

## 🎤 Closing Remarks (1 min)

### What to Say:
> "Let me summarize what we've demonstrated today:
> 
> **1. Unified Data Platform**
> - Historical data in Iceberg lakehouse
> - Real-time streaming via Confluent Kafka
> - Unstructured data in Astra DB
> 
> **2. Sub-Second Performance**
> - Real-time ingestion: <500ms
> - Query latency: <1s
> - Federated queries: <2s
> 
> **3. AI-Powered Insights**
> - Natural language queries via Bob AI
> - Semantic search over runbooks
> - Automated root cause analysis
> 
> **4. Production-Ready Architecture**
> - Scalable (Kafka, Iceberg, Astra DB)
> - Reliable (ACID transactions, replication)
> - Flexible (schema evolution, federated queries)
> 
> This is how modern data architectures should work - unified, real-time, and AI-powered."

---

## 📊 Key Metrics to Highlight

| Metric | Value | Significance |
|--------|-------|--------------|
| **End-to-end latency** | <500ms | Real-time operational analytics |
| **Query response time** | <1s | Interactive user experience |
| **Data sources** | 3 types | Structured + Real-time + Unstructured |
| **Tables** | 9 | Comprehensive data model |
| **Documents** | 6 PDFs | Operational knowledge base |
| **Tools** | 7 | Complete query capabilities |

---

## 🎯 Demo Success Criteria

You've successfully completed the demo if you've shown:
- [x] Historical data queries (Iceberg)
- [x] Unstructured data search (Astra DB)
- [x] Real-time streaming (Kafka → Iceberg)
- [x] Federated queries (SQL + Vector search)
- [x] Natural language interface (Bob AI)
- [x] Sub-second performance
- [x] Production-ready architecture

---

## 🔧 Troubleshooting

### If Kafka Consumer Fails
```bash
# Check Kafka connectivity
ping YOUR_KAFKA_HOST

# Verify certificates
ls -la confluent/kafka-ca.crt confluent/cflt-vsi-key.pem

# Check credentials in code
grep -A 5 "KAFKA_CONFIG" confluent/structured-data/kafka_to_iceberg_consumer.py
```

### If Bob Can't Query
```bash
# Check MCP server status
cat .bob/mcp.json

# Verify environment variables
cat mcp-servers/query-layer/.env | grep -E "PRESTO|ASTRA"

# Test Presto connection
python3 -c "from presto import dbapi; conn = dbapi.connect(host='...'); print('OK')"
```

### If Vector Search Fails
- Check Astra DB console - verify data is loaded
- Verify `ASTRA_TOKEN` and `ASTRA_API_ENDPOINT` in `.env`
- Check MCP server logs for errors

---

## 📚 Additional Resources

- **Architecture**: [`END_TO_END_ARCHITECTURE.md`](END_TO_END_ARCHITECTURE.md)
- **Demo Questions**: [`DEMO_STEPS.md`](DEMO_STEPS.md)
- **Presentation**: [`PRESENTATION_DECK.md`](PRESENTATION_DECK.md)
- **Kafka Setup**: [`confluent/README.md`](confluent/README.md)
- **MCP Server**: [`mcp-servers/query-layer/README.md`](mcp-servers/query-layer/README.md)

---

## 🎬 Post-Demo Q&A Preparation

### Common Questions & Answers

**Q: How does this scale?**
A: Each component scales independently:
- Kafka: Add brokers
- Iceberg: Petabyte-scale data lakes
- Astra DB: Serverless auto-scaling
- MCP Server: Stateless, can run multiple instances

**Q: What about data governance?**
A: Built-in:
- Iceberg: ACID transactions, time travel
- Astra DB: Role-based access control
- MCP Server: Tool-level permissions
- Audit logs at every layer

**Q: Can we add more data sources?**
A: Yes! The MCP server is extensible:
- Add new tools for new data sources
- Federated queries work across any source
- Bob AI adapts automatically

**Q: What's the TCO compared to traditional architecture?**
A: Significant savings:
- No ETL pipelines (direct queries)
- Reduced data duplication
- Serverless components (pay per use)
- Faster time to insights (hours → minutes)

---

**Good luck with your demo! 🚀**