import logging
from typing import Dict

from models.common import Task
from routers.common import PublishPayload, UpdateDBPayload
from main import Depends, get_api_key
from services.services_factory import ServicesFactory
from services.utils import CommonUtils
from fastapi import APIRouter, HTTPException

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

''' 
   Common API ROUTES 
'''

@router.post("/api/config/refresh", tags=["Common"], summary="Refresh App Configurations")
async def refresh_app(api_key_valid: bool = Depends(get_api_key)):
    # -------------- Invoke Business Logic here and get output --------------
    logger.info(f"\n\n------------- IN CommonApi.refresh_app ------------- ")
    utils: CommonUtils = ServicesFactory.get_common_utils()
    utils.setup_localdb()
    # logger.info(f"\n\nIN openaiGenerate with async False, OPENAI RESPONSE COMPLETED: >> {resp}\n\n")
    return {"result": "SUCCESS"}

@router.post("/api/config/db", tags=["Common"], summary="Update Config in DB")
async def update_db_config(api_key_valid: bool = Depends(get_api_key), payload: UpdateDBPayload = None):
    # -------------- Invoke Business Logic here and get output --------------
    logger.info(f"\n\n------------- IN CommonApi.update_db_config: payload {payload} ------------- ")
    if payload is None or payload.key is None or payload.data is None:
        raise HTTPException(status_code=302, detail="Invalid Payload, Key or Data cannot be null ! ")
    
    utils: CommonUtils = ServicesFactory.get_common_utils()
    utils.setInDB("wx_llm_specs", None)
    utils.setInDB(payload.key, payload.data)
    # logger.info(f"\n\nIN openaiGenerate with async False, OPENAI RESPONSE COMPLETED: >> {resp}\n\n")
    return {"result": "SUCCESS"}

@router.get("/api/tasks", tags=["Common"], summary="Fetch All Tasks")
async def all_tasks():                     
    try:
        logger.info(f"\n\n-------- IN CommonApi.all_tasks ----------\n\n") 
        tasks: Dict[str, Task] = ServicesFactory.get_common_utils().get_all_tasks()
        return tasks
    except Exception:
        raise HTTPException(status_code=302, detail="Invalid TaskId")

@router.get("/api/tasks/{task_id}", tags=["Common"], summary="Fetch Task Status")
async def task_details(task_id: str):                     
    try:
        logger.info(f"\n\n-------- IN Common_API.task_details task_id: {task_id}----------\n\n") 
        task: Task = ServicesFactory.get_common_utils().get_task(task_id)
        return task
    except Exception:
        raise HTTPException(status_code=302, detail="Invalid TaskId")
    

@router.post("/ws/{client_id}", tags=["RAG"], summary="Publish Message using WebSocket")
async def publish_message(api_key_valid: bool = Depends(get_api_key), client_id: str = None, payload: PublishPayload = None):  
    try:                  
        logger.info(f"\n\n ------ IN Common_API.publish_message: client_id: {client_id}, payload: {payload} -------- \n\n")
        if client_id is not None and payload is not None:
            return await ServicesFactory.get_ws_service().send_message(client_id=client_id, message=payload.data)
        else:
            return "NO client_id or message to publish"
    except Exception as err:
        raise HTTPException(status_code=302, detail="Error while publishing message to websocket")

        
    