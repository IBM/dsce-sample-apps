import json
import requests
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool
def demo_101_get_brazil_coffee_market_info(query: str) -> str:
    """
    Returns Brazil coffee market intelligence including prices, production volumes, weather impacts, regional data, and export statistics.
    This tool uses an external RAG API (/eval endpoint) to retrieve Brazil coffee market information.

    Args:
        query: The query about Brazil coffee market (e.g., prices, production volumes, weather impacts, regional data, exports).

    Returns:
        str: JSON string containing Brazil coffee market information from the RAG API with fields: question, context, and response.
             Returns error JSON on failure.
    """
    try:
        api_url = "https://assistant-ai-ops-server.23qk5gzlivxl.us-south.codeengine.appdomain.cloud/eval"
        
        headers = {
            "Content-Type": "application/json",
            "X-IBM-THREAD-ID": "my-session-123"
        }
        
        payload = {
            "question": query
        }
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        return json.dumps(response.json(), indent=2)
        
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"API request failed: {str(e)}"}, indent=2)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON response: {str(e)}"}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Unexpected error: {str(e)}"}, indent=2)

