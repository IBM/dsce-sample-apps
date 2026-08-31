"""
Decision Analysis Tool for FleetOps AI Agent Orchestration

This tool provides decision-making logic for the Decision Agent, analyzing
telemetry, cargo, weather, station, and route data to make recommendations.

This is a simulated tool that follows the decision-making logic outlined in
the system architecture.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
from enum import Enum
from ibm_watsonx_orchestrate.agent_builder.tools import tool


class DecisionType(str, Enum):
    """Decision types"""
    EMERGENCY_REROUTE = "EMERGENCY_REROUTE"
    CONTROLLED_REROUTE = "CONTROLLED_REROUTE"
    CONTINUE = "CONTINUE"
    ABORT = "ABORT"


class UrgencyLevel(str, Enum):
    """Urgency levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SeverityLevel(str, Enum):
    """Severity levels for risk factors"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class LocationCoordinates(BaseModel):
    """Geographic coordinates"""
    latitude: float
    longitude: float


class TelemetryData(BaseModel):
    """Current telemetry data"""
    temperature: float = Field(description="Current temperature")
    coolantStatus: str = Field(description="Coolant system status")
    location: LocationCoordinates


class CargoData(BaseModel):
    """Cargo information"""
    value: float = Field(description="Cargo value in currency")
    criticalThreshold: float = Field(description="Critical temperature threshold")
    timeToSpoilage: int = Field(description="Time to spoilage in minutes")


class OriginalPlan(BaseModel):
    """Original trip plan"""
    destination: str
    estimatedArrival: str = Field(description="ISO8601 datetime")


class WeatherSegment(BaseModel):
    """Weather segment information"""
    location: str
    condition: Optional[str] = "UNKNOWN"
    severity: Optional[str] = "LOW"
    estimatedDelay: Optional[int] = 0


class WeatherAnalysis(BaseModel):
    """Weather analysis from Weather Agent"""
    severeWeatherDetected: Optional[bool] = False
    overallWeatherRisk: Optional[int] = 0
    totalDelayMinutes: Optional[int] = 0
    segments: List[WeatherSegment] = Field(default_factory=list)


class FacilityInfo(BaseModel):
    """Facility information from Station Agent"""
    stationId: str
    name: str
    travelTime: Optional[int] = 0
    onPlannedRoute: Optional[bool] = False
    baysAvailable: Optional[int] = 0
    serviceAvailable: Optional[bool] = True
    serviceFee: Optional[float] = None
    serviceType: Optional[str] = None
    serviceDetails: Optional[Dict[str, Any]] = None
    score: Optional[int] = 0
    weatherRisk: Optional[str] = None
    
    def model_post_init(self, __context):
        """Extract serviceType and serviceFee from serviceDetails if present"""
        if self.serviceDetails:
            if self.serviceType is None and 'capabilityType' in self.serviceDetails:
                self.serviceType = self.serviceDetails['capabilityType']
            if self.serviceFee is None and 'serviceFee' in self.serviceDetails:
                self.serviceFee = self.serviceDetails['serviceFee']
            if self.serviceAvailable is None and 'available' in self.serviceDetails:
                self.serviceAvailable = self.serviceDetails['available']


class StationAnalysis(BaseModel):
    """Station analysis from Station Agent"""
    facilities: List[FacilityInfo] = Field(default_factory=list)
    searchStrategyUsed: Optional[str] = "UNKNOWN"


class RouteInfo(BaseModel):
    """Route information from Route Agent"""
    routeId: str
    name: str
    destination: Optional[Dict[str, Any]] = {}
    totalDuration: Optional[int] = 0
    arrivalTime: Optional[str] = ""
    weatherRisk: Optional[str] = "LOW"
    fuelCost: Optional[float] = 0.0
    isAlternateRoute: Optional[bool] = False


class RouteAnalysis(BaseModel):
    """Route analysis from Route Agent"""
    routes: List[RouteInfo] = Field(default_factory=list)


class DecisionInput(BaseModel):
    """Input schema for decision analysis"""
    truckId: str
    incidentId: str
    telemetry: TelemetryData
    cargo: CargoData
    originalPlan: OriginalPlan
    weatherAnalysis: WeatherAnalysis
    stationAnalysis: StationAnalysis
    routeAnalysis: RouteAnalysis


class RiskFactor(BaseModel):
    """Individual risk factor"""
    factor: str
    value: str
    severity: str


class SelectedRoute(BaseModel):
    """Selected route details"""
    routeId: str
    name: str
    destination: Optional[str] = ""
    arrivalTime: Optional[str] = ""
    duration: Optional[int] = 0
    fuelCost: Optional[float] = 0.0
    isAlternateRoute: Optional[bool] = False


class SelectedFacility(BaseModel):
    """Selected facility details"""
    stationId: str
    name: str
    onPlannedRoute: bool
    serviceAvailable: Optional[bool] = True  # Made optional with default
    serviceFee: Optional[float] = None
    serviceType: Optional[str] = None
    serviceDuration: Optional[int] = None


class RejectedOption(BaseModel):
    """Rejected option with reason"""
    type: str  # "route" or "facility"
    routeId: Optional[str] = None
    stationId: Optional[str] = None
    name: str
    reason: str


class Recommendation(BaseModel):
    """Recommendation details"""
    action: str
    reasoning: List[str]
    estimatedArrival: str
    serviceRestored: Optional[str] = None
    serviceType: Optional[str] = None
    safetyBuffer: int


class FinancialBreakdown(BaseModel):
    """Financial cost breakdown"""
    additionalFuel: float
    serviceFee: float


class FinancialAnalysis(BaseModel):
    """Financial analysis"""
    rerouteCost: float
    breakdown: FinancialBreakdown
    cargoValueAtRisk: float
    netSavings: float


class PostRecoveryPlan(BaseModel):
    """Post-recovery plan"""
    serviceRestored: Optional[str] = None
    serviceType: Optional[str] = None
    transferToOriginalDestination: Optional[str] = None
    finalArrivalNewYork: Optional[str] = None
    totalDelayFromOriginal: Optional[int] = None
    cargoCondition: Optional[str] = None


class DecisionOutput(BaseModel):
    """Output schema for decision analysis"""
    decision: str
    urgency: str
    riskScore: float
    riskFactors: List[RiskFactor]
    selectedRoute: SelectedRoute
    selectedFacility: SelectedFacility
    rejectedOptions: List[RejectedOption]
    recommendation: Recommendation
    financialAnalysis: FinancialAnalysis
    postRecoveryPlan: PostRecoveryPlan


def calculate_temperature_risk(
    current_temp: float, critical_threshold: float
) -> tuple[float, str]:
    """Calculate temperature risk score and severity"""
    temp_diff = abs(current_temp - critical_threshold)
    
    if temp_diff >= 5:
        return 40.0, "CRITICAL"
    elif temp_diff >= 3:
        return 30.0, "HIGH"
    elif temp_diff >= 1:
        return 20.0, "MEDIUM"
    else:
        return 10.0, "LOW"


def calculate_time_risk(time_to_spoilage: int) -> tuple[float, str]:
    """Calculate time criticality risk score and severity"""
    if time_to_spoilage <= 60:
        return 20.0, "CRITICAL"
    elif time_to_spoilage <= 120:
        return 15.0, "HIGH"
    elif time_to_spoilage <= 180:
        return 10.0, "MEDIUM"
    else:
        return 5.0, "LOW"


def calculate_weather_risk(weather_analysis: WeatherAnalysis) -> tuple[float, str]:
    """Calculate weather risk score and severity"""
    risk = weather_analysis.overallWeatherRisk
    
    if risk >= 70:
        return 30.0, "CRITICAL"
    elif risk >= 50:
        return 20.0, "HIGH"
    elif risk >= 30:
        return 10.0, "MEDIUM"
    else:
        return 0.0, "LOW"


def select_best_facility_and_route(
    facilities: List[FacilityInfo],
    routes: List[RouteInfo],
    time_to_spoilage: int,
    weather_analysis: WeatherAnalysis,
) -> tuple[Optional[FacilityInfo], Optional[RouteInfo], List[RejectedOption]]:
    """
    Select the best facility and route based on multiple criteria
    Returns: (selected_facility, selected_route, rejected_options)
    """
    rejected = []
    
    # Filter facilities with required service available
    service_facilities = [f for f in facilities if f.serviceAvailable is not False]
    
    if not service_facilities:
        # No service available - reject all
        for f in facilities:
            rejected.append(
                RejectedOption(
                    type="facility",
                    stationId=f.stationId,
                    name=f.name,
                    reason=f"Required service ({f.serviceType if f.serviceType else 'unknown'}) not available",
                )
            )
        return None, None, rejected
    
    # Sort by travel time (fastest first)
    service_facilities.sort(key=lambda f: f.travelTime if f.travelTime is not None else 999999)
    
    # Select the fastest facility with required service
    selected_facility = service_facilities[0]
    
    # Find corresponding route
    selected_route = None
    for route in routes:
        destination = route.destination if route.destination is not None else {}
        facility_name = destination.get("facilityName", "") if isinstance(destination, dict) else ""
        if selected_facility.name in facility_name:
            selected_route = route
            break
    
    # Reject other facilities
    for f in facilities:
        if f.stationId != selected_facility.stationId:
            if not f.serviceAvailable:
                reason = f"Required service ({f.serviceType if f.serviceType else 'unknown'}) not available"
            else:
                f_travel = f.travelTime if f.travelTime is not None else 0
                sel_travel = selected_facility.travelTime if selected_facility.travelTime is not None else 0
                if f_travel > sel_travel:
                    reason = f"Longer travel time ({f_travel} min vs {sel_travel} min)"
                else:
                    reason = "Alternative facility selected based on optimal criteria"
            
            rejected.append(
                RejectedOption(
                    type="facility",
                    stationId=f.stationId,
                    name=f.name,
                    reason=reason,
                )
            )
    
    return selected_facility, selected_route, rejected


@tool()
def analyze_decision(input_data: DecisionInput) -> DecisionOutput:
    """
    Analyze all data and make a decision recommendation for emergency rerouting.
    
    This function simulates the Decision Agent's decision-making logic by calculating
    risk scores from temperature, time criticality, weather, and station availability,
    then selecting the optimal facility and route for emergency cooling.
    
    Args:
        input_data (DecisionInput): Complete decision context including truck telemetry,
            cargo data, weather analysis, station analysis, and route analysis.
    
    Returns:
        DecisionOutput: Comprehensive decision with risk assessment, selected route/facility,
            financial analysis, and post-recovery plan.
    """
    # Handle both dict and Pydantic model inputs
    if isinstance(input_data, dict):
        try:
            input_data = DecisionInput(**input_data)
        except Exception as e:
            raise ValueError(f"Failed to parse input_data as DecisionInput: {str(e)}")
    
    # Calculate risk factors
    temp_risk_points, temp_severity = calculate_temperature_risk(
        input_data.telemetry.temperature,
        input_data.cargo.criticalThreshold,
    )
    
    time_risk_points, time_severity = calculate_time_risk(
        input_data.cargo.timeToSpoilage
    )
    
    weather_risk_points, weather_severity = calculate_weather_risk(
        input_data.weatherAnalysis
    )
    
    # Station availability risk (inverse of best facility score)
    best_facility_score = max(
        (f.score for f in input_data.stationAnalysis.facilities), default=0
    )
    station_risk_points = 10.0 if best_facility_score >= 70 else 5.0
    station_severity = "LOW" if best_facility_score >= 70 else "MEDIUM"
    
    # Calculate total risk score
    total_risk = temp_risk_points + time_risk_points + weather_risk_points
    
    # Build risk factors
    risk_factors = [
        RiskFactor(
            factor="Temperature",
            value=f"{input_data.telemetry.temperature}°C",
            severity=temp_severity,
        ),
        RiskFactor(
            factor="Time Criticality",
            value=f"{input_data.cargo.timeToSpoilage} minutes to spoilage",
            severity=time_severity,
        ),
        RiskFactor(
            factor="Weather",
            value=(
                "Severe weather detected"
                if input_data.weatherAnalysis.severeWeatherDetected
                else "Clear conditions"
            ),
            severity=weather_severity,
        ),
        RiskFactor(
            factor="Station Availability",
            value=(
                "Nearest facility with emergency cooling available"
                if best_facility_score >= 70
                else "Limited facility options"
            ),
            severity=station_severity,
        ),
    ]
    
    # Determine decision and urgency
    if total_risk >= 60:
        decision = DecisionType.EMERGENCY_REROUTE
        urgency = UrgencyLevel.CRITICAL
    elif total_risk >= 40:
        decision = DecisionType.EMERGENCY_REROUTE
        urgency = UrgencyLevel.HIGH
    elif total_risk >= 20:
        decision = DecisionType.CONTROLLED_REROUTE
        urgency = UrgencyLevel.MEDIUM
    else:
        decision = DecisionType.CONTINUE
        urgency = UrgencyLevel.LOW
    
    # Select best facility and route
    selected_facility, selected_route, rejected_options = select_best_facility_and_route(
        input_data.stationAnalysis.facilities,
        input_data.routeAnalysis.routes,
        input_data.cargo.timeToSpoilage,
        input_data.weatherAnalysis,
    )
    
    if not selected_facility or not selected_route:
        # No viable options - abort
        decision = DecisionType.ABORT
        urgency = UrgencyLevel.CRITICAL
    
    # Calculate cooling duration (simulated - typically 45-60 minutes)
    cooling_duration = 45
    
    # Build recommendation reasoning
    reasoning = []
    if selected_facility and selected_route:
        service_desc = selected_facility.serviceType if selected_facility.serviceType else "required service"
        reasoning.append(
            f"Nearest facility with {service_desc} ({selected_facility.travelTime} minutes away)"
        )
        
        arrival_str = selected_route.arrivalTime if selected_route.arrivalTime else ""
        if arrival_str:
            arrival_time = datetime.fromisoformat(arrival_str.replace("Z", "+00:00"))
        else:
            arrival_time = datetime.now(timezone.utc)
        deadline = datetime.now(timezone.utc) + timedelta(minutes=input_data.cargo.timeToSpoilage)
        
        if arrival_time < deadline:
            reasoning.append(
                f"Arrives well within {input_data.cargo.timeToSpoilage}-minute deadline"
            )
        
        service_desc = selected_facility.serviceType if selected_facility.serviceType else "service"
        reasoning.append(
            f"{service_desc.replace('_', ' ').title()} restores conditions in {cooling_duration} minutes"
        )
        
        cooling_restored_time = arrival_time + timedelta(minutes=cooling_duration)
        safety_buffer = int((deadline - cooling_restored_time).total_seconds() / 60)
        
        reasoning.append(
            f"Cargo will be stabilized with {safety_buffer} min safety buffer"
        )
        
        severe_weather = input_data.weatherAnalysis.severeWeatherDetected if input_data.weatherAnalysis.severeWeatherDetected is not None else False
        if not severe_weather:
            reasoning.append("Clear weather on route (no delays)")
        
        bays_available = selected_facility.baysAvailable if selected_facility.baysAvailable is not None else 0
        if bays_available > 0:
            reasoning.append(
                f"{bays_available} bays available for immediate docking"
            )
    
    # Financial analysis
    additional_fuel = (selected_route.fuelCost if selected_route and selected_route.fuelCost is not None else 0.0)
    service_fee = (selected_facility.serviceFee if selected_facility and selected_facility.serviceFee else 0.0)
    reroute_cost = additional_fuel + service_fee
    cargo_value_at_risk = input_data.cargo.value
    net_savings = cargo_value_at_risk - reroute_cost
    
    # Post-recovery plan
    if selected_route and selected_route.arrivalTime:
        arrival_dt = datetime.fromisoformat(selected_route.arrivalTime.replace("Z", "+00:00"))
        cooling_restored_dt = arrival_dt + timedelta(minutes=cooling_duration)
        transfer_dt = cooling_restored_dt + timedelta(hours=2, minutes=45)
        final_arrival_dt = transfer_dt + timedelta(hours=2, minutes=30)
        
        # Ensure original_arrival is timezone-aware
        original_arrival_str = input_data.originalPlan.estimatedArrival
        if original_arrival_str.endswith("Z"):
            original_arrival_str = original_arrival_str.replace("Z", "+00:00")
        original_arrival = datetime.fromisoformat(original_arrival_str)
        
        # If still naive, make it UTC aware
        if original_arrival.tzinfo is None:
            original_arrival = original_arrival.replace(tzinfo=timezone.utc)
        total_delay = int((final_arrival_dt - original_arrival).total_seconds() / 60)
        
        post_recovery = PostRecoveryPlan(
            serviceRestored=cooling_restored_dt.isoformat().replace("+00:00", "Z"),
            serviceType=selected_facility.serviceType if selected_facility else "unknown",
            transferToOriginalDestination=transfer_dt.isoformat().replace("+00:00", "Z"),
            finalArrivalNewYork=final_arrival_dt.isoformat().replace("+00:00", "Z"),
            totalDelayFromOriginal=total_delay,
            cargoCondition="PRESERVED",
        )
        
        safety_buffer = int(
            (
                datetime.now(timezone.utc) + timedelta(minutes=input_data.cargo.timeToSpoilage)
                - cooling_restored_dt
            ).total_seconds()
            / 60
        )
    else:
        post_recovery = PostRecoveryPlan()
        safety_buffer = 0
    
    # Build output - create default values if no facility/route selected
    if not selected_route or not selected_facility:
        # Create minimal valid output for abort scenario
        return DecisionOutput(
            decision=decision.value,
            urgency=urgency.value,
            riskScore=total_risk,
            riskFactors=risk_factors,
            selectedRoute=SelectedRoute(
                routeId="none",
                name="No viable route",
                destination="N/A",
                arrivalTime=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                duration=0,
                fuelCost=0,
                isAlternateRoute=False,
            ),
            selectedFacility=SelectedFacility(
                stationId="none",
                name="No viable facility",
                onPlannedRoute=False,
                serviceAvailable=False,
                serviceFee=0,
                serviceType="unknown",
                serviceDuration=0,
            ),
            rejectedOptions=rejected_options,
            recommendation=Recommendation(
                action="No viable options - abort mission",
                reasoning=["No facilities with required service available"],
                estimatedArrival="",
                serviceRestored=None,
                serviceType=None,
                safetyBuffer=0,
            ),
            financialAnalysis=FinancialAnalysis(
                rerouteCost=0,
                breakdown=FinancialBreakdown(
                    additionalFuel=0,
                    serviceFee=0,
                ),
                cargoValueAtRisk=cargo_value_at_risk,
                netSavings=0,
            ),
            postRecoveryPlan=PostRecoveryPlan(),
        )
    
    # Build output with valid facility and route
    return DecisionOutput(
        decision=decision.value,
        urgency=urgency.value,
        riskScore=total_risk,
        riskFactors=risk_factors,
        selectedRoute=SelectedRoute(
            routeId=selected_route.routeId,
            name=selected_route.name,
            destination=(selected_route.destination.get("facilityName", "") if selected_route.destination and isinstance(selected_route.destination, dict) else ""),
            arrivalTime=selected_route.arrivalTime if selected_route.arrivalTime else "",
            duration=selected_route.totalDuration if selected_route.totalDuration is not None else 0,
            fuelCost=selected_route.fuelCost if selected_route.fuelCost is not None else 0.0,
            isAlternateRoute=selected_route.isAlternateRoute if selected_route.isAlternateRoute is not None else False,
        ),
        selectedFacility=SelectedFacility(
            stationId=selected_facility.stationId,
            name=selected_facility.name,
            onPlannedRoute=selected_facility.onPlannedRoute if selected_facility.onPlannedRoute is not None else False,
            serviceAvailable=selected_facility.serviceAvailable if selected_facility.serviceAvailable is not None else True,
            serviceFee=selected_facility.serviceFee,
            serviceType=selected_facility.serviceType,
            serviceDuration=cooling_duration,
        ),
        rejectedOptions=rejected_options,
        recommendation=Recommendation(
            action=f"Immediate reroute to {selected_facility.name}" if selected_facility else "No viable options",
            reasoning=reasoning,
            estimatedArrival=(selected_route.arrivalTime if selected_route and selected_route.arrivalTime else ""),
            serviceRestored=post_recovery.serviceRestored,
            serviceType=post_recovery.serviceType,
            safetyBuffer=safety_buffer,
        ),
        financialAnalysis=FinancialAnalysis(
            rerouteCost=reroute_cost,
            breakdown=FinancialBreakdown(
                additionalFuel=additional_fuel,
                serviceFee=service_fee,
            ),
            cargoValueAtRisk=cargo_value_at_risk,
            netSavings=net_savings,
        ),
        postRecoveryPlan=post_recovery,
    )


# Tool metadata for watsonx Orchestrate
__tool_name__ = "analyze_decision"
__tool_description__ = "Analyze telemetry, cargo, weather, station, and route data to make emergency reroute decisions. Calculates risk scores, selects optimal facility and route, and provides financial analysis."
