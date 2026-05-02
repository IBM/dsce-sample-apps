import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_trade_stats() -> str:
    """
    Returns supplier trade statistics (items_count and trade_volume) from dataset3.

    Reads the supplier performance dataset and returns a JSON string containing
    supplier names with their total items count and trade volumes.

    Args:
        None

    Returns:
        str: JSON string array of objects with supplier_name, items_count, trade_volume
             or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset3_supplier_performance.json')
        with open(dataset_path, 'r') as f:
            dataset3 = json.load(f)

        results = []
        for entry in dataset3:
            results.append({
                "supplier_name": entry["supplier_name"],
                "items_count": entry["items_count"],
                "trade_volume": entry["trade_volume"],
            })

        return json.dumps(results, indent=2)

    except FileNotFoundError:
        return json.dumps({"error": "dataset3 not found at __file__/data/dataset3_supplier_performance.json"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid JSON in dataset3: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"missing field in dataset3: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"unexpected error: {str(e)}"}, indent=2)
