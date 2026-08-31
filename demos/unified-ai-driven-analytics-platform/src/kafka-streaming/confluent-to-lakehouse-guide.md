# Guide: Insert Order Data from Confluent to Lakehouse

This guide shows how to produce order data to Confluent Kafka topics that can then be consumed and loaded into your watsonx.data lakehouse (Iceberg tables).

## 🎯 Architecture Flow

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Producer      │─────▶│  Kafka Topics   │─────▶│  Kafka Connect  │
│  (Your App)     │      │  (Confluent)    │      │   Sink          │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                            │
                                                            ▼
                                                   ┌─────────────────┐
                                                   │  watsonx.data   │
                                                   │  Iceberg Tables │
                                                   └─────────────────┘
```

## 📋 Prerequisites

1. **Download Kafka CA Certificate** (required for SSL):
   ```bash
   scp -i cflt-vsi-key.pem root@YOUR_KAFKA_HOST:/var/lib/confluent-access/kafka-ca.crt ./kafka-ca.crt
   ```

2. **Install Required Tools**:
   ```bash
   # Python Kafka client
   pip install confluent-kafka

   # OR use kcat (kafkacat)
   brew install kcat  # macOS
   # apt-get install kafkacat  # Linux
   ```

## 🚀 Method 1: Python Producer (Recommended)

### Step 1: Create Python Producer Script

Save this as `produce_orders_to_kafka.py`:

```python
#!/usr/bin/env python3
"""
Produce order data to Confluent Kafka topics.
Data format matches the demo_data.py structure for lakehouse compatibility.
"""

from confluent_kafka import Producer
from confluent_kafka.serialization import StringSerializer, SerializationContext, MessageField
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import json
from datetime import datetime, timezone, timedelta
import sys

# Kafka Configuration
KAFKA_CONFIG = {
    'bootstrap.servers': 'YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096',
    'security.protocol': 'SASL_SSL',
    'sasl.mechanism': 'PLAIN',
    'sasl.username': 'kafka-admin',
    'sasl.password': 'YOUR_SASL_PASSWORD',
    'ssl.ca.location': './kafka-ca.crt',
    'client.id': 'order-producer'
}

# Schema Registry Configuration
SCHEMA_REGISTRY_CONFIG = {
    'url': 'https://YOUR_KAFKA_HOST/sr/',
    'basic.auth.user.info': 'YOUR_USERNAME:YOUR_PASSWORD'
}

# AVRO Schema for Orders (matches your data model)
ORDER_SCHEMA = """
{
  "type": "record",
  "name": "Order",
  "namespace": "com.demo.orders",
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "customer_id", "type": "string"},
    {"name": "order_ts", "type": "string"},
    {"name": "promised_delivery_ts", "type": "string"},
    {"name": "status", "type": "string"},
    {"name": "warehouse_id", "type": "string"},
    {"name": "total_amount", "type": "double"}
  ]
}
"""

ORDER_ITEMS_SCHEMA = """
{
  "type": "record",
  "name": "OrderItem",
  "namespace": "com.demo.orders",
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "sku", "type": "string"},
    {"name": "qty", "type": "int"},
    {"name": "unit_price", "type": "double"}
  ]
}
"""

def delivery_report(err, msg):
    """Callback for message delivery reports."""
    if err is not None:
        print(f'❌ Message delivery failed: {err}')
    else:
        print(f'✅ Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}')

def create_sample_order(order_id="O-10500"):
    """Create a sample order matching the demo data structure."""
    now = datetime.now(timezone.utc)
    
    order = {
        "order_id": order_id,
        "customer_id": "C-9001",  # PLATINUM customer from demo
        "order_ts": now.isoformat(),
        "promised_delivery_ts": (now + timedelta(days=2)).isoformat(),
        "status": "PENDING",
        "warehouse_id": "WH-BER",  # Berlin warehouse
        "total_amount": 1500.00
    }
    
    order_items = [
        {
            "order_id": order_id,
            "sku": "SKU-100",
            "qty": 2,
            "unit_price": 500.00
        },
        {
            "order_id": order_id,
            "sku": "SKU-881",
            "qty": 1,
            "unit_price": 500.00
        }
    ]
    
    return order, order_items

def produce_with_avro():
    """Produce orders using AVRO serialization with Schema Registry."""
    
    # Initialize Schema Registry client
    schema_registry_client = SchemaRegistryClient(SCHEMA_REGISTRY_CONFIG)
    
    # Create AVRO serializers
    order_serializer = AvroSerializer(
        schema_registry_client,
        ORDER_SCHEMA,
        lambda obj, ctx: obj  # Pass dict directly
    )
    
    item_serializer = AvroSerializer(
        schema_registry_client,
        ORDER_ITEMS_SCHEMA,
        lambda obj, ctx: obj
    )
    
    # Create producer
    producer = Producer(KAFKA_CONFIG)
    
    # Create sample data
    order, order_items = create_sample_order("O-10500")
    
    print(f"\n📤 Producing order: {order['order_id']}")
    
    # Produce order
    try:
        producer.produce(
            topic='orders',
            key=order['order_id'],
            value=order_serializer(order, SerializationContext('orders', MessageField.VALUE)),
            on_delivery=delivery_report
        )
        
        # Produce order items
        for item in order_items:
            producer.produce(
                topic='order_items',
                key=item['order_id'],
                value=item_serializer(item, SerializationContext('order_items', MessageField.VALUE)),
                on_delivery=delivery_report
            )
        
        # Wait for messages to be delivered
        producer.flush()
        print("\n✅ All messages sent successfully!")
        
    except Exception as e:
        print(f"❌ Error producing messages: {e}")
        sys.exit(1)

def produce_with_json():
    """Produce orders using JSON serialization (simpler, no Schema Registry)."""
    
    producer = Producer(KAFKA_CONFIG)
    
    # Create sample data
    order, order_items = create_sample_order("O-10501")
    
    print(f"\n📤 Producing order (JSON): {order['order_id']}")
    
    try:
        # Produce order
        producer.produce(
            topic='orders_json',
            key=order['order_id'],
            value=json.dumps(order),
            on_delivery=delivery_report
        )
        
        # Produce order items
        for item in order_items:
            producer.produce(
                topic='order_items_json',
                key=item['order_id'],
                value=json.dumps(item),
                on_delivery=delivery_report
            )
        
        producer.flush()
        print("\n✅ All JSON messages sent successfully!")
        
    except Exception as e:
        print(f"❌ Error producing messages: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Confluent Kafka Order Producer")
    print("=" * 60)
    
    # Choose serialization method
    print("\nSelect serialization method:")
    print("1. AVRO (with Schema Registry) - Recommended for production")
    print("2. JSON (simple) - Good for testing")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        produce_with_avro()
    elif choice == "2":
        produce_with_json()
    else:
        print("Invalid choice. Exiting.")
        sys.exit(1)
```

### Step 2: Run the Producer

```bash
# Make executable
chmod +x produce_orders_to_kafka.py

# Run it
python3 produce_orders_to_kafka.py
```

## 🔧 Method 2: Using kcat (Command Line)

### Produce JSON Messages

```bash
# Create order message
echo '{"order_id":"O-10502","customer_id":"C-9001","order_ts":"2026-02-15T12:00:00Z","promised_delivery_ts":"2026-02-17T12:00:00Z","status":"PENDING","warehouse_id":"WH-BER","total_amount":1500.00}' | \
kcat -P \
-b YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096 \
-X security.protocol=SASL_SSL \
-X sasl.mechanism=PLAIN \
-X sasl.username=kafka-admin \
-X sasl.password=YOUR_SASL_PASSWORD \
-X ssl.ca.location=./kafka-ca.crt \
-t orders_json \
-K:

# Create order item message
echo '{"order_id":"O-10502","sku":"SKU-100","qty":2,"unit_price":500.00}' | \
kcat -P \
-b YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096 \
-X security.protocol=SASL_SSL \
-X sasl.mechanism=PLAIN \
-X sasl.username=kafka-admin \
-X sasl.password=YOUR_SASL_PASSWORD \
-X ssl.ca.location=./kafka-ca.crt \
-t order_items_json \
-K:
```

## 📊 Method 3: Using Datagen Connector (Pre-installed)

### Generate Sample Order Data

```bash
# SSH into the VM
ssh -i cflt-vsi-key.pem root@YOUR_KAFKA_HOST

# Deploy datagen connector for orders
bash /opt/confluent-installer/scripts/deploy-datagen-connector.sh orders

# This creates an 'orders' topic with sample data (~1 record/sec)
```

### Available Datagen Schemas

```bash
# List all available schemas
ssh -i cflt-vsi-key.pem root@YOUR_KAFKA_HOST \
'bash /opt/confluent-installer/scripts/deploy-datagen-connector.sh list'

# Common schemas:
# - orders
# - users
# - clickstream
# - pageviews
# - stock_trades
# - transactions
```

## 🔗 Step 4: Create Kafka Connect Sink to Lakehouse

### Option A: Iceberg Sink Connector

Create a connector configuration file `iceberg-sink-orders.json`:

```json
{
  "name": "iceberg-sink-orders",
  "config": {
    "connector.class": "io.tabular.iceberg.connect.IcebergSinkConnector",
    "tasks.max": "2",
    "topics": "orders,order_items",
    "iceberg.catalog.type": "rest",
    "iceberg.catalog.uri": "https://your-wxd-instance.cloud.ibm.com:8443",
    "iceberg.catalog.credential": "your-credentials",
    "iceberg.tables": "icebergdefault.demo_data.orders,icebergdefault.demo_data.order_items",
    "iceberg.tables.auto-create-enabled": "true",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "io.confluent.connect.avro.AvroConverter",
    "value.converter.schema.registry.url": "https://YOUR_KAFKA_HOST/sr/",
    "value.converter.basic.auth.credentials.source": "USER_INFO",
    "value.converter.basic.auth.user.info": "YOUR_USERNAME:YOUR_PASSWORD"
  }
}
```

Deploy the connector:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -u YOUR_USERNAME:YOUR_PASSWORD \
  https://YOUR_KAFKA_HOST/connect/connectors \
  -d @iceberg-sink-orders.json
```

### Option B: Flink SQL Consumer (Real-time Processing)

```bash
# Open Flink SQL shell
confluent logout
confluent flink shell \
--url https://YOUR_USERNAME:YOUR_PASSWORD@YOUR_KAFKA_HOST \
--environment flink-env \
--compute-pool flink-compute-pool \
--catalog flink-catalog \
--database flink-database
```

In Flink SQL:

```sql
-- View available Kafka topics as tables
SHOW TABLES;

-- Query orders in real-time
SELECT * FROM orders LIMIT 10;

-- Create a continuous query to process orders
CREATE TABLE processed_orders AS
SELECT 
    order_id,
    customer_id,
    warehouse_id,
    total_amount,
    status,
    CURRENT_TIMESTAMP as processed_ts
FROM orders
WHERE status = 'PENDING';

-- Insert into Iceberg table (if configured)
INSERT INTO iceberg_catalog.demo_data.orders
SELECT * FROM orders;
```

## 🔍 Verify Data Flow

### 1. Check Kafka Topics

```bash
# List topics
kcat -L \
-b YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096 \
-X security.protocol=SASL_SSL \
-X sasl.mechanism=PLAIN \
-X sasl.username=kafka-admin \
-X sasl.password=YOUR_SASL_PASSWORD \
-X ssl.ca.location=./kafka-ca.crt

# Consume latest messages
kcat -C \
-b YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096 \
-X security.protocol=SASL_SSL \
-X sasl.mechanism=PLAIN \
-X sasl.username=kafka-admin \
-X sasl.password=YOUR_SASL_PASSWORD \
-X ssl.ca.location=./kafka-ca.crt \
-t orders_json -o end -c 5
```

### 2. Check Schema Registry

```bash
# List registered schemas
curl -sk -u YOUR_USERNAME:YOUR_PASSWORD \
https://YOUR_KAFKA_HOST/sr/subjects

# Get schema for orders
curl -sk -u YOUR_USERNAME:YOUR_PASSWORD \
https://YOUR_KAFKA_HOST/sr/subjects/orders-value/versions/latest
```

### 3. Check Kafka Connect

```bash
# List connectors
curl -sk -u YOUR_USERNAME:YOUR_PASSWORD \
https://YOUR_KAFKA_HOST/connect/connectors

# Check connector status
curl -sk -u YOUR_USERNAME:YOUR_PASSWORD \
https://YOUR_KAFKA_HOST/connect/connectors/iceberg-sink-orders/status
```

### 4. Query Lakehouse (watsonx.data)

```sql
-- Check if data arrived in Iceberg
SELECT COUNT(*) FROM icebergdefault.demo_data.orders;

-- View recent orders
SELECT * FROM icebergdefault.demo_data.orders 
ORDER BY order_ts DESC 
LIMIT 10;
```

## 📝 Complete Example Workflow

```bash
# 1. Download CA cert
scp -i cflt-vsi-key.pem root@YOUR_KAFKA_HOST:/var/lib/confluent-access/kafka-ca.crt ./

# 2. Install Python dependencies
pip install confluent-kafka

# 3. Create and run producer
python3 produce_orders_to_kafka.py

# 4. Verify in Kafka
kcat -C -b YOUR_KAFKA_HOST:9094 \
-X security.protocol=SASL_SSL \
-X sasl.mechanism=PLAIN \
-X sasl.username=kafka-admin \
-X sasl.password=YOUR_SASL_PASSWORD \
-X ssl.ca.location=./kafka-ca.crt \
-t orders_json -o end -c 1

# 5. Query in watsonx.data
# (Use Query Workspace or MCP server)
```

## 🎯 Data Model Alignment

Your Confluent messages should match the lakehouse schema:

### Orders Table
```json
{
  "order_id": "O-10500",
  "customer_id": "C-9001",
  "order_ts": "2026-02-15T12:00:00Z",
  "promised_delivery_ts": "2026-02-17T12:00:00Z",
  "status": "PENDING",
  "warehouse_id": "WH-BER",
  "total_amount": 1500.00
}
```

### Order Items Table
```json
{
  "order_id": "O-10500",
  "sku": "SKU-100",
  "qty": 2,
  "unit_price": 500.00
}
```

## 🚨 Troubleshooting

### SSL Certificate Issues
```bash
# Verify cert exists
ls -la kafka-ca.crt

# Test connection
openssl s_client -connect YOUR_KAFKA_HOST:9094 -CAfile kafka-ca.crt
```

### Authentication Issues
```bash
# Verify credentials in KAFKA_CONFIG match your environment
# Username: kafka-admin
# Password: YOUR_SASL_PASSWORD
```

### Topic Not Found
```bash
# Create topic manually
kafka-topics --create \
--bootstrap-server YOUR_KAFKA_HOST:9094 \
--command-config kafka.properties \
--topic orders_json \
--partitions 3 \
--replication-factor 3
```

## 📚 Next Steps

1. **Set up monitoring** in Control Center (https://YOUR_KAFKA_HOST/)
2. **Configure Kafka Connect sink** to automatically load data to Iceberg
3. **Create Flink SQL jobs** for real-time processing
4. **Test the complete flow** with the demo order O-10452

## 🔗 Related Documentation

- [Confluent Environment Details](CONFLUENT_ENVIRONMENT.md)
- [Data Model](DATA_MODEL.md)
- [Demo Setup](README.md)