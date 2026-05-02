import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_names() -> str:
    """
    Returns a JSON array of supplier names with their item types (coffee, tea, beans) from dataset1.
    along with their item_type, deduplicates by supplier_name and item_type combination,
    and returns a JSON array of objects.

    Args:
        None

    Returns:
        str: JSON string array of objects with supplier_name and item_type, or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset1_product_supplier.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)

        # Deduplicate by supplier_name and item_type combination
        seen = set()
        results = []
        for entry in data:
            supplier_name = entry.get("supplier_name")
            item_type = entry.get("item_type")
            if supplier_name and item_type:
                key = (supplier_name, item_type)
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "supplier_name": supplier_name,
                        "item_type": item_type
                    })

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
#     print(get_supplier_names())
