#!/usr/bin/env python3
"""
Simple Orders Producer - Produces ONE order at a time to Kafka
Run this script multiple times to produce multiple orders
"""

import json
import sys
import random
from datetime import datetime, timedelta, timezone
from confluent_kafka import Producer

# Kafka Configuration
KAFKA_CONFIG = {
    'bootstrap.servers': 'YOUR_KAFKA_HOST:9094,YOUR_KAFKA_HOST:9095,YOUR_KAFKA_HOST:9096',
    'security.protocol': 'SASL_SSL',
    'sasl.mechanism': 'PLAIN',
    'sasl.username': 'kafka-admin',
    'sasl.password': os.getenv('KAFKA_SASL_PASSWORD', ''),
    'ssl.endpoint.identification.algorithm': 'none',
    'enable.ssl.certificate.verification': False
}

ORDERS_TOPIC = "orders_json"
ORDER_ITEMS_TOPIC = "order_items_json"

# Sample data
WAREHOUSES = ["WH-BER", "WH-MUC", "WH-HAM", "WH-FRA", "WH-DUS"]
SKUS = ["SKU-100", "SKU-200", "SKU-300", "SKU-400", "SKU-500", "SKU-881"]

def delivery_report(err, msg):
    """Kafka delivery callback"""
    if err is not None:
        print(f'❌ Delivery failed: {err}')
    else:
        print(f'✅ Delivered to {msg.topic()} [partition {msg.partition()}]')

def main():
    """Produce ONE order with items"""
    print("\n" + "="*60)
    print("Simple Orders Producer - ONE Order at a Time")
    print("="*60)
    
    # Generate order ID
    order_id = f"O-{random.randint(10000, 99999)}"
    customer_id = f"C-{random.randint(1000, 9999)}"
    warehouse_id = random.choice(WAREHOUSES)
    
    # Generate order
    order_ts = datetime.now(timezone.utc)
    order = {
        "order_id": order_id,
        "customer_id": customer_id,
        "warehouse_id": warehouse_id,
        "status": "PROCESSING",
        "order_ts": order_ts.isoformat(),
        "promised_delivery_ts": (order_ts + timedelta(days=2)).isoformat(),
        "total_amount": 0.0
    }
    
    # Generate 2 items
    items = []
    for i in range(2):
        sku = random.choice(SKUS)
        qty = random.randint(1, 3)
        unit_price = round(random.uniform(100.0, 500.0), 2)
        items.append({
            "order_id": order_id,
            "sku": sku,
            "qty": qty,
            "unit_price": unit_price
        })
    
    # Calculate total
    total = sum(item["qty"] * item["unit_price"] for item in items)
    order["total_amount"] = round(total, 2)
    
    # Display order
    print(f"\n📦 Order: {order_id}")
    print(f"   Customer: {customer_id}")
    print(f"   Warehouse: {warehouse_id}")
    print(f"   Total: €{order['total_amount']:.2f}")
    print(f"   Items:")
    for item in items:
        print(f"     - {item['sku']} x {item['qty']} @ €{item['unit_price']}")
    
    # Create producer
    producer = Producer(KAFKA_CONFIG)
    
    print(f"\n📤 Producing to Kafka...")
    
    # Produce order
    producer.produce(
        ORDERS_TOPIC,
        key=order['order_id'].encode('utf-8'),
        value=json.dumps(order).encode('utf-8'),
        callback=delivery_report
    )
    
    # Produce items
    for item in items:
        producer.produce(
            ORDER_ITEMS_TOPIC,
            key=order['order_id'].encode('utf-8'),
            value=json.dumps(item).encode('utf-8'),
            callback=delivery_report
        )
    
    # Flush
    producer.flush()
    
    print(f"\n✅ Order {order_id} produced successfully!")
    print(f"\n💡 Query it with Bob:")
    print(f"   'Show me order {order_id}'")
    print(f"   'Show me orders from the last 5 minutes'")
    print(f"\n🔄 Run this script again to produce another order")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

# Made with Bob
