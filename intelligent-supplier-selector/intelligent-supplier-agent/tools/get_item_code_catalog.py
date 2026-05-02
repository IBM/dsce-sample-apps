import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_item_code_catalog() -> str:
    """
    Returns item codes and their one-line descriptions from dataset4.

    Reads tools/data/dataset4_item_code.json and returns a JSON string array where each
    item contains item_code and description.

    Args:
        None

    Returns:
        str: JSON string of item code catalog entries, or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset4_item_code.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)

        results = []
        for entry in data:
            results.append({
                "item_code": entry["item_code"],
                "description": entry.get("description", "")
            })

        return json.dumps(results, indent=2)

    except FileNotFoundError:
        return json.dumps({"error": "dataset4_item_code.json not found"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid JSON in dataset4: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"missing field in dataset4: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"unexpected error: {str(e)}"}, indent=2)

# Example usage
# if __name__ == "__main__":
#     print(get_item_code_catalog())
