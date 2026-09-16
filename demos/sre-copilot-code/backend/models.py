from pydantic import BaseModel
from typing import List, Optional
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Status(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    ANALYZING = "Analyzing"
    RESOLVED = "Resolved"


class Incident(BaseModel):
    id: str
    title: str
    severity: Severity
    status: Status
    affected_service: str
    timestamp: str
    logs: List[str]
    description: Optional[str] = None


class AnalysisResult(BaseModel):
    incident_id: str
    root_cause: str
    severity_classification: str
    remediation_steps: List[str]


class AnalyzeRequest(BaseModel):
    incident_id: str


# ── Chat models ───────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "agent"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    analysis: Optional[dict] = None   # the prior AnalysisResult for context


class ChatResponse(BaseModel):
    reply: str


# ── Admin models ──────────────────────────────────────────────────────────────

class AdminConfig(BaseModel):
    pii_filter: bool = False
    guardrails: bool = False
    secrets_detection: bool = False


class AdminLoginRequest(BaseModel):
    password: str


class ResetResponse(BaseModel):
    message: str
    count: int
