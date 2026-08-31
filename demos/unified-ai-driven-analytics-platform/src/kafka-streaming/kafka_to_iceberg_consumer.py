#!/usr/bin/env python3
"""
Consume messages from Kafka and insert into watsonx.data Iceberg tables.
This is a simple consumer that reads from Kafka topics and writes to Iceberg via Presto.
"""

from confluent_kafka import Consumer, KafkaError
import json
import sys
import os
import prestodb
from pathlib import Path

# Load environment variables
def _load_dotenv(dotenv_path: str) -> None:
    """Load .env file"""
    path = Path(dotenv_path).expanduser()
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value

# Load watsonx.data credentials
demo_env = Path(__file__).parent.parent.parent / "demo" / "scripts" / ".env"
_load_dotenv(str(demo_env))

def get_presto_connection():
    """Create Presto connection to watsonx.data with IAM auth."""
    # Check if using IAM authentication
    use_iam = os.getenv('USE_IAM_AUTH', 'false').lower() == 'true'
    api_key = os.getenv('IBM_CLOUD_API_KEY', '')
    presto_host = os.getenv('PRESTO_HOST', 'localhost')
    presto_port = int(os.getenv('PRESTO_PORT', '8443'))
    presto_user = os.getenv('PRESTO_USER', 'ibmlhadmin')
    presto_tls = os.getenv('PRESTO_TLS', 'true').lower() == 'true'
    presto_tls_verify = os.getenv('PRESTO_TLS_VERIFY', 'false').lower() == 'true'
    presto_password = os.getenv('PRESTO_PASSWORD', '')
    
    if use_iam and api_key:
        # Use IBM Cloud IAM token for authentication
        import requests
        
        # Get IAM token
        iam_url = 'https://iam.cloud.ibm.com/identity/token'
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
            'apikey': api_key
        }
        
        response = requests.post(iam_url, headers=headers, data=data)
        response.raise_for_status()
        token = response.json()['access_token']
        
        # Create connection with custom headers for Bearer token
        conn = prestodb.dbapi.connect(
            host=presto_host,
            port=presto_port,
            user=presto_user,
            catalog='icebergdefault',
            schema='demo_data',
            http_scheme='https' if presto_tls else 'http',
        )
        
        # Add Bearer token to session headers
        conn._http_session.headers.update({
            'Authorization': f'Bearer {token}'
        })
    else:
        # Use basic authentication
        conn = prestodb.dbapi.connect(
            host=presto_host,
            port=presto_port,
            user=presto_user,
            catalog='icebergdefault',
            schema='demo_data',
            http_scheme='https' if presto_tls else 'http',
            auth=prestodb.auth.BasicAuthentication(presto_user, presto_password) if presto_password else None,
        )
    
    # Handle SSL verification
    if presto_tls and not presto_tls_verify:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        conn._http_session.verify = False
    
    return conn

# Kafka Consumer Configuration
KAFKA_CONFIG = {
    'bootstrap.servers': 'YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096',
    'security.protocol': 'SASL_SSL',
    'sasl.mechanism': 'PLAIN',
    'sasl.username': 'kafka-admin',
    'sasl.password': os.getenv('KAFKA_SASL_PASSWORD', ''),
    'ssl.ca.location': '../kafka-ca.crt',
    'ssl.endpoint.identification.algorithm': 'none',
    'enable.ssl.certificate.verification': False,
    'group.id': 'iceberg-consumer-group',
    'auto.offset.reset': 'earliest',
    'enable.auto.commit': True
}

def insert_order_to_iceberg(cursor, order_data):
    """Insert order into Iceberg table."""
    from datetime import datetime
    
    # Parse ISO timestamps and convert to format Presto expects
    order_ts = datetime.fromisoformat(order_data['order_ts'].replace('Z', '+00:00'))
    promised_ts = datetime.fromisoformat(order_data['promised_delivery_ts'].replace('Z', '+00:00'))
    
    sql = """
    INSERT INTO icebergdefault.demo_data.orders
    (order_id, customer_id, order_ts, promised_delivery_ts, status, warehouse_id, total_amount)
    VALUES (?, ?, CAST(? AS TIMESTAMP), CAST(? AS TIMESTAMP), ?, ?, CAST(? AS DECIMAL(12,2)))
    """
    
    try:
        cursor.execute(sql, (
            order_data['order_id'],
            order_data['customer_id'],
            order_ts.strftime('%Y-%m-%d %H:%M:%S'),
            promised_ts.strftime('%Y-%m-%d %H:%M:%S'),
            order_data['status'],
            order_data['warehouse_id'],
            order_data['total_amount']
        ))
        print(f"✅ Inserted order {order_data['order_id']} into Iceberg")
        return True
    except Exception as e:
        print(f"❌ Error inserting order: {e}")
        return False

def insert_order_item_to_iceberg(cursor, item_data):
    """Insert order item into Iceberg table."""
    sql = """
    INSERT INTO icebergdefault.demo_data.order_items
    (order_id, sku, qty, unit_price)
    VALUES (?, ?, ?, CAST(? AS DECIMAL(12,2)))
    """
    
    try:
        cursor.execute(sql, (
            item_data['order_id'],
            item_data['sku'],
            item_data['qty'],
            item_data['unit_price']
        ))
        print(f"✅ Inserted item {item_data['sku']} for order {item_data['order_id']}")
        return True
    except Exception as e:
        print(f"❌ Error inserting item: {e}")
        return False

def consume_and_load():
    """Consume from Kafka and load into Iceberg."""
    
    print("=" * 60)
    print("Kafka to Iceberg Consumer")
    print("=" * 60)
    print("\nConnecting to watsonx.data...")
    
    # Connect to Presto/watsonx.data
    try:
        conn = get_presto_connection()
        cursor = conn.cursor()
        print("✅ Connected to watsonx.data")
    except Exception as e:
        print(f"❌ Failed to connect to watsonx.data: {e}")
        return 1
    
    # Create Kafka consumer
    consumer = Consumer(KAFKA_CONFIG)
    
    # Subscribe to topics
    topics = ['orders_json', 'order_items_json']
    consumer.subscribe(topics)
    
    print(f"\n📥 Subscribed to topics: {', '.join(topics)}")
    print("Waiting for messages... (Press Ctrl+C to stop)\n")
    
    orders_processed = 0
    items_processed = 0
    
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"❌ Consumer error: {msg.error()}")
                    break
            
            # Process message
            topic = msg.topic()
            
            try:
                value = json.loads(msg.value().decode('utf-8'))
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON from {topic}: {e}")
                continue
            
            # Validate message has required fields
            if not value or not isinstance(value, dict):
                print(f"❌ Invalid message format from {topic}: {value}")
                continue
            
            order_id = value.get('order_id', 'N/A')
            print(f"\n📨 Received from {topic}: {order_id}")
            
            if topic == 'orders_json':
                # Validate required fields for orders
                required_fields = ['order_id', 'customer_id', 'order_ts', 'promised_delivery_ts', 'status', 'warehouse_id', 'total_amount']
                if all(field in value for field in required_fields):
                    if insert_order_to_iceberg(cursor, value):
                        orders_processed += 1
                        conn.commit()
                else:
                    missing = [f for f in required_fields if f not in value]
                    print(f"❌ Missing required fields for order: {missing}")
            
            elif topic == 'order_items_json':
                # Validate required fields for items
                required_fields = ['order_id', 'sku', 'qty', 'unit_price']
                if all(field in value for field in required_fields):
                    if insert_order_item_to_iceberg(cursor, value):
                        items_processed += 1
                        conn.commit()
                else:
                    missing = [f for f in required_fields if f not in value]
                    print(f"❌ Missing required fields for item: {missing}")
            
            print(f"📊 Total: {orders_processed} orders, {items_processed} items")
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopping consumer...")
    
    finally:
        consumer.close()
        cursor.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print(f"Summary:")
        print(f"  Orders processed: {orders_processed}")
        print(f"  Items processed: {items_processed}")
        print("=" * 60)
    
    return 0

if __name__ == "__main__":
    exit(consume_and_load())

# Made with Bob
