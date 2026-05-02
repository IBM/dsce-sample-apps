import json
from typing import List, Dict, Any, Union
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_filter_data(data: Union[str, List[Dict[str, Any]]], field: str, operator: str, value: Union[str, int, float]) -> str:
    """
    Filters a JSON array of objects based on field, operator, and value criteria.
    
    Args:
        data: JSON array of objects (as string or list) to filter. Each object should be a dictionary.
        field: The field name to filter on (e.g., "delivery_days", "reliability_score", "risk_level").
        operator: The comparison operator. Valid values:
            - "below" or "less_than": field < value
            - "above" or "greater_than": field > value
            - "equals" or "equal": field == value
            - "not_equals" or "not_equal": field != value
            - "greater_than_or_equal" or "above_or_equal": field >= value
            - "less_than_or_equal" or "below_or_equal": field <= value
            - "contains": field contains value (for strings)
        value: The value to compare against. Can be string, number, etc.
    
    Returns:
        str: JSON string containing filtered array of objects, or error JSON on failure.
    
    Example:
        filter_data([{"supplier_name": "ABC", "delivery_days": 18}], "delivery_days", "below", 20)
        Returns: [{"supplier_name": "ABC", "delivery_days": 18}]
    """
    try:
        # Parse data if it's a string
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                return json.dumps({"error": f"Invalid JSON string in data parameter: {data}"}, indent=2)
        
        # Validate data is a list
        if not isinstance(data, list):
            return json.dumps({"error": "data parameter must be a JSON array (list of objects)"}, indent=2)
        
        # Validate value type for numeric comparisons
        numeric_operators = ["below", "less_than", "above", "greater_than", "greater_than_or_equal", "above_or_equal", "less_than_or_equal", "below_or_equal"]
        if operator.lower() in numeric_operators:
            try:
                if isinstance(value, str):
                    value = float(value) if '.' in value else int(value)
            except (ValueError, TypeError):
                return json.dumps({"error": f"value must be numeric for operator '{operator}'"}, indent=2)
        
        # Filter the data
        filtered_results = []
        operator_lower = operator.lower()
        
        for item in data:
            if not isinstance(item, dict):
                continue
            
            if field not in item:
                continue
            
            field_value = item[field]
            
            # Perform comparison based on operator
            match = False
            if operator_lower in ["below", "less_than"]:
                try:
                    field_val = float(field_value) if isinstance(field_value, str) and '.' in field_value else int(field_value) if isinstance(field_value, str) else field_value
                    match = field_val < value
                except (ValueError, TypeError):
                    continue
            elif operator_lower in ["above", "greater_than"]:
                try:
                    field_val = float(field_value) if isinstance(field_value, str) and '.' in field_value else int(field_value) if isinstance(field_value, str) else field_value
                    match = field_val > value
                except (ValueError, TypeError):
                    continue
            elif operator_lower in ["equals", "equal"]:
                match = field_value == value or str(field_value).lower() == str(value).lower()
            elif operator_lower in ["not_equals", "not_equal"]:
                match = field_value != value and str(field_value).lower() != str(value).lower()
            elif operator_lower in ["greater_than_or_equal", "above_or_equal"]:
                try:
                    field_val = float(field_value) if isinstance(field_value, str) and '.' in field_value else int(field_value) if isinstance(field_value, str) else field_value
                    match = field_val >= value
                except (ValueError, TypeError):
                    continue
            elif operator_lower in ["less_than_or_equal", "below_or_equal"]:
                try:
                    field_val = float(field_value) if isinstance(field_value, str) and '.' in field_value else int(field_value) if isinstance(field_value, str) else field_value
                    match = field_val <= value
                except (ValueError, TypeError):
                    continue
            elif operator_lower == "contains":
                match = str(value).lower() in str(field_value).lower()
            else:
                return json.dumps({"error": f"Invalid operator '{operator}'. Valid operators: below, above, equals, not_equals, greater_than_or_equal, less_than_or_equal, contains"}, indent=2)
            
            if match:
                filtered_results.append(item)
        
        return json.dumps(filtered_results, indent=2)
    
    except Exception as e:
        return json.dumps({"error": f"Error filtering data: {str(e)}"}, indent=2)

