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

Visit: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Setup Default RAG

In the Swagger UI (`/docs`):

- Click **Authorize** to authenticate
- Use the `POST /api/rag/default` endpoint with the following payload:

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