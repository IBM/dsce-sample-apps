# Set up and launch application

## Steps to Run the Backend Application Locally
---
### Prerequisites 

```bash
# FOR MAC OS only(Arm architecture)
export HNSWLIB_NO_NATIVE=1
brew install cmake libomp
declare -x TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

arch -x86_64 /bin/zsh or arch -x86_64 /bin/bash

# For arm64 Pythons:
~/.pyenv/versions/3.10.2/bin/python -m venv venv

# For x86 Pythons:
~/.pyenv/versions/3.10.2_x86/bin/python -m venv venv
```

## Environment Variables (.env)

1. Navigate to the backend directory from the root directory and create a .env file. You can refer the example.env file for your reference.:

```
LOGLEVEL=DEBUG

API_KEY=mysecurefastapis

VECTORDB_DIR=vectors
DATASET_DIR=datasets

IBMCLOUD_API_KEY=YOUR_IBMCLOUD_API_KEY
WATSONX_AI_ENDPOINT=https://us-south.ml.cloud.ibm.com
WX_PROJECT_ID=YOUR_WATSONX_PROJECT_ID

MILVUS_ENDPOINT=REPLACE_WITH_YOUR_MILVUSDB_ENDPOINT
MILVUS_USER=ibmlhapikey

IBMCLOUD_COS_API_KEY = REPLACE_WITH_YOUR_IBMCLOUD_COS_API_KEY
COS_ENDPOINT=YOUR_COS_ENDPOINT
COS_BUCKET=llms-corpus
```

## 1. Steps to create IBM Cloud API key

- 1.1 In the IBM Cloud console, go to Manage > Access (IAM) > API keys
- 1.2 Click Create an IBM Cloud API key
- 1.3 Enter a name and description for your API key
- 1.4 Click Create
- 1.5 Then, click Show to display the API key. Or, click Copy to copy and save it for later, or click Download

## 2. Steps to create project_id (skip 2.1 to 2.3 for watsonx trial account)
- **Watsonx.ai Endpoint**: Typically `https://us-south.ml.cloud.ibm.com`
- 2.1 In IBM Cloud, Set up IBM Cloud Object Storage for use with IBM watsonx
- 2.2 Set up the Watson Studio and Watson Machine Learning services
- 2.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
- 2.4 (Optional step: add more collaborators) Open the Project > Click on Manage tab > Click on Access Control from the Manage tab > Click Add collaborators > Add Users > Choose Console as Admin > Click Add
- 2.5 Click on Manage tab > Copy the Project ID from General

## 3. Milvus DB Setup

Ensure your Milvus instance is ready, and update the following environment variables in your configuration:

```
MILVUS_HOST=<milvus-service-host-name>
MILVUS_PORT=<milvus-service-port>
MILVUS_SERVER_NAME=localhost
MILVUS_USER=<milvus-connection-username>
MILVUS_PASSWORD=<milvus-connection-password>
```

---


### Setup Virtual Environment

```bash
pyenv install 3.11
pyenv global 3.11

virtualenv venv -p python3.11
source venv/bin/activate
```

### Install Dependencies

Option 1: Using pip-tools

```bash
pip install --upgrade pip
pip install pip-tools

# Create requirements.in with needed libraries, then:
pip-compile requirements.in
pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

Option 2: Install manually

```bash
pip install python-dotenv fastapi uvicorn jupyterlab matplotlib cachetools \
    "ibm-watsonx-ai>=0.2.6" langchain langchain_experimental langchain-community \
    langchain_ibm sentence-transformers "pydantic>=1.10.0" langchain_openai \
    evaluate rouge_score sacrebleu chromadb chroma-migrate transformers wget PyPDF2 \
    "unstructured[local-inference]" spacy from-root ibm-watson-machine-learning \
    text-extensions-for-pandas tabula-py "unstructured[pdf]"
```

Download the spaCy model:

```bash
python -m spacy download en_core_web_sm
```

### Run the Application

```bash
cd app
uvicorn main:app --reload
```

Visit: [http://localhost:8000/](http://localhost:8000/)

---

### Setup Default RAG

Visit: [http://localhost:8000/docs](http://localhost:8000/docs)

In the Swagger UI (`/docs`):
 - Make sure the COS Bucket has public access and CORS enabled with * 
  - Upload below 2 files to COS bucket
    - [IBM_Annual_Report_2022.pdf](./docs/other/IBM_Annual_Report_2022.pdf)
    - [IBM_Annual_Report_2022.parquet](./docs/other/IBM_Annual_Report_2022.parquet)
  - Go to backend URL
    - for example: http://localhost:8000/docs
    - Authorize the API calls by clicking on the **Authorize** button
      - Use value of "API_KEY" in your .env file
  - Execute `POST call (/api/rag/default)` with following payload

```json
{
  "loader": "IBMDoclingLoader",
  "splitter": "CustomHierarchicalChunker",
  "table_extractor": "DOCLING",
  "image_md_config": {},
  "chunk_size": 512,
  "chunk_overlap": 30,
  "chunk_separator": " ",
  "split_at": "HEADER",
  "do_ocr": false,
  "do_table_structure": true,
  "do_cell_matching": true,
  "vectordb_config": {
    "db_name": "MILVUSDB",
    "embedding_model": "BAAI/bge-small-en-v1.5",
    "collection_name": "IBM_Annual_Report_2022",
    "replace": true,
    "response_mode": "tree_summarize"
  },
  "audit": {
    "user_id": "string"
  }
}
```

---

## Frontend Setup (Carbon Angular)

### Prerequisites

* [npm](https://www.npmjs.com/) (`brew install npm`)
* [git](https://git-scm.com/) (`brew install git`)
* [angular-cli](https://cli.angular.io/) (`sudo npm install -g @angular/cli`)

```bash
brew install npm git
sudo npm install -g @angular/cli
```

### Clone and Install

```bash
git clone https://github.com/carbon-design-system/carbon-angular-starter.git
cd carbon-angular-starter
npm install
```

### Run Development Server

```bash
npm run start
```

Navigate to: [http://localhost:4200](http://localhost:4200)

---

