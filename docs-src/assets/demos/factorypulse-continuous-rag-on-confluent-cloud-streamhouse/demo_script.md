# FactoryPulse — Seller Demo Script (8–10 minutes)

## 1. Set the scene (45 s)
**Key message:** "We are not showing Kafka as a message pipe. We are showing a Streamhouse where operational state and enterprise knowledge are continuously updated on the same event backbone."

- Open the **Operations Overview** tab and click **Baseline**.
- Point out: CNC-03 is healthy, production is above target, quality is normal.

## 2. Degradation begins (60 s)
**Key message:** Machine condition, production, and quality indicators are continuously combined in a single view — no single source system owns this answer.

- Click **Degrade**.
- Explain: machine vibration is rising; the current state now combines condition, production, and quality indicators in a single continuously derived view.

## 3. Business exception (60 s)
**Key message:** "No single source system owns this combined answer. The Streamhouse continuously represents what the factory knows right now."

- Click **Critical**.
- Call out on screen: vibration 5.8 mm/s, cycle time increased, defect rate elevated, projected output drops to 870/1000.

## 4. Continuous RAG (2 min)
**Key message:** The answer is grounded in current maintenance SOPs and work-order history, not general model memory.

- Click **Seed knowledge** if not already done.
- Open the **Continuous RAG** tab and ask: *"Why is CNC-03 showing high vibration and what should the technician inspect first?"*
- Show the evidence cards returned with the answer.

## 5. The continuous-learning moment (2 min)
**Key message:** "Traditional RAG answers from what the index knew when it was last refreshed. Continuous RAG answers from what the enterprise knows now."

- Return to **Overview** and click **Resolve + Learn**.
- Explain: this publishes synthetic work-order WO-11023 resolution as a new Kafka event — tool-holder imbalance found and corrected.
- Wait a few seconds, return to **Continuous RAG** and ask: *"What changed after WO-11023 was resolved?"*
- Call out: the resolution is retrievable immediately — no rebuild required.

## 6. Explain the Streamhouse topology (90 s)
**Key message:** Every velocity of factory data — telemetry, documents, events — normalized into one ordered event backbone.

- Open the **Streamhouse** tab and walk through:
  - **Kafka** = durable event backbone
  - **Flink** = two concurrent jobs (operational correlation + continuous chunking/embedding with ML_RECURSIVE_TEXT_SPLITTER and AI_EMBEDDING)
  - **Schema Registry** = data contracts at every topic boundary
  - **Tableflow** = analytical/historical Iceberg path

## 7. Close (30 s)
**Key message:** "The value is not just lower latency. It is closing the gap between a business change, the enterprise's shared understanding of that change, and the action an operator or AI assistant can take."
