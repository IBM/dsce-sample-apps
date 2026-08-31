"""
WhatsApp Notification Service
Simple service to send WhatsApp messages via Twilio for demo purposes
"""

import os
from datetime import datetime
from typing import Dict, Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException


class WhatsAppService:
    """Service for sending WhatsApp notifications via Twilio"""
    
    def __init__(self):
        """Initialize Twilio client with credentials from environment"""
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID', 'xxx')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.from_number = os.getenv('TWILIO_FROM_NUMBER', 'whatsapp:+1415551212')  # Sandbox number
        self.demo_phone = os.getenv('DEMO_PHONE_NUMBER')  # Your mobile number
        
        if not self.auth_token:
            raise ValueError("TWILIO_AUTH_TOKEN environment variable is required")
        
        if not self.demo_phone:
            raise ValueError("DEMO_PHONE_NUMBER environment variable is required")
            
        self.client = Client(self.account_sid, self.auth_token)
        
    def format_decision_message(
        self,
        truck_id: str,
        decision: Dict,
        driver_name: str = "Demo Driver"
    ) -> str:
        """
        Format decision agent output into driver-friendly WhatsApp message
        
        Args:
            truck_id: Truck identifier
            decision: Decision agent output dictionary
            driver_name: Driver name (mock for demo)
            
        Returns:
            Formatted message string
        """
        # Extract key information from decision
        action = decision.get('action', 'UNKNOWN')
        urgency = decision.get('urgency', 'MEDIUM')
        
        # Get destination info
        facility = decision.get('selected_facility', {})
        destination = facility.get('name', 'Unknown destination')
        
        # Get route info
        route = decision.get('selected_route', {})
        eta_minutes = route.get('duration_minutes', 0)
        
        # Get risk factors
        risk_factors = decision.get('risk_factors', {})
        temp_info = risk_factors.get('temperature', {})
        temperature = temp_info.get('value', 'N/A')
        
        # Get risk score
        risk_score = decision.get('risk_score', 0)
        
        # Get reasoning
        reasoning = decision.get('reasoning', [])
        reason = reasoning[0] if reasoning else "See dashboard for details"
        
        # Format urgency emoji
        urgency_emoji = {
            'CRITICAL': '🚨',
            'HIGH': '⚠️',
            'MEDIUM': 'ℹ️',
            'LOW': '✅'
        }.get(urgency, 'ℹ️')
        
        # Build message
        message = f"""{urgency_emoji} FleetOPTX Alert - {truck_id}

Driver: {driver_name}

**{action}**
Urgency: {urgency}

📍 {destination}
⏱️ ETA: {eta_minutes} min

⚠️ Reason: {reason}
🌡️ Temperature: {temperature}°C
📊 Risk: {risk_score}/100

Reply "OK" to acknowledge.

- FleetOPTX Command Center"""
        
        return message
    
    def send_notification(
        self,
        truck_id: str,
        decision: Dict,
        driver_name: str = "Mike Johnes",
        phone_number: Optional[str] = None
    ) -> Dict:
        """
        Send WhatsApp notification
        
        Args:
            truck_id: Truck identifier
            decision: Decision agent output
            driver_name: Driver name (mock for demo)
            phone_number: Override demo phone number (optional)
            
        Returns:
            Dictionary with status, message_sid, timestamp
        """
        try:
            # Use provided phone or default to demo phone
            to_number = phone_number or self.demo_phone
            
            # Ensure E.164 format with whatsapp: prefix
            if not to_number.startswith('whatsapp:'):
                to_number = f'whatsapp:{to_number}'
            
            # Format message
            message_body = self.format_decision_message(truck_id, decision, driver_name)
            
            # Send via Twilio
            message = self.client.messages.create(
                from_=self.from_number,
                to=to_number,
                body=message_body
            )
            
            return {
                'status': 'SENT',
                'message_sid': message.sid,
                'timestamp': datetime.utcnow().isoformat(),
                'truck_id': truck_id,
                'to': to_number,
                'demo_mode': True
            }
            
        except TwilioRestException as e:
            return {
                'status': 'FAILED',
                'error': str(e),
                'error_code': e.code,
                'timestamp': datetime.utcnow().isoformat(),
                'truck_id': truck_id
            }
        except Exception as e:
            return {
                'status': 'FAILED',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat(),
                'truck_id': truck_id
            }
    
    def check_delivery_status(self, message_sid: str) -> Dict:
        """
        Check delivery status of a sent message
        
        Args:
            message_sid: Twilio message SID
            
        Returns:
            Dictionary with delivery status
        """
        try:
            message = self.client.messages(message_sid).fetch()
            
            return {
                'status': message.status,
                'error_code': message.error_code,
                'error_message': message.error_message,
                'date_sent': message.date_sent.isoformat() if message.date_sent else None,
                'date_updated': message.date_updated.isoformat() if message.date_updated else None
            }
        except Exception as e:
            return {
                'status': 'ERROR',
                'error': str(e)
            }


# Singleton instance
_whatsapp_service = None

def get_whatsapp_service() -> WhatsAppService:
    """Get or create WhatsApp service singleton"""
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppService()
    return _whatsapp_service

# Made with Bob
