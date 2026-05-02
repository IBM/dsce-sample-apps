# Report Q&A Agent

A LangGraph-based intelligent agent that answers questions about health coverage policies using Retrieval-Augmented Generation (RAG).

## Features

- **Conversational Agent**: Natural, multi-turn conversations that remember context and previous questions
- **Customer Service Persona**: Friendly, helpful responses that explain insurance terms in plain language
- **Document Processing**: Automatically loads and processes PDF health coverage documents
- **Vector Search**: Uses FAISS for efficient semantic search across documents
- **LangGraph Agent**: Stateful agent that retrieves relevant information and provides accurate answers
- **Flexible Document Loading**: Use a single document or all documents in a directory
- **Source Attribution**: Answers reference the source documents

## Architecture

The agent uses:
- **LangGraph**: For building the stateful agent workflow
- **LangChain**: For document processing and retrieval
- **IBM watsonx.ai**: For embeddings and LLM inference
  - LLM: meta-llama/llama-3-1-70b-instruct (configurable)
  - Embeddings: ibm/slate.125m.english.rtrvr (configurable)
- **FAISS**: For vector storage and similarity search
- **PyPDF**: For PDF document parsing

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file with your IBM watsonx.ai credentials:

```bash
cp .env.example .env
```

Edit `.env` and configure the following:

```
# IBM watsonx.ai credentials (required)
WATSONX_APIKEY=your-watsonx-api-key
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your-project-id

# Model configuration (optional - defaults shown)
WATSONX_LLM_MODEL=meta-llama/llama-3-1-70b-instruct
WATSONX_EMBEDDING_MODEL=ibm/slate.125m.english.rtrvr

# Document configuration (optional)
REPORT_DOC=docs/Aetna-HDHP-Coverage.pdf
```

**Getting watsonx.ai credentials:**
1. Go to [IBM Cloud](https://cloud.ibm.com)
2. Create an API key: [IBM Cloud API Keys](https://cloud.ibm.com/iam/apikeys)
3. Create a watsonx.ai project and get the Project ID
4. URL depends on your region (e.g., us-south, eu-de, jp-tok)

**Configuration Options:**
- `WATSONX_APIKEY` (required): Your IBM Cloud API key
- `WATSONX_URL` (required): watsonx.ai service URL for your region
- `WATSONX_PROJECT_ID` (required): Your watsonx.ai project ID
- `WATSONX_LLM_MODEL` (optional): LLM model to use for responses
- `WATSONX_EMBEDDING_MODEL` (optional): Embedding model for document retrieval
- `REPORT_DOC` (optional): Path to a specific PDF document
  - If set: Only this document will be loaded for Q&A
  - If not set: All PDF files in the `docs/` directory will be loaded

### 3. Add Documents

Place your health coverage PDF documents in the `docs/` directory. The agent currently includes:
- Aetna-HDHP-Coverage.pdf
- english-sample-completed-sbc-accessible-format-012825.pdf
- final-sbc-and-clfs-from-naic.pdf

You can add additional PDF files to this directory.

**To use a specific document:** Set `REPORT_DOC` in your `.env` file to the path of the document you want to use.

## Usage

### Interactive Conversational Mode

Run the agent in interactive mode for natural, multi-turn conversations:

```bash
python main.py
```

The agent maintains conversation history, so you can ask follow-up questions naturally:

```
You: I'm trying to understand my new health plan - the HDHP option

Agent: I'd be happy to help you understand the High Deductible Health Plan!
The HDHP has some unique features that can seem confusing at first...

You: What's the deductible?

Agent: Your individual deductible is $3,400 for the year. That means you'll
pay the full cost of most medical services until you've spent $3,400...

You: So I have to pay everything before insurance covers anything?

Agent: Not exactly - and this is an important distinction! Preventive care
is fully covered with no deductible...
```

**Interactive Commands:**
- `quit` or `exit`: End the session
- `reset`: Start a new conversation (clears history)
- `help`: See example questions

The agent acts like a friendly customer service representative, remembering your previous questions and providing conversational, helpful answers.

### Single Query Mode

Ask a single question from the command line:

```bash
python main.py "What are the copays for primary care visits?"
```

### Example Conversation Starters

- I'm trying to understand my new health insurance plan
- What's the deductible and how does it work?
- What if I need to see my doctor?
- How much would an emergency room visit cost?
- Is preventive care covered?
- What about prescriptions?
- Do I need a referral to see a specialist?
- How important is it to stay in-network?
- Can I use a Health Savings Account with this plan?

**Tip:** Ask follow-up questions naturally - the agent remembers your conversation!

## Project Structure

```
.
├── agent.py              # LangGraph agent implementation
├── document_loader.py    # Document loading and vector store setup
├── main.py              # Main script and CLI
├── requirements.txt     # Python dependencies
├── .env.example        # Environment variable template
├── .env                # Your API keys (not in git)
├── docs/               # Health coverage PDF documents
└── README.md           # This file
```

## How It Works

1. **Document Loading**: The agent loads PDF files from the `docs/` directory (or a specific document)
2. **Chunking**: Documents are split into overlapping chunks for better retrieval
3. **Embedding**: Each chunk is embedded using IBM watsonx.ai embedding model (ibm/slate.125m.english.rtrvr)
4. **Vector Store**: Embeddings are stored in a FAISS index for fast search
5. **Query Processing**:
   - User asks a question
   - Agent searches for relevant document chunks using semantic similarity
   - Agent uses watsonx.ai LLM (Llama 3.1 70B) to generate an answer based on retrieved context
   - Answer is returned conversationally with source attribution

## Customization

### Change Models

Set different models in your `.env` file:

```bash
# Use a different LLM
WATSONX_LLM_MODEL=ibm/granite-13b-chat-v2

# Use a different embedding model
WATSONX_EMBEDDING_MODEL=ibm/slate.125m.english.rtrvr
```

**Available watsonx.ai LLM models:**
- `meta-llama/llama-3-1-70b-instruct` (default, recommended)
- `meta-llama/llama-3-1-8b-instruct` (faster, lower cost)
- `ibm/granite-13b-chat-v2`
- `mistralai/mixtral-8x7b-instruct-v01`

**Available embedding models:**
- `ibm/slate.125m.english.rtrvr` (default, optimized for retrieval)
- `ibm/slate.30m.english.rtrvr` (smaller, faster)
- `sentence-transformers/all-minilm-l12-v2` (alternative option)

### Adjust Chunk Size

In `document_loader.py`, modify the `DocumentProcessor` initialization:

```python
doc_processor = DocumentProcessor(
    watsonx_credentials=credentials,
    docs_dir="docs",
    chunk_size=1000,      # Increase for larger chunks
    chunk_overlap=200     # Adjust overlap
)
```

### Adjust Retrieval

In `document_loader.py`, change the number of retrieved documents:

```python
retriever = vectorstore.as_retriever(
    search_kwargs={"k": 4}  # Retrieve top 4 chunks
)
```

## Troubleshooting

### Missing API Key

```
Error: OPENAI_API_KEY not found in environment variables.
```

Solution: Create a `.env` file with your OpenAI API key.

### No Documents Found

```
ValueError: No PDF files found in 'docs'
```

Solution: Add PDF files to the `docs/` directory.

### Module Not Found

```
ModuleNotFoundError: No module named 'langgraph'
```

Solution: Install dependencies with `pip install -r requirements.txt`

