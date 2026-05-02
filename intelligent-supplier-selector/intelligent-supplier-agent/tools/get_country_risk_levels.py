import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_country_risk_levels() -> str:
    """
    Returns country risk levels and factors from dataset2.

    Reads tools/data/dataset2_country_risk.json and returns a JSON string array where each
    item contains country, risk_level, and risk_factors.

    Args:
        None

    Returns:
        str: JSON string of country risk entries, or an error JSON on failure.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset2_country_risk.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)

        results = []
        for entry in data:
            results.append({
                "country": entry["country"],
                "risk_level": entry["risk_level"],
                "risk_factors": entry.get("risk_factors", []),
            })

        return json.dumps(results, indent=2)

    except FileNotFoundError:
        return json.dumps({"error": "dataset2_country_risk.json not found"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid JSON in dataset2: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"missing field in dataset2: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"unexpected error: {str(e)}"}, indent=2)

# Example usage
# if __name__ == "__main__":
#     print(get_country_risk_levels())
