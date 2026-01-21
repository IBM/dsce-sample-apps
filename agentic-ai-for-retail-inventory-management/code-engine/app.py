#######################################
# Importamos las librerías necesarias #
####################################### 
import uvicorn
from fastapi.responses import StreamingResponse,JSONResponse
from fastapi import FastAPI
import json
import time
import uuid
import pandas as pd
import sqlite3, os, joblib
from datetime import datetime
from joblib import Parallel, delayed

from fastapi import BackgroundTasks, HTTPException
from typing import Dict, Any
from dotenv import load_dotenv
from typing import List, Optional, Literal, AsyncGenerator
import asyncio
# FastAPI imports
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Your agent creation functions
from agents.sql_agent import create_sql_agent
from agents.reorder_agent import create_reorder_agent
from forecasting import get_predicted_forecast
from app.services.data_service import load_data_from_retail_analytics_db
from oos_prediction_new import (
    predict_oos_and_days_until_oos,
    check_oos_with_forecast,
    train_days_until_oos_regressor,
    train_oos_classifier
)
from app.services.embedding_service import (
    TextEmbeddingModel,
    construct_customer_profiles,
)
from app.services.clustering_service import (
    cluster_customers,
    cluster_skus,
)


from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from app.agents.ingestion import read_sales_csv
from app.agents.forecasting import forecast_sales
from app.agents.reorder import apply_reorder_trigger
from app.agents.optimizer import optimize_reorder_plan
from app.db import get_connection, create_forecast_table, save_forecast_df
from contextlib import asynccontextmanager

# from app.services.data_service import load_data
from app.services.supplier_service import compute_supplier_reliability
from app.services.feature_engineering_service import engineer_features
from app.services.embedding_service import (
    TextEmbeddingModel,
    construct_customer_profiles,
)
from app.services.clustering_service import (
    cluster_customers,
    cluster_skus,
)
from app.services.model_service import train_model, predict_propensity
from app.config.cluster_info import (
    customer_cluster_explanations,
    sku_cluster_explanations,
)
from app.services.model_service import train_model, predict_propensity
from typing import Any, Dict, List, Optional
import pandas as pd
import traceback
from app.schemas import (
    PredictRequest,
    PredictResponse,
    TrainRequest
)
from app.db import (
    get_connection,
    create_forecast_table,
    save_forecast_df,
    save_predictions_to_retail_analytics,
    get_retail_analytics_connection,
    update_customer_clusters_in_retail_analytics,
    update_products_in_retail_analytics
)
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("startup")
train_logger = logging.getLogger("training")

#####################################################

##########
# Set Up #
########## 


DB_PATH = os.getenv("DB_PATH", "data/retail_analytics.db")



from contextlib import asynccontextmanager
import asyncio

def _training_done_callback(task: asyncio.Task):
    try:
        task.result()
        train_logger.info("🎉 Startup training task completed successfully")
    except Exception:
        train_logger.exception("💥 Startup training task failed")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("✅ App startup started")

    # DB init
    conn = get_connection(DB_PATH)
    create_forecast_table(conn)
    conn.close()
    logger.info("✅ Forecast table ensured")

    # 1) reset clusters on startup
    try:
        reset_new_customers_logic()
        logger.info("✅ reset_new_customers completed on startup")
    except Exception:
        logger.exception("❌ reset_new_customers failed on startup")

    # 2) train on startup (non-blocking)
    req = TrainRequest(
        embed_dim_product=16,
        embed_dim_customer=16,
        model_path="models/"
    )

    async def startup_train():
        # run_training is sync/heavy, run it in a thread so event loop won't block
        await asyncio.to_thread(run_training, req)

    train_logger.info("🚀 Scheduling startup training task...")
    task = asyncio.create_task(startup_train())
    task.add_done_callback(_training_done_callback)

    yield

    logger.info("🛑 App shutting down")


load_dotenv()
# Initialize main FastAPI app
app = FastAPI(
    title="Retail Use Case Api", 
    description="API for agents related to a retail use case.",
    version="1.0.0",
    lifespan=lifespan
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
    "sql_agent": create_sql_agent(),
    "reorder_agent": create_reorder_agent(),
}
DEFAULT_AGENTS_LIST = list(agent_executors.keys())
DEFAULT_AGENT_NAME = "sql_agent"


async def pretrain_models():
    try:
        print("🚀 Startup training triggered...")
        logger.info("📌 pretrain_models started")
        # build default TrainRequest
        req = TrainRequest(
            embed_dim_product=16,
            embed_dim_customer=16,
            model_path="models/"
        )

        # call the same function used in endpoint
        await train_endpoint(req=req, background_tasks=BackgroundTasks())

        print("✅ Startup training queued successfully")
        logger.info("📌 pretrain_models ended")

    except Exception as e:
        print(f"❌ Startup training failed: {e}")


# --- DB connection ---
def get_connection(db_name):
    return sqlite3.connect(db_name)

def get_data(sku=None):
    conn = get_connection("data/retail_analytics.db")
    sales_df = pd.read_sql_query("SELECT * FROM sales;", conn)
    campaigns_df = pd.read_sql_query("SELECT * FROM campaigns;", conn)
    inventory_df = pd.read_sql_query("SELECT * FROM products;", conn)
    conn.close()
    return sales_df, campaigns_df, inventory_df

class Message(BaseModel):
    role: str="user"#Literal["user", "assistant", "system"]
    content: str
    
class ExtraBody(BaseModel):
    thread_id: Optional[str] = None

class ChatRequest(BaseModel):
    model: Literal["sql_agent","reorder_agent"] = "sql_agent"
    messages: List[Message]
    stream: Optional[bool] = False
    extra_body: Optional[ExtraBody] = None


class MessageResponse(BaseModel):
    role: str
    content: str

class Choice(BaseModel):
    index: int
    message: MessageResponse
    finish_reason: str

class ChatCompletionResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[Choice]

# --- Request schema ---
class ForecastRequest(BaseModel):
    start_date: str
    sku_ids: list[str] = []
    store_ids: list[str] = []
    n: int = 30


#######################################################################
# Definimos nuestros 2 endpoints estándar del protocolo Agent Connect #
####################################################################### 

#@router.get("/v1/agents")
@app.get("/v1/agents")
async def discover_agents():
    return {
        "agents": [
            {
                "name": "NL2SQL Agent",
                "id": "sql_agent", 
                "description": "A NL2SQL Agent that specializes in answering questions related to a retail database which includes inventory, orders, customers and the like",
                "provider": { "organization": "Your Organization", "url": "https://your-organization.com" },
                "version": "1.0.0",
                "documentation_url": "https://docs.example.com/sql-agent",
                "capabilities": { "streaming": True }
            },
            {
                "name": "Reorder Agent",
                "id": "reorder_agent", 
                "description": "An agent that helps with reordering stock and checking inventory levels.",
                "provider": { "organization": "Your Organization", "url": "https://your-organization.com" },
                "version": "1.0.0",
                "documentation_url": "https://docs.example.com/reorder-agent",
                "capabilities": { "streaming": True }
            }
        ]
    }

# Main chat completion endpoint
#@router.post("/v1/chat")
@app.post("/v1/chat")
async def chat_completions(
    request: ChatRequest,
    X_IBM_THREAD_ID: Optional[str] = Header(None, alias="X-IBM-THREAD-ID", description="Optional header to specify the thread ID"),
):
    """
    Main chat completion endpoint with dynamic agent selection.

    This is the primary gateway for interacting with all available retail agents.
    It routes the user's request to the appropriate specialized agent based on the
    `model` parameter specified in the request body. This allows for a single,
    consistent interface to access diverse functionalities, from complex database
    queries to interactive, multi-step workflows like inventory reordering.

    The endpoint maintains conversational context using a thread ID, enabling
    follow-up questions and stateful interactions.

    **Agent Selection:**
    - `model: "sql_agent"`: Routes to the Natural Language to SQL agent for querying
      the retail database.
    - `model: "reorder_agent"`: Routes to the workflow agent for managing inventory
      replenishment and purchase orders.

    Parameters
    ----------
    request : ChatRequest
        The request body containing the agent to use (`model`), the list of
        messages forming the conversation history, and a flag for streaming.
    X_IBM_THREAD_ID : Optional[str], header
        An optional thread ID to maintain conversation state across multiple requests.
        Can also be passed in `request.extra_body.thread_id`.

    Returns
    -------
    StreamingResponse | JSONResponse
        - If `stream=True`, returns a `text/event-stream` with Server-Sent Events
          (SSE) chunks for real-time updates.
        - If `stream=False`, returns a complete `ChatCompletionResponse` object
          in a single JSON payload.
    """
    thread_id = ''
    if X_IBM_THREAD_ID:
        thread_id = X_IBM_THREAD_ID
    if request.extra_body and request.extra_body.thread_id:
        thread_id = request.extra_body.thread_id

    agent_name = request.model or DEFAULT_AGENT_NAME
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
        result = agent_executor.invoke({"messages": messages}, config=config)
        
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
    

# just in case the agent selector isnt working
#@router.post("/v1/sql_agent")
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

    **Example capabilities:**
    - **Inventory Analysis:** "List all products with current stock below their reorder threshold."
    - **Sales Performance:** "What were the top 5 best-selling products last month?"
    - **Customer Insights:** "Show the total spend for customers in the 'loyal' segment."
    - **Supplier Information:** "Who is the supplier for 'Organic Green Tea' and what is their lead time?"

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
    


# just in case the agent selector isnt working
#@router.post("/v1/reorder_agent")
@app.post("/v1/reorder_agent")
async def chat_reorder_agent(
    request: ChatRequest,
    X_IBM_THREAD_ID: Optional[str] = Header(None, alias="X-IBM-THREAD-ID", description="Optional header to specify the thread ID for conversation memory."),
):
    """
    Interact with the Reorder Agent to manage inventory replenishment.

    This endpoint provides direct access to a stateful agent designed to guide
    users through the entire product reordering workflow. It is capable of
    identifying products that need replenishment, generating intelligent purchase
    order recommendations, allowing for interactive modifications, and finally,
    submitting the order.

    Parameters
    ----------
    request : ChatRequest
        The request body. The `model` field is ignored. The `messages` list
        contains the user's commands for managing the reorder process.
    X_IBM_THREAD_ID : Optional[str], header
        A required thread ID to maintain the state of the draft purchase order
        across multiple requests in the workflow.

    Returns
    -------
    StreamingResponse | JSONResponse
        - If `stream=True`, returns a `text/event-stream` with the agent's responses.
        - If `stream=False`, returns a complete `ChatCompletionResponse` JSON object.
    """
    thread_id = ''
    if X_IBM_THREAD_ID:
        thread_id = X_IBM_THREAD_ID
    if request.extra_body and request.extra_body.thread_id:
        thread_id = request.extra_body.thread_id

    agent_name = "reorder_agent"
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


########################
# Funciones Auxiliares #
######################## 

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
            "model": DEFAULT_AGENT_NAME,
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





# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Retail Use Case API",
        "version": "1.0.0",
        "endpoints": {
            "chat": "/v1/chat",
            "sql_agent": "/v1/sql_agent",
            "reorder_agent": "/v1/reorder_agent",
            "docs": "/docs"
        }
    }
def load_or_train_oos_models(oof_df,n):
    reg_path = f"models_forecast/oos_regressor_{n}.pkl"
    clf_path = f"models_forecast/oos_clf_{n}.pkl"

    if os.path.exists(reg_path):
        reg = joblib.load(reg_path)
    else:
        reg, _, _, _ = train_days_until_oos_regressor(oof_df,n)
        joblib.dump(reg, reg_path)

    if os.path.exists(clf_path):
        clf = joblib.load(clf_path)
    else:
        clf, _, _, _ = train_oos_classifier(oof_df,n)
        joblib.dump(clf, clf_path)

    return clf, reg


def get_forecast_values(start_date, store_ids=None, sku_ids=None, n=30):
    store_ids = store_ids or []

    sales_df, campaigns_df, inventory_df = get_data()
    propensity_df = pd.read_csv("data/propensity_output.csv")


    preds_df=get_predicted_forecast(inventory_df,sales_df,campaigns_df,propensity_df,start_date,n,sku_ids,store_ids)
    preds_df.rename(columns={"date": "sale_date"}, inplace=True)
    preds_df["date_added"] = datetime.now()
    oof_df = check_oos_with_forecast(inventory_df, preds_df,n)
    clf, reg = load_or_train_oos_models(oof_df,n)
    df_predictions = predict_oos_and_days_until_oos(
        inventory_df, preds_df, clf, reg, n,sku_ids,store_ids
    )

    preds_df.rename(columns={"forecasted_sales": "demand"}, inplace=True)
    df_predictions["date_added"] = datetime.now()
    df_predictions.rename(
        columns={"days_until_oos": "oos_days", "will_go_oos": "oos"}, inplace=True
    )

    # -------------------------
    # Write once
    # -------------------------
    with sqlite3.connect("data/retail_analytics.db") as conn:
        df_predictions.to_sql("out_of_stock", conn, if_exists="append", index=False)
        preds_df.to_sql("demand_forecast_new", conn, if_exists="append", index=False)

    preds=preds_df.copy()
    oos=df_predictions.copy()
    oos=oos.sort_values(by=["predicted_days_until_oos"],ascending=True)
    oos=oos[oos['predicted_oos']==True]
    print(oos)
    oos_skus=oos['sku_id'].values.tolist()
    oos_store=oos['store_id'].values.tolist()
    preds=preds[(preds['sku_id'].isin(oos_skus))&(preds['store_id'].isin(oos_store))]
    print(len(preds),len(preds_df))
    return preds, oos



@app.post("/forecast")
def forecast_api(request: ForecastRequest):
    print("573",request.start_date)
    try:
        if not request.start_date:
            raise HTTPException(status_code=400, detail="start_date is required")

        start_date = pd.to_datetime(request.start_date)
        preds_df, oos_predictions = get_forecast_values(
            start_date, store_ids=request.store_ids,sku_ids=request.sku_ids, n=request.n
        )

        if preds_df.empty:
            return {"message": "No forecasts found for given filters"}

        return {
            # "forecast": preds_df.to_dict(orient="records"),
            "oos_prediction": oos_predictions.to_dict(orient="records"),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
############# Aditya branch main.py is here ##################

# -----------------------------------------------------------------------------
# Global state for trained objects
# These will be populated when the /train endpoint is invoked
# -----------------------------------------------------------------------------
EMBEDDING_MODEL: Optional[TextEmbeddingModel] = None
MODEL: Optional[Any] = None  # fitted sklearn Pipeline
KMEANS_CUST: Optional[Any] = None  # fitted KMeans for customers
SCALER_CUST: Optional[Any] = None  # fitted StandardScaler for customer clustering
KMEANS_SKU: Optional[Any] = None  # fitted KMeans for skus
SCALER_SKU: Optional[Any] = None  # fitted StandardScaler for sku clustering


def run_training(req: TrainRequest):
    train_logger.info("🚀 Training started")
    global EMBEDDING_MODEL, MODEL, KMEANS_CUST, SCALER_CUST, KMEANS_SKU, SCALER_SKU

    import time, joblib
    start_time = time.time()

    # Load raw datasets
    data = load_data_from_retail_analytics_db()
    supplier_rel = compute_supplier_reliability(data["reorders"])
    sales_df = engineer_features(data, supplier_rel)

    # Save engineered features
    try:
        conn_feat = get_retail_analytics_connection()
        sales_df.to_sql("engineered_features", conn_feat, if_exists="replace", index=False)
        conn_feat.close()
    except Exception as e:
        train_logger.exception("❌ Failed to persist engineered features")
        raise

    # Customer profiles
    sales_df["cust_profile"] = construct_customer_profiles(sales_df)

    # Embeddings
    embedding_model = TextEmbeddingModel(
        n_components_product=req.embed_dim_product,
        n_components_customer=req.embed_dim_customer,
    )
    embedding_model.fit(
        product_texts=sales_df["product_details"],
        customer_texts=sales_df["cust_profile"],
    )
    prod_embs, cust_embs = embedding_model.transform(
        sales_df["product_details"], sales_df["cust_profile"]
    )

    # Append embeddings
    for i in range(prod_embs.shape[1]):
        sales_df[f"prod_emb_{i}"] = prod_embs[:, i]
    for i in range(cust_embs.shape[1]):
        sales_df[f"cust_emb_{i}"] = cust_embs[:, i]

    sales_df = sales_df.drop(columns=["product_details", "cust_profile"], errors="ignore")

    # Clustering
    cust_labels, best_k_c, kmeans_c, scaler_c = cluster_customers(sales_df, cust_embs)
    sales_df["cust_cluster"] = sales_df["customer_id"].map(cust_labels)

    sku_labels, best_k_s, kmeans_s, scaler_s = cluster_skus(sales_df, prod_embs)
    sales_df["sku_cluster"] = sales_df["sku_id"].map(sku_labels)

    # Save models in memory
    EMBEDDING_MODEL = embedding_model
    KMEANS_CUST, SCALER_CUST = kmeans_c, scaler_c
    KMEANS_SKU, SCALER_SKU = kmeans_s, scaler_s

    train_logger.info("📌 Starting propensity model training...")
    model, metrics, best_params = train_model(sales_df, "fulfilled_flag", req.model_path)
    MODEL = model

    # Save to disk
    model_path = "models/"
    joblib.dump(model, f"{model_path}/propensity.pkl")
    joblib.dump(embedding_model, f"{model_path}/propensity_embedding.pkl")
    joblib.dump(scaler_c, f"{model_path}/scaler_customer.pkl")
    joblib.dump(scaler_s, f"{model_path}/scaler_skus.pkl")
    joblib.dump(kmeans_c, f"{model_path}/kmeans_c.pkl")
    joblib.dump(kmeans_s, f"{model_path}/kmeans_s.pkl")

    training_time = time.time() - start_time
    train_logger.info(f"✅ Training finished in {training_time:.2f} seconds")
    train_logger.info(f"📊 Metrics: {metrics}")


@app.post("/train")
async def train_endpoint(req: TrainRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Trigger async training in the background and return immediately."""

    def _task_wrapper():
        try:
            run_training(req)
        except Exception:
            train_logger.exception("❌ Training failed")

    background_tasks.add_task(_task_wrapper)
    return {"message": "Training started in background"}


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest) -> PredictResponse:
    """Predict propensity scores for arbitrary sales records.

    This endpoint requires that the ``/train`` endpoint has been called at least
    once in order to have a trained model and associated embedding and
    clustering transformers. Incoming records are minimally validated and
    transformed to match the feature schema expected by the model. Missing
    fields will be imputed according to the preprocessing pipeline defined
    during training.

    Parameters
    ----------
    req : PredictRequest
        Request containing a list of records to score.

    Returns
    -------
    PredictResponse
        List of propensity scores keyed by their corresponding identifiers.
    """
    MODEL=joblib.load("models/propensity.pkl")
    EMBEDDING_MODEL=joblib.load("models/propensity_embedding.pkl")
    SCALER_CUST=joblib.load(f"models/scaler_customer.pkl")
    SCALER_SKU=joblib.load(f"models/scaler_skus.pkl")
    KMEANS_CUST=joblib.load(f"models/kmeans_c.pkl")
    KMEANS_SKU=joblib.load(f"models/kmeans_s.pkl")
    if MODEL is None or EMBEDDING_MODEL is None:
        raise HTTPException(status_code=400, detail="Model has not been trained yet")

    # Convert input records to DataFrame

    # Load raw datasets
    data = load_data_from_retail_analytics_db()

    # Compute supplier reliability
    supplier_rel = compute_supplier_reliability(data["reorders"])

    # Merge and engineer deterministic features
    sales_df = engineer_features(data, supplier_rel)
    df_new=sales_df.copy()
    if req.sku_ids or req.customer_ids:
        if req.sku_ids:
            df_new=df_new[df_new['sku_id'].isin(req.sku_ids)]
        if req.customer_ids:
            df_new=df_new[df_new['customer_id'].isin(req.customer_ids)]

        df_new.to_csv("testing_predict.csv")

    elif req.full_data:
        try:
            conn_feat = get_retail_analytics_connection()
            df_new = pd.read_sql_query("SELECT * FROM engineered_features", conn_feat)
            conn_feat.close()
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to load engineered features: {str(e)}"
            )
        raw_records = df_new.to_dict(orient="records")

    else:
        raise HTTPException(
            status_code=400, detail="Set full_data=true`."
        )
    
    print ("Testing")
    print(df_new)

    # Check for identifiers
    if "customer_id" not in df_new.columns or "sku_id" not in df_new.columns:
        raise HTTPException(
            status_code=400,
            detail="Each record must contain at least 'customer_id' and 'sku_id' keys",
        )
    
    
    # df_new=df_new['']
    # Ensure numeric mappings exist for usage_freq and loyalty if provided
    usage_map = {"Low": 0, "Medium": 1, "High": 2}
    loyalty_map = {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}
    if "usage_freq" in df_new.columns:
        df_new["usage_freq_num"] = df_new["usage_freq"].map(usage_map)
    else:
        df_new["usage_freq_num"] = 0
    if "loyalty" in df_new.columns:
        df_new["loyalty_num"] = df_new["loyalty"].map(loyalty_map)
    else:
        df_new["loyalty_num"] = 0

    # Construct customer profiles and compute embeddings
    df_new["cust_profile"] = construct_customer_profiles(df_new)
    prod_embs_new, cust_embs_new = EMBEDDING_MODEL.transform(
        product_texts=df_new.get("product_details", pd.Series([""] * len(df_new))),
        customer_texts=df_new["cust_profile"],
    )
    for i in range(prod_embs_new.shape[1]):
        df_new[f"prod_emb_{i}"] = prod_embs_new[:, i]
    for i in range(cust_embs_new.shape[1]):
        df_new[f"cust_emb_{i}"] = cust_embs_new[:, i]

    # Assign cluster labels using stored kmeans models and scalers
    # Customer clustering
    # Build feature matrix for clustering: purchase_frequency, total_spend, usage_freq_num, loyalty_num and customer embeddings
    cust_feat_cols = [
        "purchase_frequency",
        "total_spend",
        "usage_freq_num",
        "loyalty_num",
    ]
    # Fill missing numeric values with zeros
    cust_features = df_new[cust_feat_cols].fillna(0)
    # Append embeddings for customers
    cust_emb_cols = [f"cust_emb_{i}" for i in range(cust_embs_new.shape[1])]
    cust_features = pd.concat([cust_features, df_new[cust_emb_cols]], axis=1)
    # Scale using training scaler
    cust_scaled = SCALER_CUST.transform(cust_features)
    cust_cluster_labels = KMEANS_CUST.predict(cust_scaled)
    df_new["cust_cluster"] = cust_cluster_labels
    # SKU clustering
    sku_feat_cols = [
        "current_stock",
        "reorder_threshold",
        "cost_price",
    ]
    sku_features = df_new[sku_feat_cols].fillna(0)
    sku_emb_cols = [f"prod_emb_{i}" for i in range(prod_embs_new.shape[1])]
    sku_features = pd.concat([sku_features, df_new[sku_emb_cols]], axis=1)
    sku_scaled = SCALER_SKU.transform(sku_features)
    sku_cluster_labels = KMEANS_SKU.predict(sku_scaled)
    df_new["sku_cluster"] = sku_cluster_labels

    # Prepare final feature set by dropping raw text and unused columns
    df_new = df_new.drop(columns=["product_details", "cust_profile"], errors="ignore")

    # Identify columns used during training
    # Remove any extraneous columns not seen during training pipeline
    # We assume MODEL has feature names extracted from its preprocessor; if not available we
    # simply pass all columns to prediction
    # For consistency, we fill missing numeric and categorical values per pipeline
    # Predictions will be handled by MODEL's internal preprocessing
    propensity_scores = predict_propensity(MODEL, df_new)
    print("DF_New",df_new)
    # Build response entries
    preds = []
    for idx, score in enumerate(propensity_scores):
        record = df_new.iloc[idx]

        preds.append(
    {
        "customer_id": record["customer_id"],
        "sku_id": record["sku_id"],
        "propensity_score": float(score),
        "customer_cluster": int(record["cust_cluster"]),
        "cluster_description": customer_cluster_explanations.get(
            int(record["cust_cluster"]), "No explanation available"
        ),
        "sku_cluster": int(record["sku_cluster"]),
        "sku_description": sku_cluster_explanations.get(
            int(record["sku_cluster"]), "No explanation available"
        ),
    }
)


    # --- Handle output storage depending on mode ---
    # if req.records or req.full_data:
    try:
            with get_retail_analytics_connection() as conn:
            # if req.records:
                save_predictions_to_retail_analytics(conn, preds)
                update_customer_clusters_in_retail_analytics(conn, preds)
                update_products_in_retail_analytics(conn,preds)

            # if req.full_data:
                # save_predictions_to_retail_analytics(conn, preds)
                # update_customer_clusters_in_retail_analytics(conn, preds)

    except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Database operation failed: {str(exc)}"
            )
    print("967",len(preds))
    if req.full_data:
        preds = sorted(preds, key=lambda x: x["propensity_score"], reverse=True)[:20]
    return PredictResponse(predictions=preds)
##############################################################


# @app.get("/propensity")
# def get_propensity_scores()

# ###hardcode remove items 
# @app.get("/reset_new_customers")
# def reset_new_customers():
#     try:
#         conn = sqlite3.connect("data/retail_analytics.db")
#         conn.execute("""UPDATE customers SET cluster_info = 'unavailable' WHERE customer_id IN (SELECT customer_id FROM (SELECT T1.customer_id FROM customers AS T1 INNER JOIN sales AS T2 ON T1.customer_id = T2.customer_id ORDER BY T2.sale_date DESC LIMIT 10))"""); 
#         conn.commit()
#         return {"status": "success", "message": "Cluster info reset for latest 10 customers"}
    
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

def reset_new_customers_logic():
    conn = sqlite3.connect("data/retail_analytics.db")
    conn.execute("""
        UPDATE customers 
        SET cluster_info = 'unavailable' 
        WHERE customer_id IN (
            SELECT customer_id FROM (
                SELECT T1.customer_id 
                FROM customers AS T1 
                INNER JOIN sales AS T2 
                    ON T1.customer_id = T2.customer_id 
                ORDER BY T2.sale_date DESC 
                LIMIT 10
            )
        )
    """)
    conn.commit()
    conn.close()


@app.get("/reset_new_customers")
def reset_new_customers():
    try:
        reset_new_customers_logic()
        return {"status": "success", "message": "Cluster info reset for latest 10 customers"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)