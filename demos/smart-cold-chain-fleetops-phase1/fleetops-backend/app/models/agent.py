"""Agent execution models for watsonx Orchestrate integration"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class AgentStatusEnum(str, Enum):
    """Agent execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ExecutionStatusEnum(str, Enum):
    """Overall execution status"""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatus(BaseModel):
    """Status of individual agent execution"""
    status: AgentStatusEnum = Field(default=AgentStatusEnum.PENDING, description="Agent execution status")
    started_at: Optional[datetime] = Field(default=None, description="When agent started execution")
    completed_at: Optional[datetime] = Field(default=None, description="When agent completed execution")
    progress: Optional[int] = Field(default=None, ge=0, le=100, description="Execution progress percentage")
    output: Optional[Dict[str, Any]] = Field(default=None, description="Agent output data")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "completed",
                "started_at": "2026-05-06T10:00:00.000Z",
                "completed_at": "2026-05-06T10:00:15.000Z",
                "progress": 100,
                "output": {
                    "severeWeatherDetected": False,
                    "overallWeatherRisk": 15
                },
                "error": None
            }
        }


class AgentExecution(BaseModel):
    """Complete agent workflow execution record"""
    execution_id: str = Field(..., description="Unique execution identifier")
    truck_id: str = Field(..., description="Truck ID being analyzed")
    status: ExecutionStatusEnum = Field(default=ExecutionStatusEnum.RUNNING, description="Overall execution status")
    started_at: datetime = Field(default_factory=datetime.utcnow, description="When execution started")
    completed_at: Optional[datetime] = Field(default=None, description="When execution completed")
    agents: Dict[str, AgentStatus] = Field(
        default_factory=lambda: {
            "weather": AgentStatus(),
            "station": AgentStatus(),
            "route": AgentStatus(),
            "decision": AgentStatus(),
            "notification": AgentStatus()
        },
        description="Status of each agent in workflow"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "execution_id": "exec-abc123",
                "truck_id": "TRUCK-001",
                "status": "running",
                "started_at": "2026-05-06T10:00:00.000Z",
                "completed_at": None,
                "agents": {
                    "weather": {
                        "status": "completed",
                        "started_at": "2026-05-06T10:00:00.000Z",
                        "completed_at": "2026-05-06T10:00:15.000Z",
                        "progress": 100,
                        "output": {"severeWeatherDetected": False}
                    },
                    "station": {
                        "status": "running",
                        "started_at": "2026-05-06T10:00:15.000Z",
                        "progress": 50
                    },
                    "route": {"status": "pending"},
                    "decision": {"status": "pending"}
                }
            }
        }


class AgentExecuteRequest(BaseModel):
    """Request to execute agent workflow"""
    truck_id: str = Field(..., description="Truck ID to analyze")
    
    class Config:
        json_schema_extra = {
            "example": {
                "truck_id": "TRUCK-001"
            }
        }


class AgentExecuteResponse(BaseModel):
    """Response from agent execution start"""
    execution_id: str = Field(..., description="Unique execution identifier")
    truck_id: str = Field(..., description="Truck ID being analyzed")
    status: ExecutionStatusEnum = Field(..., description="Execution status")
    started_at: datetime = Field(..., description="When execution started")
    agents: Dict[str, AgentStatus] = Field(..., description="Initial agent statuses")
    
    class Config:
        json_schema_extra = {
            "example": {
                "execution_id": "exec-abc123",
                "truck_id": "TRUCK-001",
                "status": "running",
                "started_at": "2026-05-06T10:00:00.000Z",
                "agents": {
                    "weather": {"status": "running", "started_at": "2026-05-06T10:00:00.000Z"},
                    "station": {"status": "pending"},
                    "route": {"status": "pending"},
                    "decision": {"status": "pending"}
                }
            }
        }


class AgentHistoryResponse(BaseModel):
    """Response containing execution history"""
    executions: List[AgentExecution] = Field(..., description="List of agent executions")
    
    class Config:
        json_schema_extra = {
            "example": {
                "executions": [
                    {
                        "execution_id": "exec-abc123",
                        "truck_id": "TRUCK-001",
                        "status": "completed",
                        "started_at": "2026-05-06T10:00:00.000Z",
                        "completed_at": "2026-05-06T10:02:00.000Z",
                        "agents": {
                            "weather": {"status": "completed"},
                            "station": {"status": "completed"},
                            "route": {"status": "completed"},
                            "decision": {"status": "completed"}
                        }
                    }
                ]
            }
        }


