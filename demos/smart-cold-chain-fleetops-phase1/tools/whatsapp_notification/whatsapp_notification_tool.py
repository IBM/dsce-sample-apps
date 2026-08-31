"""
WhatsApp Notification Tool for FleetOps AI Agent Orchestration

This tool sends WhatsApp notifications to drivers after Decision Agent completes analysis.
It calls the FleetOps Forecasting Backend WhatsApp API endpoint.

API Endpoint: POST <FORECAST_API_URL>/api/notifications/whatsapp

Requires the 'forecast_api' key-value connection with key FORECAST_API_URL.
Local emulation:
    export WXO_SECURITY_SCHEMA_forecast_api=key_value_creds
    export WXO_CONNECTION_forecast_api_FORECAST_API_URL=https://<your-host>
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
import requests
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType
from ibm_watsonx_orchestrate.run import connections


class WhatsAppNotificationInput(BaseModel):
    """Input schema for WhatsApp notification"""
    truck_id: str = Field(
        description="Truck identifier (e.g., 'TRUCK-003')"
    )
    decision_output: Dict[str, Any] = Field(
        description="Complete decision agent output JSON with all decision details including decision, urgency, riskScore, selectedFacility, selectedRoute, and recommendation"
    )
    driver_name: Optional[str] = Field(
        default="Operator",
        description="Driver name for personalized message (e.g., 'Loco Pilot', 'Operator', or specific name)"
    )


class WhatsAppNotificationOutput(BaseModel):
    """Output schema for WhatsApp notification"""
    status: str = Field(
        description="Notification delivery status: SUCCESS, FAILED, or ERROR"
    )
    message: str = Field(
        description="Human-readable status message"
    )
    message_sid: Optional[str] = Field(
        default=None,
        description="Twilio message SID (if successful)"
    )
    timestamp: Optional[str] = Field(
        default=None,
        description="ISO8601 timestamp of notification"
    )
    to: Optional[str] = Field(
        default=None,
        description="Recipient phone number"
    )
    error: Optional[str] = Field(
        default=None,
        description="Error details (if failed)"
    )


@tool(expected_credentials=[{'app_id': 'forecast_api', 'type': ConnectionType.KEY_VALUE}])
def send_whatsapp_notification(input_data: WhatsAppNotificationInput) -> WhatsAppNotificationOutput:
    """
    Send WhatsApp notification to driver with decision details.

    This function calls the FleetOps Forecasting Backend WhatsApp API endpoint:
    POST <FORECAST_API_URL>/api/notifications/whatsapp

    The API URL is provided via the 'forecast_api' key-value connection
    (key: FORECAST_API_URL). For local testing, export:
        WXO_SECURITY_SCHEMA_forecast_api=key_value_creds
        WXO_CONNECTION_forecast_api_FORECAST_API_URL=https://<your-host>

    The tool extracts key information from the Decision Agent's comprehensive output
    and formats it into a driver-friendly WhatsApp message.

    Args:
        input_data (WhatsAppNotificationInput): Notification parameters including truck ID,
            complete decision output, and driver name.

    Returns:
        WhatsAppNotificationOutput: Notification status with message SID and timestamp.
    """
    # Resolve API URL from connection — raises clearly if connection is not configured
    try:
        conn = connections.key_value('forecast_api')
        forecast_api_url = conn.FORECAST_API_URL
    except Exception as e:
        raise RuntimeError(
            "The 'forecast_api' key-value connection is not configured. "
            "Set FORECAST_API_URL via: orchestrate connections set-credentials -a forecast_api "
            "--env draft -e 'FORECAST_API_URL=https://<your-host>'"
        ) from e
    if not forecast_api_url:
        raise RuntimeError(
            "FORECAST_API_URL is not set in the 'forecast_api' connection. "
            "Run: orchestrate connections set-credentials -a forecast_api "
            "--env draft -e 'FORECAST_API_URL=https://<your-host>'"
        )

    whatsapp_endpoint = f"{forecast_api_url}/api/notifications/whatsapp"

    try:
        # Extract key information from decision output for WhatsApp message
        # Map Decision Agent's comprehensive output to API format (matching working curl)
        
        # Get selected route and facility
        selected_route = input_data.decision_output.get("selectedRoute", {})
        selected_facility = input_data.decision_output.get("selectedFacility", {})
        recommendation = input_data.decision_output.get("recommendation", {})
        
        # Build decision data matching the working API format
        decision_data = {
            "action": recommendation.get("action", "UNKNOWN"),
            "urgency": input_data.decision_output.get("urgency", "MEDIUM"),
            "selected_facility": {
                "name": selected_facility.get("name", "Unknown Facility")
            },
            "selected_route": {
                "duration_minutes": selected_route.get("duration", 0)  # API expects duration_minutes
            },
            "risk_factors": {
                "temperature": {
                    "value": 0.0  # Default, will be overridden if available
                }
            },
            "risk_score": input_data.decision_output.get("riskScore", 0),
            "reasoning": recommendation.get("reasoning", [])
        }
        
        # Extract temperature from riskFactors if available
        risk_factors = input_data.decision_output.get("riskFactors", [])
        for factor in risk_factors:
            if factor.get("factor") == "temperature":
                # Try to parse temperature value
                temp_value = factor.get("value", "0")
                try:
                    # Remove °C if present and convert to float
                    temp_str = str(temp_value).replace("°C", "").strip()
                    decision_data["risk_factors"]["temperature"]["value"] = float(temp_str)
                except (ValueError, AttributeError):
                    decision_data["risk_factors"]["temperature"]["value"] = 0.0
                break
        
        # Prepare request payload matching the API schema
        request_payload = {
            "truck_id": input_data.truck_id,
            "decision": decision_data,
            "driver_name": input_data.driver_name,
            "phone_number": "+919019608384"  # Add phone number to match working curl
        }
        
        # Call the WhatsApp notification API endpoint
        response = requests.post(
            whatsapp_endpoint,
            json=request_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        # Check if request was successful
        response.raise_for_status()
        
        # Parse the API response
        api_response = response.json()
        
        return WhatsAppNotificationOutput(
            status="SUCCESS",
            message=f"WhatsApp notification sent to {input_data.driver_name}",
            message_sid=api_response.get("message_sid"),
            timestamp=api_response.get("timestamp"),
            to=api_response.get("to")
        )
        
    except requests.exceptions.Timeout:
        return WhatsAppNotificationOutput(
            status="ERROR",
            message="WhatsApp notification request timed out",
            error="Request timeout after 10 seconds"
        )
        
    except requests.exceptions.ConnectionError:
        return WhatsAppNotificationOutput(
            status="ERROR",
            message=f"Cannot connect to forecast backend at {forecast_api_url}",
            error="Connection refused - ensure forecast backend is running"
        )
        
    except requests.exceptions.HTTPError as e:
        return WhatsAppNotificationOutput(
            status="FAILED",
            message=f"Failed to send WhatsApp notification: HTTP {e.response.status_code}",
            error=e.response.text[:200] if e.response else str(e)
        )
        
    except requests.exceptions.RequestException as e:
        return WhatsAppNotificationOutput(
            status="ERROR",
            message=f"Error sending WhatsApp notification: {str(e)}",
            error=str(e)
        )
        
    except Exception as e:
        return WhatsAppNotificationOutput(
            status="ERROR",
            message=f"Unexpected error: {str(e)}",
            error=str(e)
        )