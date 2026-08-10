
# import sys
import os
import json
import glob
from typing import NoReturn
# import asyncio
# from pathlib import Path
# from typing import Union

from httpx import AsyncClient, Client
import uvicorn
from dotenv import load_dotenv
import logging
from logging.config import dictConfig
# from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from fastapi.exception_handlers import http_exception_handler
from fastapi.websockets import WebSocket, WebSocketDisconnect
from fastapi import Depends, FastAPI, HTTPException, Request, Query, HTTPException
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from contextlib import asynccontextmanager

from models.rag_model import RagConfig
from services.utils import CommonUtils
from services.rag.rag_service import RAGService
from services.services_factory import ServicesFactory

# Allow CORS for local testing.

origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://localhost:4200",
    "https://compare-llms.140j8e66l875.us-east.codeengine.appdomain.cloud"
]

# Define tags to categorize APIs on SwaggerUI

tags_metadata = [
    {
        "name": "EESI_Biolerplate",
        "description": "EESI Biolerplate for Demos"
    },
    {
        "name": "Watsonx.ai",
        "description": "Working with watsonx.ai and LLMs"
    },
    {
        "name": "RAG",
        "description": "Boilerplate for RAG techniques"
    }
]

load_dotenv()

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__)  

# LOGLEVEL = os.environ.get('LOGLEVEL', 'WARNING').upper()
API_KEY = os.environ.get('API_KEY')

with open('config/app_config.json', 'r') as appConfig:
    appConfigFile = json.loads(appConfig.read())

@asynccontextmanager
async def lifespan(app: FastAPI):  
    try:
        os.environ["TOKENIZERS_PARALLELISM"] = "false"
        utils = CommonUtils()
        utils.checkDirectories()    
        utils.setup_localdb()   

        utils.setInCache('IBMCLOUD_API_KEY', os.environ.get('IBMCLOUD_API_KEY', None))
        utils.setInCache('WX_ENDPOINT', os.environ.get('WX_ENDPOINT', None))
        utils.setInCache('WX_PROJECT_ID', os.environ.get('WX_PROJECT_ID', None))
        utils.setInCache('MILVUS_ENDPOINT', os.environ.get('MILVUS_ENDPOINT', None))
        utils.setInCache('MILVUS_USER', os.environ.get('MILVUS_USER', None))
        # utils.setInUserCache('USER_SESSION', {})
        with open('config/rag_config.json', 'r') as ragConfig:
            ragConfigJson = json.loads(ragConfig.read())
            utils.setInCache("rag_config", ragConfigJson)
       
        logger.info(f"---------- APPLICATION STARTED ----------\n\n")
        # app.client = AsyncClient(timeout=30)
        app.client = Client(timeout=30)    
        # rag_service: RAGService = ServicesFactory.get_rag_service()
        # ragConfigJson = utils.getFromCache("rag_config")
        # ragConfig = RagConfig.model_validate(ragConfigJson)
        # await rag_service.resetRag(ragConfig) 
        # await rag_service.default_setup(ragConfig=ragConfig)
        # TODO   
        # collections = await rag_service.fetch_collections(ragConfig)
        # if collections is None or len(collections) == 0:
        #     defaultFiles = ["default/IBM_Annual_Report_2022.pdf"]
        #     await rag_service.load_docs_in_db(defaultFiles, ragConfig)
        yield

        # await app.client.close()
        app.client.close()
    finally:
        # Exit the application
        exit(0)

app = FastAPI(
    title=appConfigFile['title'],
    description=appConfigFile['description'],
    version=appConfigFile['version'],
    license_info=appConfigFile['license_info'],
    swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    openapi_version="3.0.2", # This version is compatable with Watsonx Assistant
    openapi_tags=tags_metadata,
    lifespan=lifespan
)

# async def get_client():
#     async with AsyncClient() as client:
#         yield client

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_scheme = APIKeyHeader(name="X-API-Key")

# def serve_frontend_app(app: FastAPI, build_dir: Union[Path, str]) -> FastAPI:
#     if isinstance(build_dir, str):
#         build_dir = Path(build_dir)

#     app.mount(
#         "/static/",
#         StaticFiles(directory=build_dir),
#         name="Frontend App static files",
#     )
#     templates = Jinja2Templates(directory=build_dir.as_posix())

#     @app.get("/{full_path:path}")
#     async def serve_frontend_app(request: Request, full_path: str):
#         return templates.TemplateResponse("index.html", {"request": request})

#     return app

# path_to_frontend_app_build_dir = "./static"
# app = serve_frontend_app(app, path_to_frontend_app_build_dir)

class AppStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            else:
                raise ex
            

DATASET_DIR = os.environ.get("DATASET_DIR")
VECTORDB_DIR = os.environ.get("VECTORDB_DIR")
if not os.path.exists(DATASET_DIR):
    os.makedirs(DATASET_DIR)
    print(f"\n\n{DATASET_DIR} CREATED \n")

if not os.path.exists(VECTORDB_DIR):
    os.makedirs(VECTORDB_DIR)
    print(f"\n\n{VECTORDB_DIR} CREATED \n")
else:
    print(f"\n\n{VECTORDB_DIR} EXISTS \n")

app.mount("/static", AppStaticFiles(directory="static", html=True), name="app")

templates = Jinja2Templates(directory="templates")

# app.mount("/static", StaticFiles(directory="static"), name="static", html=True)
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
app.mount("/datasets", StaticFiles(directory="datasets"), name="datasets")

def get_api_key(api_key: str = Depends(api_key_scheme)):
    logger.info(f"api_key={api_key}, API_KEY: {API_KEY}")
    if api_key == API_KEY:
        return True
    else:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
@app.get('/')
def root():
    with open('static/index.html', 'r') as file_index:
        html_content = file_index.read()
    return HTMLResponse(html_content, status_code=200)

@app.get("/docs/{dbname}/{collection_name}", response_class=HTMLResponse)
def list_files(request: Request, dbname: str = None, collection_name: str = None):
    # print(f"IN list_files: >> dbname: {dbname}, collection_name: {collection_name}")
    file_paths = []
    
    directory = "./datasets"
    if dbname is not None and collection_name is not None:
        directory += f"/{dbname}/{collection_name}"
    ignore = "chroma"
    for root, dirs, files in os.walk(directory, topdown=False):
        for file in files:
            if ignore not in file:                                 
                file_path = os.path.join(root, file)
                file_path = file_path.replace("./", "/")
                # file_paths.append(file_path)  
                file_paths.append(file_path)
    
    return templates.TemplateResponse(
        "list_files.html", {"request": request, "files": file_paths}
    )

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc):
    if not isinstance(request, WebSocket):
        return await http_exception_handler(request, exc)
    websocket = request
    if websocket.application_state == 1:  # 1 = CONNECTED
        await websocket.close(code=1008, reason=str(exc))  # 1008 = WS_1008_POLICY_VIOLATION
        return
    headers = getattr(exc, "headers") or []
    await websocket._send({"type": "websocket.http.response.start", "status": exc.status_code, "headers": headers})

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str) -> NoReturn:
    """
    Websocket for Pub/Sub functionality
    """
    try:
        # logger.info(f'WS: CONNECTING TO {websocket.url}, HDR = {websocket.headers}, PARAMS = {websocket.query_params} ...')
        logger.debug(f'WS: client_id {client_id}')
        
        ws_service = ServicesFactory.get_ws_service()
        
        if client_id is None:
            client_id = "message"
        await ws_service.connect(websocket=websocket, client_id=client_id)
    except WebSocketDisconnect:
        logger.info(f"\n\n-------- IN Common_API.websocket_endpoint client_id: {client_id} DISCONNECTED ----------\n\n") 
        ws_service.disconnect(client_id)

       

# def main():
# asyncio.run(main())

def include_routers():
    from routers import watsonx_api, openai_api, metrics_api, rag_api, auth_api, common_api
    app.include_router(common_api.router)
    app.include_router(auth_api.router)
    app.include_router(watsonx_api.router)
    app.include_router(openai_api.router)
    app.include_router(metrics_api.router)
    app.include_router(rag_api.router)

include_routers()

if __name__ == '__main__':
    # include_routers()    
    uvicorn.run(f"{__name__}:app", host="0.0.0.0", port=8000)

