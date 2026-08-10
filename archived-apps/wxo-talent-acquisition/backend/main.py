import os
import hashlib
import datetime
import logging
import random
from uuid import uuid4
from typing import List

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ibm_watsonx_ai.foundation_models.schema import TextGenParameters
from PyPDF2 import PdfReader

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from ibm_watsonx_ai.foundation_models.schema import TextGenParameters
from services.elastic_wrapper import ElasticWrapper
from services.watsonx_wrapper import WatsonxWrapper 
import hashlib
from utils import(
    _create_or_recreate_index,
    _jobs_index_body,
    _resumes_index_body
)
from dotenv import load_dotenv
from schemas import (
    JobCreateRequest,
    JobCreateResponse,
    ResumeSummary,
    InterviewGuideResponse,
    AssessmentResponse,
    ResumeUploadResponse,
    JobIdRequest,
    JobIdTopKRequest,
    JobResumeIdRequest,
    SearchResumesRequest,
    SearchJobsRequest,
    JobSummary,
    SetupESRequest,
    SetupESResponse
)
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

app = FastAPI(title="Talent Matcher API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
es_wrapper = ElasticWrapper()
print(es_wrapper.es_client.info())
print(es_wrapper.es_client.ping())
used_job_ids = set()

_http_bearer = HTTPBearer(auto_error=False)
def _load_allowed_tokens() -> set[str]:
    toks = set()
    single = os.getenv("API_TOKEN")
    many = os.getenv("API_TOKENS")
    if single:
        toks.add(single.strip())
    if many:
        toks.update(t.strip() for t in many.split(",") if t.strip())
    return toks

_ALLOWED_TOKENS = _load_allowed_tokens()

def require_token(credentials: HTTPAuthorizationCredentials = Security(_http_bearer)) -> str:
    if credentials is None or (credentials.scheme or "").lower() != "bearer":
        # 401 when no/malformed credentials
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header. Use: Bearer <token>")
    token = credentials.credentials
    if not _ALLOWED_TOKENS or token not in _ALLOWED_TOKENS:
        # 403 when provided but not allowed
        raise HTTPException(status_code=403, detail="Invalid or unauthorized token")
    return token  # returned value is available to endpoints if needed




def compute_job_id(title: str, details: str, digits: int = 6) -> str:
    hash_input = (title + details).encode("utf-8")
    hash_digest = hashlib.sha256(hash_input).hexdigest()
    numeric_hash = int(hash_digest, 16)
    return str(numeric_hash % (10 ** digits)).zfill(digits)

# ==========================
# API Endpoints
# ==========================

@app.post("/jobs_posts", response_model=JobCreateResponse)
async def create_job(job: JobCreateRequest,  _token: str = Depends(require_token)):
    """
    Create a new job posting.

    Args:
        job (JobCreateRequest): Job creation request with title and details.

    Returns:
        JobCreateResponse: Job ID and confirmation message.
    """
    raw_id = compute_job_id(job.title, job.details)
    job_id = f"job_{raw_id}"
    if job_id in used_job_ids:
        return JobCreateResponse(
            job_id=job_id,
            message="Job posted successfully."
        )
    job_doc = {
        "job_id": job_id,
        "title": job.title,
        "details": job.details,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    try:
        es_client = es_wrapper.es_client
        es_client.index(index="jobs", id=job_id, body=job_doc)
        used_job_ids.add(job_id)
        return JobCreateResponse(
            job_id=job_id,
            message="Job posted successfully."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index job: {e}")

@app.post("/jobs/top-resumes", response_model=List[ResumeSummary])
async def top_resumes(request: JobIdTopKRequest,  _token: str = Depends(require_token)):
    """
    Retrieve top resumes relevant to a job posting.

    Args:
        request (JobIdTopKRequest): Request containing job_id and top_k.

    Returns:
        List[ResumeSummary]: List of matching resume summaries.
    """
    job_id = request.job_id
    top_k = request.top_k
    try:
        es = es_wrapper.es_client
        job_doc = es.get(index="jobs", id=job_id)["_source"]
        job_title = job_doc.get("title", "")
        job_details = job_doc.get("details", "")
        search_body = {
            "query": {
                "multi_match": {
                    "query": job_details,
                    "fields": ["text^2", "full_text"],
                    "fuzziness": "AUTO"
                }
            },
            "_source": ["resume_id", "text", "filename"],
            "size": top_k
        }
        results = es.search(index="resumes-index", body=search_body)
        summaries = []
        for hit in results["hits"]["hits"]:
            source = hit["_source"]
            resume_id = source.get("resume_id", hit["_id"])
            raw_summary = source.get("text", "")
            filename = source.get("filename", "")
            prefix = "assistant<|end_header_id|>\n\n"
            cleaned_summary = raw_summary.replace(prefix, "", 1).lstrip()
            summaries.append(ResumeSummary(
                resume_id=resume_id,
                title=filename,
                summary=cleaned_summary
            ))
        return summaries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve top resumes: {e}")

@app.post("/jobs/interview-guides", response_model=InterviewGuideResponse)
async def interview_guides(request: JobIdRequest,  _token: str = Depends(require_token)):
    """
    Generate an interview guide for a job.

    Args:
        request (JobIdRequest): Request containing job_id.

    Returns:
        InterviewGuideResponse: List of suggested interview questions for the job.
    """
    job_id = request.job_id
    try:
        es_client = es_wrapper.es_client
        job_doc = es_client.get(index="jobs", id=job_id)
        job = job_doc["_source"]
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job with ID '{job_id}' not found")
    prompt = (
        f"As an expert interviewer, generate a concise list of **only** 5 to 10 high-quality, role-specific interview questions "
        f"for the position below. Focus strictly on technical, behavioral, and role-relevant skills. "
        f"Format the output as clean bullet points. Do not include introductions, explanations, or sign-offs.\n\n"
        f"Job Title: {job['title']}\n\n"
        f"Job Description:\n{job['details']}\n\n"
        f"Output:\n-"
    )
    custom_params = TextGenParameters(
        temperature=0,
        max_new_tokens=400,
        min_new_tokens=100,
        decoding_method="greedy",
        stop_sequences=["\n\n", "Best regards", "Yours sincerely"]
    )
    wx = WatsonxWrapper()
    raw_output = wx.generate_text(prompt=prompt, params=custom_params)
    guide = [line.strip("- ").strip() for line in raw_output.splitlines() if line.strip().startswith("-")][:10]
    return InterviewGuideResponse(
        job_id=job_id,
        interview_guide=guide if guide else [raw_output]
    )

@app.post("/assessment", response_model=AssessmentResponse)
async def assessment(request: JobResumeIdRequest,  _token: str = Depends(require_token)):
    """
    Generate an AI-based assessment of a resume for a given job.

    Args:
        request (JobResumeIdRequest): Request containing job_id and resume_id.

    Returns:
        AssessmentResponse: Markdown-formatted assessment report.
    """
    job_id = request.job_id
    resume_id = request.resume_id
    try:
        es = es_wrapper.es_client
        job_doc = es.get(index="jobs", id=job_id)["_source"]
        job_title = job_doc.get("title", "")
        job_details = job_doc.get("details", "")
        resume_search = es.search(index="resumes-index", body={
            "query": {
                "term": {
                    "resume_id.keyword": resume_id
                }
            }
        })
        if not resume_search["hits"]["hits"]:
            raise HTTPException(status_code=404, detail=f"Resume with ID '{resume_id}' not found")
        resume_doc = resume_search["hits"]["hits"][0]["_source"]
        resume_text = resume_doc.get("full_text", "")
        resume_summary = resume_doc.get("text", "")
        resume_filename = resume_doc.get("filename", "")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error fetching data: {e}")
    prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an AI recruitment assistant. Given a job description and a candidate's resume, generate a markdown-formatted assessment of the candidate’s fit. Highlight strengths, weaknesses, and missing qualifications using clear bullet points and headers.

Return your response in the following format:
# Assessment
**Fit:** <short overall fit>

## Skills Matched
- ...

## Skills Missing
- ...

## Recommendations
- ...<|eot_id|>

<|start_header_id|>user<|end_header_id|>
Here is the job posting:
Title: {job_title}
Description:
\"\"\"{job_details}\"\"\"

Here is the resume content:
\"\"\"{resume_text}\"\"\"<|eot_id|>
"""
    try:
        watsonx = WatsonxWrapper()
        raw_output = watsonx.generate_summary(prompt)
        prefix_to_remove = "assistant<|end_header_id|>\n\n"
        assessment_markdown = raw_output.replace(prefix_to_remove, "", 1).lstrip()
        return AssessmentResponse(
            assessment_markdown=assessment_markdown
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {e}")

@app.post("/resumes", response_model=ResumeUploadResponse)
async def upload_resume(resume_file: UploadFile = File(...),  _token: str = Depends(require_token)):
    """
    Upload a new resume, extract text, summarize it, and index into Elasticsearch.

    Args:
        resume_file (UploadFile): The PDF file of the resume.

    Returns:
        ResumeUploadResponse: Resume ID and AI-generated summary.
    """
    content = await resume_file.read()
    resume_id = f"res_{random.randint(100, 999)}"
    filename = resume_file.filename
    try:
        with open(f"/tmp/{filename}", "wb") as f:
            f.write(content)
        reader = PdfReader(f"/tmp/{filename}")
        full_text = "".join([page.extract_text() or "" for page in reader.pages])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {e}")
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found in the PDF.")
    prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an AI language model tasked with summarizing the provided document content. Provide the summary as a concise, single-paragraph summary in plain English. Do not include any headings, bullet points, or markdown formatting. Focus on key themes, data, or findings. Write at least 7 lines from each resume.<|eot_id|>

<|start_header_id|>user<|end_header_id|>
Here is the extracted text from a resume:

\"\"\"{full_text}\"\"\"

Write a paragraph summarizing the important content from this document.<|eot_id|>
"""
    watsonx = WatsonxWrapper()
    raw_summary = watsonx.generate_summary(prompt)
    cleaned_summary = raw_summary.lstrip("assistant<|end_header_id|>\n").strip()
    try:
        es_client = es_wrapper.es_client
        doc = {
            "resume_id": resume_id,         
            "text": cleaned_summary,
            "filename": filename,
            "full_text": full_text
        }
        response = es_client.index(index="resumes-index", id=filename, document=doc)
        logging.info(f"Indexed resume using filename as ID: {filename} with response: {response}")
    except Exception as e:
        logging.error(f"Failed to index resume {resume_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to index resume.")
    return ResumeUploadResponse(
        resume_id=resume_id,
        summary=cleaned_summary
    )

@app.post("/search/resumes", response_model=List[ResumeSummary])
async def search_resumes(request: SearchResumesRequest,  _token: str = Depends(require_token)):
    """
    Search resumes using a query string.

    Args:
        request (SearchResumesRequest): Request with search query and optional top_k.

    Returns:
        List[ResumeSummary]: Ranked list of relevant resumes.
    """
    query = request.query
    top_k = request.top_k
    try:
        es = es_wrapper.es_client
        search_body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["text^2", "full_text"],
                    "fuzziness": "AUTO"
                }
            },
            "_source": ["resume_id", "text", "filename"],
            "size": top_k
        }
        results = es.search(index="resumes-index", body=search_body)
        resume_summaries = []
        for hit in results["hits"]["hits"]:
            source = hit["_source"]
            resume_summaries.append(ResumeSummary(
                resume_id=source.get("resume_id", hit["_id"]),
                title=source.get("filename", "Resume"),
                summary=source.get("text", "")
            ))
        return resume_summaries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/search/jobs", response_model=List[JobSummary])
async def search_jobs(request: SearchJobsRequest,  _token: str = Depends(require_token)):
    """
    Search job postings using a query string.

    Args:
        request (SearchJobsRequest): Request with search query and optional top_k.

    Returns:
        List[JobSummary]: Ranked list of matching job postings.
    """
    query = request.query
    top_k = request.top_k
    try:
        es = es_wrapper.es_client
        search_body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "details"],
                    "fuzziness": "AUTO"
                }
            },
            "_source": ["title", "details"],
            "size": top_k
        }
        results = es.search(index="jobs", body=search_body)
        job_summaries = []
        for hit in results["hits"]["hits"]:
            source = hit["_source"]
            job_summaries.append(JobSummary(
                job_id=hit["_id"],
                title=source["title"],
                details=source["details"]
            ))
        return job_summaries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
@app.post("/setup/elasticsearch", response_model=SetupESResponse)
def setup_elasticsearch(req: SetupESRequest, _token: str = Depends(require_token)):
    """
    Deploy ELSER (optional) and initialize empty indices for resumes and jobs.
    - Adds 'ml.tokens' rank_features field for ELSER sparse retrieval.
    - Recreates indices by default (set recreate=false in indices[] to keep data).
    """
    es_client = es_wrapper.es_client
    created: List[str] = []

    #  Indices
    for spec in req.indices:
        print(f"for index : {spec}")
        body = _resumes_index_body() if spec.name == "resumes-index" else _jobs_index_body()
        print(f"body : {body}")
        
        try:
            created_now = _create_or_recreate_index(es_client, spec.name, spec.recreate, body)
            print(created_now)
            if created_now:
                created.append(spec.name)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Index '{spec.name}' setup failed: {e}")

    return SetupESResponse(
        created_indices=created,
    )


# ---------- Fetch ALL Jobs (paginated) ----------
@app.get("/jobs", response_model=List[JobSummary])
def list_jobs(
    page: int = Query(1, ge=1, description="1-based page number"),
    size: int = Query(50, ge=1, le=1000, description="Page size"),
    _token: str = Depends(require_token),
):
    """
    Return all job postings (paginated).
    Sorted by created_at desc when available.
    """
    offset = (page - 1) * size
    try:
        es = es_wrapper.es_client
        search_body = {
            "query": {"match_all": {}},
            "_source": ["title", "details"],
            "from": offset,
            "size": size,
            # "sort": [{"created_at": "desc"}]
        }
        results = es.search(index="jobs", body=search_body)
        jobs: List[JobSummary] = []
        for hit in results["hits"]["hits"]:
            src = hit["_source"]
            jobs.append(JobSummary(
                job_id=hit["_id"],
                title=src.get("title", ""),
                details=src.get("details", "")
            ))
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {e}")

# ---------- Fetch ALL Resumes (paginated) ----------
@app.get("/resumes", response_model=List[ResumeSummary])
def list_resumes(
    page: int = Query(1, ge=1, description="1-based page number"),
    size: int = Query(50, ge=1, le=1000, description="Page size"),
    _token: str = Depends(require_token),
):
    """
    Return all resumes (paginated).
    Sorted by _id desc as a stable fallback.
    """
    offset = (page - 1) * size
    try:
        es = es_wrapper.es_client
        search_body = {
            "query": {"match_all": {}},
            "_source": ["resume_id", "text", "filename"],
            "from": offset,
            "size": size,
            # "sort": [{"created_at": "desc"}]
        }
        results = es.search(index="resumes-index", body=search_body)
        resumes: List[ResumeSummary] = []
        for hit in results["hits"]["hits"]:
            src = hit["_source"]
            resumes.append(ResumeSummary(
                resume_id=src.get("resume_id", hit["_id"]),
                title=src.get("filename", "Resume"),
                summary=src.get("text", "")
            ))
        return resumes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list resumes: {e}")