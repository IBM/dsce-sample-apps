import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_delivery_days() -> str:
    """
    Returns a JSON array of unique supplier_name and delivery_days from dataset1.

    Reads tools/data/dataset1_product_supplier.json, extracts supplier_name and delivery_days
    (days to deliver), deduplicates by supplier_name (first occurrence), and returns
    a sorted list by supplier_name.

    Args:
        None

    Returns:
        str: JSON string array of objects {"supplier_name", "delivery_days"}, or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset1_product_supplier.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)

        supplier_to_delivery = {}
        for entry in data:
            name = entry["supplier_name"]
            delivery_days = entry["delivery_days"]
            if name not in supplier_to_delivery:
                supplier_to_delivery[name] = delivery_days

        results = [
            {"supplier_name": name, "delivery_days": days}
            for name, days in sorted(supplier_to_delivery.items(), key=lambda x: x[0])
        ]

        return json.dumps(results, indent=2)

    except FileNotFoundError:
        return json.dumps({"error": "dataset1_product_supplier.json not found"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid JSON in dataset1: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"missing field in dataset1: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"unexpected error: {str(e)}"}, indent=2)

# Example usage
# if __name__ == "__main__":
#     print(get_supplier_delivery_days())
