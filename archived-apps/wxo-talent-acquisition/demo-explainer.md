# Agent Use Case Walkthrough — Talent Matcher API

Follow these four simple steps to understand, try, and build upon this AI agent use case.

---

## Step 1: Review the Use Case Summary

Understand the business value and core objective of the agent.  
See the project `README.md` for:

- What the agent does (resume ingest, job ingest, matching, interview guides, assessment)
- Domain: Talent Acquisition / HR Tech
- Business impact: Faster shortlisting, structured interviews, consistent candidate assessments
- Key technologies: FastAPI, watsonx.ai (LLM), Elasticsearch, PyPDF2

---

## Step 2: Try the API

Test the API locally or on the deployed endpoint.

- Use the deployed URL (see `metadata.yaml`) or run locally with `uvicorn app.main:app --reload`
- Open interactive docs: `/docs`
- Try endpoints in order:
  1. `POST /resumes` — upload a PDF resume
  2. `POST /jobs_posts` — create a job
  3. `POST /jobs/top-resumes` — find top matching resumes
  4. `POST /jobs/interview-guides` — generate interview questions
  5. `POST /assessment` — get a markdown fit assessment

### Demo Explainer

The demo shows:
- Realistic resume/job flows with minimal setup
- LLM-driven reasoning for interview guides and assessments
- Search + ranking via Elasticsearch for relevance

### Checkout the sample video to checkout questions to ask in Orchestrate

[Talent Acquistion Demo Video](./talent_acquistion_demo.mp4)

---

## Step 3: Get an Application Code Sample

Clone your repo (replace with your actual URL):

```bash
git clone <your-repo-url>
cd <your-project-dir>
