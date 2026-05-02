import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_risk_data() -> str:
    """
    Retrieves supplier risk data from dataset3 including supplier names and reliability scores.
    This tool reads the supplier performance dataset and extracts risk-related information
    based on reliability scores for supply chain risk assessment.

    Args:
        None

    Returns:
        str: A JSON string containing supplier names and their reliability scores,
             or an error message if the file cannot be read or parsed.
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset3_supplier_performance.json')
        with open(dataset_path, 'r') as f:
            dataset3 = json.load(f)
        
        supplier_risk_data = []
        for entry in dataset3:
            supplier_risk_data.append({
                "supplier_name": entry["supplier_name"],
                "reliability_score": entry["reliability_score"]
            })
        
        return json.dumps(supplier_risk_data, indent=2)
        
    except FileNotFoundError:
        return json.dumps({"error": "dataset3 not found at __file__/data/dataset3_supplier_performance.json"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON in dataset3: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"Missing required field in dataset3: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Unexpected error: {str(e)}"}, indent=2)

if __name__ == "__main__":
    result = get_supplier_risk_data()
    print(result)
