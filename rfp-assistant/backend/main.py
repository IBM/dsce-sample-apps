from datetime import datetime
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer, util

from scrapers.alberta import fetch_alberta_opportunities
from scrapers.ariba import fetch_ariba_opportunities

import os
os.environ["TOKENIZERS_PARALLELISM"] = ("false")  ## to ensure hugging face model don't get into deadlock


app = FastAPI(title="RFP Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

########################################  use-case 1 ########################################

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

from models import CompanyProfile, RfpOpportunity

def embed_text(text: str):
    return embedding_model.encode(text, convert_to_tensor=True)

def calculate_match_score(company_embed, text_embed) -> float:
    sim = util.pytorch_cos_sim(company_embed, text_embed)
    return float(sim.item())

import inspect

@app.post("/search-opportunities", response_model=List[RfpOpportunity])
async def search_opportunities(profile: CompanyProfile):
    company_embed = embed_text("Description: {}".format(profile.description))

    scrapers = [fetch_alberta_opportunities, fetch_ariba_opportunities]

    all_opportunities = []
    for scraper in scrapers:
        try:
            all_opportunities.extend(scraper(RfpOpportunity))
        except Exception as e:
            # log or skip
            print("srcaper: {} failed with error: {}".format(scraper, e))
            continue
    
    # print("all opp: \n{}".format(all_opportunities))

    for opp in all_opportunities:
        text_to_embed = "{} {}".format(opp.title, opp.description)
        opp.match_score = calculate_match_score(company_embed, embed_text(text_to_embed))

    all_opportunities.sort(key=lambda x: x.match_score, reverse=True)
    return all_opportunities[:10]


########################################  use-case 2 ########################################

from langchain_ibm import ChatWatsonx
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenTextParams
from dotenv import load_dotenv
load_dotenv(override=True)

wx_credentials = {
    "url": os.getenv("IBM_CLOUD_URL"),
    "apikey": os.getenv("WATSONX_API_KEY"),
    "project_id": os.getenv("PROJECT_ID"),
}
model_id = os.getenv("LLM") 

llm = ChatWatsonx(
    model_id=model_id,
    params={GenTextParams.MAX_NEW_TOKENS: 2000, GenTextParams.DECODING_METHOD: "sample", GenTextParams.TEMPERATURE: 0.7},
    **wx_credentials,
)


from typing import Optional, Tuple
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse

from langchain_core.output_parsers import StrOutputParser
from langchain.prompts import PromptTemplate

import fitz  # PyMuPDF
from docx import Document

if not os.path.exists("generated_pdfs"):
    os.makedirs("generated_pdfs")

def extract_text_from_file(uploaded_file: UploadFile) -> str:
    content = ""
    if uploaded_file.filename.endswith(".pdf"):
        with fitz.open(stream=uploaded_file.file.read(), filetype="pdf") as doc:
            for page in doc:
                content += page.get_text()
    elif uploaded_file.filename.endswith(".docx"):
        doc = Document(uploaded_file.file)
        content = "\n".join([para.text for para in doc.paragraphs])
    else:
        raise ValueError("Unsupported file type")
    return content.strip()[:2000]  # cap to 2000 chars for context


import ibm_boto3
from botocore.client import Config
from ibm_botocore.client import ClientError

def get_cos_details() -> Tuple:
    mandatory_envar = ("COS_RESOURCE_CRN", "COS_ENDPOINT", "API_KEY")

    if all(k in os.environ for k in mandatory_envar):
        return (
            os.getenv("COS_RESOURCE_CRN"),
            os.getenv("COS_ENDPOINT"),
            os.getenv("API_KEY"),
        )

    else:
        raise ValueError(f"envar missing {mandatory_envar}")

def get_cos_resource():
    COS_RESOURCE_CRN, COS_ENDPOINT, WATSONX_APIKEY = get_cos_details()
    return ibm_boto3.resource(
        service_name="s3",
        ibm_api_key_id=WATSONX_APIKEY,
        ibm_service_instance_id=COS_RESOURCE_CRN,
        ibm_auth_endpoint="https://iam.bluemix.net/oidc/token",
        config=Config(signature_version="oauth"),
        endpoint_url=COS_ENDPOINT,
    )

def put_item(item_name: str, item_path: str, bucket_name: str):
    # print(f"Uploading item to bucket: {bucket_name}, key: {item_name}")
    cos_resource = get_cos_resource()
    try:
        with open(os.path.join(item_path, item_name), "rb") as file_data:
            cos_resource.Object(bucket_name, item_name).upload_fileobj(
                Fileobj=file_data
            )
    except ClientError as ce:
        print("CLIENT ERROR: {0}\n".format(ce))
    except Exception as e:
        print(f"Unable to upload file contents: {e}")


def generate_presigned_url(bucket_name, file_name, cos_access_key_id=None, cos_secret_access_key=None, expiration=604800):
    if cos_access_key_id is None:
        cos_access_key_id = os.getenv("COS_ACCESS_KEY_ID")
    if cos_secret_access_key is None:
        cos_secret_access_key = os.getenv("COS_SECRET_ACCESS_KEY")
    cos_endpoint = os.getenv("COS_ENDPOINT")

    if (
        cos_access_key_id is None
        or cos_secret_access_key is None
    ):
        raise ValueError(
            "COS_ACCESS_KEY_ID and COS_SECRET_ACCESS_KEY are required for connecting to COS Bucket. Either set them in Environment Variables or pass the values while initializing."
        )
    cos_client = ibm_boto3.client(
        's3',
        aws_access_key_id=cos_access_key_id,
        aws_secret_access_key=cos_secret_access_key,
        config=Config(signature_version='s3v4'),
        endpoint_url=cos_endpoint
    )
    presigned_url = cos_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket_name, 'Key': file_name},
        ExpiresIn=expiration
    )
    return presigned_url


@app.post("/generate-rfp-response")
async def generate_rfp_response(
    title: str = Form(...),
    description: str = Form(...),
    customer: str = Form(...),
    ref_number: str = Form(...),
    company_name: str = Form(...),
    company_description: str = Form(...),
    # rfp_file: Optional[UploadFile] = File(None)  # Optional
):
    extra_context = ""
    # if rfp_file:
    #     try:
    #         extra_context = extract_text_from_file(rfp_file)
    #     except Exception as e:
    #         extra_context = ""
    #         print(f"Error reading uploaded file: {e}")


    prompt = PromptTemplate(
        template="""You are an expert proposal writer. Based on the information below, generate a professional RFP response document with the following four sections:

## 1. Executive Summary
Provide a high-level overview of the proposal. Summarize the client's needs, the proposed solution, and the value offered.

## 2. Cover Letter
Write a formal letter addressed to the client. Thank them for the opportunity, briefly highlight your capabilities, express interest in collaboration, and sign with just the company signature.

## 3. Capabilities Mapping
Map the company's strengths, services, and experience to the client's specific opportunity requirements. Use bullet points or concise paragraphs.

## 4. Relevant Past Projects
Describe 2-3 relevant past projects. Include the client, problem statement, approach taken, and the outcome or impact. Highlight alignment with the current opportunity.

---

### Opportunity Details
- **Title**: {title}
- **Client**: {customer}
- **Description**: {description}

---

### Company Profile
- **Name**: {company_name}
- **Overview**: {company_description}

---

### Additional RFP Context (from uploaded file)
{rfp_context}

---

Respond in a clear, formal, and persuasive tone. Use markdown-style headers (##) to separate each section

""",
        input_variables=["title", "customer", "description", "company_name", "company_description", "rfp_context"],
    )

    # chain
    llm_chain = prompt | llm | StrOutputParser()

    # Run
    result = llm_chain.invoke(
        {
            "title": title, "customer": customer, "description": description, 
            "company_name": company_name, "company_description": company_description, "rfp_context": extra_context
        }
    )

    header = f"""<div style="text-align:center">

# Proposal for {title}

**Submitted by**: {company_name}  
**Date**: {datetime.today().strftime('%B %d, %Y')}  
**RFP Reference #**: {ref_number}  

</div>

---
"""
    from markdown_pdf import MarkdownPdf, Section
    def text_to_pdf(result: str, filename: str = "rfp_response.pdf"):
        pdf = MarkdownPdf(toc_level=1)
        pdf.add_section(Section(header + "\n\n" + result))
        pdf.save(filename)


    output_file = "generated_pdfs/proposal_{}.pdf".format(ref_number)
    text_to_pdf(
        result=result,
        filename=output_file,
    )

    bucket = os.getenv("COS_BUCKET_NAME")
    put_item(
        item_name="proposal_{}.pdf".format(ref_number),
        item_path="generated_pdfs",
        bucket_name=bucket,
    )
    
    presigned_url = generate_presigned_url(
        bucket_name=bucket,
        file_name="proposal_{}.pdf".format(ref_number)
    )
    
    return {
        "proposal": result,
        "file_url": presigned_url 
    } 


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app=app, host="0.0.0.0", port=6001)
