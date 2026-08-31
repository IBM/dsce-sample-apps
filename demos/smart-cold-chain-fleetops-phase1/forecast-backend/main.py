#!/usr/bin/env python3
"""
FleetOps Forecasting Backend - FastAPI Application
Provides TTM-based forecasting endpoints for cold-chain management
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Dict, Optional
from datetime import datetime
from models.responses import (
    HealthResponse,
    TemperatureForecastResponse,
    StationForecastResponse,
    WeatherForecastResponse,
    FleetOptimizationResponse
)
from services.forecasting_service import FleetOpsForecastingService
from services.whatsapp_service import get_whatsapp_service
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# Configuration from .env
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "5001"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
USE_TTM_MODEL = os.getenv("USE_TTM_MODEL", "False").lower() == "true"

# Initialize FastAPI app
app = FastAPI(
    title="FleetOps Forecasting API",
    description="TTM-based time series forecasting for cold-chain fleet management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize forecasting service
forecasting_service = FleetOpsForecastingService()


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print("🚀 Starting FleetOps Forecasting Backend...")
    print(f"📊 Server: {SERVER_HOST}:{SERVER_PORT}")
    print(f"🔗 CORS Origins: {CORS_ORIGINS}")
    print(f"🔗 FleetOps API: {os.getenv('FLEETOPS_API_BASE_URL')}")
    
    # Initialize TTM model if enabled
    if USE_TTM_MODEL:
        print("🔄 Loading TTM model...")
        forecasting_service.initialize_model()
    else:
        print("⚠️  TTM model disabled - using mock forecasts")
    
    print("✅ Forecasting service ready")


@app.get("/", response_model=Dict)
async def root():
    """Root endpoint"""
    return {
        "service": "FleetOps Forecasting API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="fleetops-forecasting",
        version="1.0.0",
      timestamp=datetime.now().isoformat(),
      ttm_model_enabled=USE_TTM_MODEL
    )


@app.get("/api/forecast/temperature/{truck_id}", response_model=TemperatureForecastResponse)
async def forecast_temperature_breach(
    truck_id: str,
    frequency: Optional[str] = Query(None, description="Time series frequency (e.g., 1min, 5min, 1H). Defaults to .env config")
):
    """
    Predict temperature breaches for a specific truck
    
    - **truck_id**: Truck identifier (e.g., TRUCK-001)
    - **frequency**: Optional time series frequency (defaults to .env FREQUENCY setting)
    
    Returns forecast, risk assessment, and recommendations
    """
    try:
        result = forecasting_service.forecast_temperature_breach(truck_id, frequency=frequency)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return TemperatureForecastResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/station", response_model=StationForecastResponse)
async def forecast_station_availability(
    station_id: Optional[str] = Query(None, description="Specific station ID to forecast"),
    frequency: Optional[str] = Query(None, description="Time series frequency (e.g., 1min, 5min, 1H). Defaults to .env config")
):
    """
    Predict station availability and capacity
    
    - **station_id**: Optional station ID to get forecast for specific station
    - **frequency**: Optional time series frequency (defaults to .env FREQUENCY setting)
    
    Returns forecasts for specific station or top 5 busiest stations
    """
    try:
        result = forecasting_service.forecast_station_availability(station_id=station_id, frequency=frequency)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return StationForecastResponse(**result)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/weather/{truck_id}", response_model=WeatherForecastResponse)
async def forecast_weather_impact(
    truck_id: str,
    frequency: Optional[str] = Query(None, description="Time series frequency (e.g., 1min, 5min, 1h). Defaults to .env config")
):
    """
    Predict weather impact on truck operations
    
    - **truck_id**: Truck identifier (e.g., TRUCK-001)
    - **frequency**: Optional time series frequency (defaults to .env FREQUENCY setting)
    
    Returns weather forecast and impact assessment
    """
    try:
        result = forecasting_service.forecast_weather_impact(truck_id, frequency=frequency)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return WeatherForecastResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/fleet", response_model=FleetOptimizationResponse)
async def forecast_fleet_optimization(
    frequency: Optional[str] = Query(None, description="Time series frequency (e.g., 1min, 5min, 1h). Defaults to .env config")
):
    """
    Optimize fleet operations based on predictions
    
    - **frequency**: Optional time series frequency (defaults to .env FREQUENCY setting)
    
    Returns optimization recommendations for the entire fleet
    """
    try:
        result = forecasting_service.forecast_fleet_optimization(frequency=frequency)
        return FleetOptimizationResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# WhatsApp Notification Models
class WhatsAppNotificationRequest(BaseModel):
    """Request model for WhatsApp notification"""
    truck_id: str
    decision: Dict
    driver_name: Optional[str] = "Demo Driver"
    phone_number: Optional[str] = None


class WhatsAppNotificationResponse(BaseModel):
    """Response model for WhatsApp notification"""
    status: str
    message_sid: Optional[str] = None
    timestamp: str
    truck_id: str
    to: Optional[str] = None
    demo_mode: bool = True
    error: Optional[str] = None


@app.post("/api/notifications/whatsapp", response_model=WhatsAppNotificationResponse)
async def send_whatsapp_notification(request: WhatsAppNotificationRequest):
    """
    Send WhatsApp notification to driver
    
    Simple endpoint for demo - sends all notifications to configured demo phone number
    
    - **truck_id**: Truck identifier
    - **decision**: Decision agent output dictionary
    - **driver_name**: Driver name (mock for demo)
    - **phone_number**: Override demo phone (optional)
    
    Returns notification status and Twilio message SID
    """
    try:
        whatsapp_service = get_whatsapp_service()
        
        result = whatsapp_service.send_notification(
            truck_id=request.truck_id,
            decision=request.decision,
            driver_name=request.driver_name,
            phone_number=request.phone_number
        )
        
        if result['status'] == 'FAILED':
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send WhatsApp: {result.get('error', 'Unknown error')}"
            )
        
        return WhatsAppNotificationResponse(**result)
    
    except ValueError as e:
        # Missing environment variables
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/api/notifications/whatsapp/status/{message_sid}")
async def check_whatsapp_status(message_sid: str):
    """
    Check delivery status of a WhatsApp message
    
    - **message_sid**: Twilio message SID
    
    Returns delivery status (queued, sent, delivered, read, failed)
    """
    try:
        whatsapp_service = get_whatsapp_service()
        result = whatsapp_service.check_delivery_status(message_sid)
        return result
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level=LOG_LEVEL.lower(),
        reload=False
    )

# Made with Bob
