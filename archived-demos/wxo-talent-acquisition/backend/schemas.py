from pydantic import BaseModel, Field
from typing import List, Optional

# ==========================
# Pydantic Schemas
# ==========================

class JobCreateRequest(BaseModel):
    """Request body for creating a new job."""
    title: str = Field(..., description="Job title")
    details: str = Field(..., description="Detailed job description")

class JobCreateResponse(BaseModel):
    """Response schema for job creation."""
    job_id: str = Field(..., description="Unique identifier for the created job")
    message: str = Field(..., description="Status message")

class JobIdRequest(BaseModel):
    """Request with just a job_id."""
    job_id: str = Field(..., description="Unique identifier for the job")

class JobIdTopKRequest(BaseModel):
    """Request with job_id and optional top_k."""
    job_id: str = Field(..., description="Unique identifier for the job")
    top_k: Optional[int] = Field(2, description="Number of results to return (default 2)")

class JobResumeIdRequest(BaseModel):
    """Request with job_id and resume_id."""
    job_id: str = Field(..., description="Unique identifier for the job")
    resume_id: str = Field(..., description="Unique identifier for the resume")

class ResumeSummary(BaseModel):
    """Resume summary for search and ranking."""
    resume_id: str = Field(..., description="Unique identifier for the resume")
    title: str = Field(..., description="Resume headline or desired job title")
    summary: str = Field(..., description="Short summary of candidate's experience")

class InterviewGuideResponse(BaseModel):
    """Interview guide response for a job."""
    job_id: str = Field(..., description="Unique identifier for the job")
    interview_guide: List[str] = Field(..., description="List of suggested interview questions")

class AssessmentResponse(BaseModel):
    """Markdown-based assessment for a job-resume match."""
    assessment_markdown: str = Field(..., description="Markdown-formatted assessment report")

class ResumeUploadResponse(BaseModel):
    """Response schema after uploading a resume."""
    resume_id: str = Field(..., description="Unique identifier for the resume")
    summary: str = Field(..., description="AI-generated summary of the resume")

class SearchResumesRequest(BaseModel):
    """Search resumes with query and optional top_k."""
    query: str = Field(..., description="Search query string")
    top_k: Optional[int] = Field(2, description="Number of resumes to return (default 2)")

class SearchJobsRequest(BaseModel):
    """Search jobs with query and optional top_k."""
    query: str = Field(..., description="Search query string")
    top_k: Optional[int] = Field(5, description="Number of jobs to return (default 5)")

class JobSummary(BaseModel):
    """Job summary for search results."""
    job_id: str = Field(..., description="Unique identifier for the job")
    title: str = Field(..., description="Job title")
    details: str = Field(..., description="Short description of the job")


class SetupIndexSpec(BaseModel):
    name: str
    recreate: bool = True  # delete if exists, then create

class SetupESRequest(BaseModel):
    indices: List[SetupIndexSpec] = Field(
        default_factory=lambda: [
            SetupIndexSpec(name="resumes-index", recreate=True),
            SetupIndexSpec(name="jobs", recreate=True),
        ],
        description="List of indices to setup (resume and jobs by default)",
        example=[
            {"name": "resumes-index", "recreate": True},
            {"name": "jobs", "recreate": True}
        ]
    )

class SetupESResponse(BaseModel):
    created_indices: List[str]