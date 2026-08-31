from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import os
import uvicorn
from fastapi.responses import StreamingResponse
import uuid
import time
import json
import logging
import asyncio

from document_loader import DocumentProcessor
from agent import RAGQandAAgent

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Sales AI Ops Q&A API",
    description="A RAG-based Q&A chatbot API powered by watsonx.ai",
    version="1.0"
)

# Define request models
class Message(BaseModel):
    role: str
    content: str

class ExtraBody(BaseModel):
    thread_id: Optional[str] = None

class ChatCompletionRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "rag-agent"
    stream: Optional[bool] = False
    extra_body: Optional[ExtraBody] = None

# Global RAG agent instance
rag_agent = None


def initialize_rag_agent():
    """Initialize the RAG Q&A agent."""
    global rag_agent

    # Get watsonx credentials
    watsonx_credentials = {
        'apikey': os.getenv('WATSONX_APIKEY'),
        'url': os.getenv('WATSONX_URL'),
        'project_id': os.getenv('WATSONX_PROJECT_ID'),
        'llm_model': os.getenv('WATSONX_LLM_MODEL', 'meta-llama/llama-3-3-70b-instruct'),
        'embedding_model': os.getenv('WATSONX_EMBEDDING_MODEL', 'sentence-transformers/all-minilm-l6-v2')
    }

    # Get document path
    document_path = os.getenv("REPORT_DOC")

    logger.info("Initializing RAG Q&A Agent...")
    logger.info(f"Using LLM: {watsonx_credentials['llm_model']}")
    logger.info(f"Using Embeddings: {watsonx_credentials['embedding_model']}")

    # Initialize document processor
    if document_path:
        logger.info(f"Loading document: {document_path}")
        doc_processor = DocumentProcessor(
            watsonx_credentials=watsonx_credentials,
            document_path=document_path
        )
    else:
        logger.info("Loading all documents from docs/")
        doc_processor = DocumentProcessor(
            watsonx_credentials=watsonx_credentials,
            docs_dir="docs"
        )

    vectorstore = doc_processor.setup()

    # Initialize RAG agent
    rag_agent = RAGQandAAgent(vectorstore, watsonx_credentials)
    logger.info("RAG Agent initialized successfully!")


# Streaming function for RAG responses
async def get_rag_stream(messages: List[Message], model: str, thread_id: str):
    thread_id = thread_id or str(uuid.uuid4())
    user_message = messages[-1].content

    # Run RAG agent query
    response_content = await asyncio.to_thread(rag_agent.query, user_message)

    if not response_content:
        response_content = "I apologize, but I was unable to generate a response. Please try again."

    # Send single event with final response
    message_event = {
        "id": f"run-{str(uuid.uuid4())[:6]}",
        "object": "thread.message.delta",
        "thread_id": thread_id,
        "model": model,
        "created": int(time.time()),
        "choices": [{
            "delta": {
                "role": "assistant",
                "content": response_content
            }
        }]
    }
    yield f"event: thread.message.delta\ndata: {json.dumps(message_event)}\n\n"


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agent_ready": rag_agent is not None
    }


# Chat completions endpoint (watsonx Orchestrate compatible)
@app.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    X_IBM_THREAD_ID: Optional[str] = Header(None, alias="X-IBM-THREAD-ID")
):
    """
    OpenAI-compatible chat completions endpoint for watsonx Orchestrate.
    Uses RAG to answer questions based on loaded documents.
    """
    logger.info(f"Received POST /chat/completions")
    logger.info(f"Request: {request.model_dump_json()}")

    thread_id = X_IBM_THREAD_ID or (request.extra_body.thread_id if request.extra_body else None) or str(uuid.uuid4())
    logger.info(f"Thread ID: {thread_id}")

    if rag_agent is None:
        raise HTTPException(status_code=500, detail="RAG Agent not initialized")

    # Extract user message
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content.strip()
            break

    if not user_message:
        raise HTTPException(status_code=400, detail="No user message provided")

    # Print the chat question
    print("\n" + "="*80)
    print("CHAT QUESTION:")
    print("-"*80)
    print(user_message)
    print("="*80)

    if request.stream:
        return StreamingResponse(
            get_rag_stream(request.messages, request.model, thread_id),
            media_type="text/event-stream"
        )
    else:
        try:
            # Query the RAG agent
            response_content = await asyncio.to_thread(rag_agent.query, user_message)

            if not response_content:
                response_content = "I apologize, but I was unable to generate a response. Please try again."

            # Print the chat response
            print("\n" + "="*80)
            print("CHAT RESPONSE:")
            print("-"*80)
            print(response_content)
            print("="*80 + "\n")

            response_data = {
                "id": str(uuid.uuid4()),
                "object": "chat.completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response_content
                    },
                    "finish_reason": "stop"
                }]
            }
            return response_data

        except Exception as e:
            logger.error(f"Error processing question: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))


# Reset conversation endpoint
@app.post("/reset")
async def reset_conversation():
    """Reset the RAG agent conversation history."""
    if rag_agent is None:
        raise HTTPException(status_code=500, detail="RAG Agent not initialized")

    try:
        rag_agent.reset_conversation()
        return {
            "message": "Conversation reset successfully",
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Eval request model
class EvalRequest(BaseModel):
    question: str


# Eval endpoint - returns question, context, and response
@app.post("/eval")
async def eval_query(request: EvalRequest):
    """
    Evaluation endpoint that returns question, retrieved context, and response.
    Useful for evaluating RAG quality metrics.
    """
    if rag_agent is None:
        raise HTTPException(status_code=500, detail="RAG Agent not initialized")

    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="No question provided")

    # Print the eval question
    print("\n" + "="*80)
    print("EVAL QUESTION:")
    print("-"*80)
    print(question)
    print("="*80)

    try:
        # Query the RAG agent with context
        result = await asyncio.to_thread(rag_agent.query_with_context, question)

        # Print the eval response
        print("\n" + "="*80)
        print("EVAL CONTEXT:")
        print("-"*80)
        print(result["context"][:500] + "..." if len(result["context"]) > 500 else result["context"])
        print("="*80)
        print("\nEVAL RESPONSE:")
        print("-"*80)
        print(result["response"])
        print("="*80 + "\n")

        return {
            "question": result["question"],
            "context": result["context"],
            "response": result["response"]
        }

    except Exception as e:
        logger.error(f"Error processing eval question: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Initialize RAG agent before starting server
    initialize_rag_agent()
    uvicorn.run(app, host="0.0.0.0", port=5000)
