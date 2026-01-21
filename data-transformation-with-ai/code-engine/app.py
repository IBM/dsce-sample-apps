
import uvicorn
import asyncio
from fastapi.responses import StreamingResponse,JSONResponse
from fastapi import FastAPI
from typing import Dict, Any
from dotenv import load_dotenv
from typing import List, Optional, Literal, AsyncGenerator
from fastapi import APIRouter, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from pydantic import BaseModel
import time, os,json
import uuid

from agents.sql_agent import create_sql_agent


load_dotenv()
# Initialize main FastAPI app
app = FastAPI(
    title="Loan Support", 
    description="API for agents related to a retail use case.",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure according to your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent_executors = {
    "sql_agent": create_sql_agent()
}

class Message(BaseModel):
    role: str="user"#Literal["user", "assistant", "system"]
    content: str

class MessageResponse(BaseModel):
    role: str
    content: str

class Choice(BaseModel):
    index: int
    message: MessageResponse
    finish_reason: str

class ExtraBody(BaseModel):
    thread_id: Optional[str] = None

class ChatRequest(BaseModel):
    model: Literal["sql_agent"] = "sql_agent"
    messages: List[Message]
    stream: Optional[bool] = False
    extra_body: Optional[ExtraBody] = None

class ChatCompletionResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[Choice]


# Helper function to split text into chunks
def split_into_chunks(text, chunk_size=50):
    words = text.split()
    chunks = []
    current_chunk = []
    for word in words:
        current_chunk.append(word)
        if len(current_chunk) >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks

async def stream_response(agent_executor, messages, thread_id)-> AsyncGenerator[str, None]:
 
    # thinking_step = {
    #     "id": f"step-{uuid.uuid4()}", "object": "thread.run.step.delta", "thread_id": thread_id,
    #     "model": "langgraph-agent", "created": int(time.time()), "choices": [{"delta": {"role": "assistant",
    #     "step_details": {"type": "thinking", "content": "Analyzing the request..."}}}]}
    
    # yield f"event: thread.run.step.delta\n"
    # yield f"data: {json.dumps(thinking_step)}\n\n"
    
    # Execute the provided agent with streaming
    config = {"configurable": {"thread_id": thread_id}}
    
    # Get the agent's response using the passed agent_executor
    result = agent_executor.invoke({"messages": messages}, config=config)
    final_message = result["messages"][-1]
    
    # Stream the final message
    message_chunks = split_into_chunks(final_message.content)
    
    for i, chunk in enumerate(message_chunks):
        response_chunk = {
            "id": id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": "sql_agent",
            "choices": [
                {
                    "index": 0,
                    "delta": {"role": "assistant", "content": chunk},
                    "finish_reason": None
                }
            ]
        }
        yield f"data: {json.dumps(response_chunk)}\n\n"
        await asyncio.sleep(0.1)
    yield "data: [DONE]\n\n"

@app.post("/v1/sql_agent")

async def chat_sql_agent(
    request: ChatRequest,
    X_IBM_THREAD_ID: Optional[str] = Header(None, alias="X-IBM-THREAD-ID", description="Optional header to specify the thread ID for conversation memory"),
):
    """
    Query the retail database using natural language.

    This endpoint provides direct access to the NL2SQL Agent, which translates
    user questions into precise SQL queries against the retail database. It is
    designed for analytical and reporting tasks, enabling users to retrieve
    information about inventory, sales performance, customer behavior, and
    supplier data without writing any code.

    The agent can perform complex joins and aggregations across multiple tables
    to answer a wide range of business intelligence questions.


    Parameters
    ----------
    request : ChatRequest
        The request body. The `model` field is ignored as this endpoint is
        hardcoded to the sql_agent. The `messages` list should contain the user's
        natural language query.
    X_IBM_THREAD_ID : Optional[str], header
        An optional thread ID to maintain conversation state for follow-up questions.

    Returns
    -------
    StreamingResponse | JSONResponse
        - If `stream=True`, returns a `text/event-stream` with the agent's answer.
        - If `stream=False`, returns a complete `ChatCompletionResponse` JSON object.
    """
    
    thread_id = ''
    if X_IBM_THREAD_ID:
        thread_id = X_IBM_THREAD_ID
    if request.extra_body and request.extra_body.thread_id:
        thread_id = request.extra_body.thread_id

    agent_name = "sql_agent"
    agent_executor = agent_executors.get(agent_name)

    if not agent_executor:
        raise HTTPException(status_code=400, detail=f"Agent '{agent_name}' not found. Available agents: {list(agent_executors.keys())}")

    messages = []
    for msg in request.messages:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            messages.append(SystemMessage(content=msg.content))
    
    # Handle streaming
    if request.stream:
        # Pass the selected agent executor to the streaming function
        return StreamingResponse(
            stream_response(agent_executor, messages, thread_id),
            media_type="text/event-stream"
        )
    else:
        # Execute the selected agent
        config = {"configurable": {"thread_id": thread_id}}
        result = agent_executor.invoke({"messages": messages})
        
        final_message = result["messages"][-1]
        
        # Format the response
        id = str(uuid.uuid4())
        response = ChatCompletionResponse(
            id=id,
            object="chat.completion",
            created=int(time.time()),
            model=agent_name,
            choices=[
                Choice(
                    index=0,
                    message=MessageResponse(
                        role="assistant",
                        content=final_message.content
                    ),
                    finish_reason="stop"
                )
            ]
        )
        return JSONResponse(content=response.dict())
    


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
