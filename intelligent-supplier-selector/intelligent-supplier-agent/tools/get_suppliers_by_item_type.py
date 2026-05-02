import json
import os
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_supplier_items() -> str:
    """
    Returns all suppliers with the list of items or goods they supply, along with their country.
    
    This tool provides suppliers with their associated product types (items/goods they supply) such as coffee, tea, or beans.
    It helps identify which suppliers provide which types of products, enabling filtering by product type.
    
    Reads tools/data/dataset1_product_supplier.json and returns all suppliers with
    their product type (coffee, tea, or beans) and country.
    Deduplicates by supplier_name (keeps first occurrence).
    
    Args:
        None
    
    Returns:
        str: JSON string array of objects with supplier_name, item_type (the type of item/good the supplier provides), and country.
             Returns error JSON on failure.
    
    Example:
        get_supplier_items()
        Returns: [{"supplier_name": "...", "item_type": "coffee", "country": "Brazil"}, ...]
    """
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dataset_path = os.path.join(data_dir, 'dataset1_product_supplier.json')
        with open(dataset_path, 'r') as f:
            data = json.load(f)
        
        # Deduplicate by supplier_name (keep first occurrence)
        seen_suppliers = {}
        results = []
        for entry in data:
            supplier_name = entry.get("supplier_name")
            if supplier_name and supplier_name not in seen_suppliers:
                seen_suppliers[supplier_name] = True
                results.append({
                    "supplier_name": supplier_name,
                    "item_type": entry.get("item_type"),
                    "country": entry.get("country")
                })
        
        # Sort by supplier_name
        results.sort(key=lambda x: x["supplier_name"])
        
        return json.dumps(results, indent=2)
        
    except FileNotFoundError:
        return json.dumps({"error": "dataset1_product_supplier.json not found"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid JSON in dataset1: {str(e)}"}, indent=2)
    except KeyError as e:
        return json.dumps({"error": f"missing field in dataset1: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"unexpected error: {str(e)}"}, indent=2)

