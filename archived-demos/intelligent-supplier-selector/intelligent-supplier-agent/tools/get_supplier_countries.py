import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_countries() -> str:
    """
    Returns a JSON array of unique supplier_name and country pairs from dataset1.

    Reads tools/data/dataset1_product_supplier.json, extracts supplier_name and country,
    deduplicates by supplier_name, and returns a sorted list by supplier_name.

    Args:
        None

    Returns:
        str: JSON string array of objects {"supplier_name", "country"}, or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset1_product_supplier.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)

        supplier_to_country = {}
        for entry in data:
            name = entry["supplier_name"]
            country = entry["country"]
            if name not in supplier_to_country:
                supplier_to_country[name] = country

        results = [
            {"supplier_name": name, "country": country}
            for name, country in sorted(supplier_to_country.items(), key=lambda x: x[0])
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
#     print(get_supplier_countries())
