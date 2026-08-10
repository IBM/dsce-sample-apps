import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_details() -> str:
    """
    Returns supplier details including supplier name, country, and products (item types) they supply.
    
    This tool provides comprehensive supplier information by reading dataset1_product_supplier.json
    and returning all supplier entries with their associated product types (coffee, tea, or beans) and countries.
    Returns one row per supplier-product combination (e.g., if a supplier provides both coffee and tea,
    they will appear in multiple rows).
    
    Args:
        None
    
    Returns:
        str: JSON string array of objects with supplier_name, country, and product (item_type).
             Returns error JSON on failure.
    
    Example:
        get_supplier_details()
        Returns: [{"supplier_name": "Brazil Premium Coffee Co", "country": "Brazil", "product": "coffee"}, ...]
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset1_product_supplier.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)
        
        results = []
        for entry in data:
            supplier_name = entry.get("supplier_name")
            country = entry.get("country")
            item_type = entry.get("item_type")
            
            if supplier_name and country and item_type:
                results.append({
                    "supplier_name": supplier_name,
                    "country": country,
                    "product": item_type  # Map item_type to "product" for clarity
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

