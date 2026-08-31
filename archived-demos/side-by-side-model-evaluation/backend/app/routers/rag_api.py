import logging
from typing import List
import copy
# import requests
import asyncio
import threading

from main import app, Depends, get_api_key
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, UploadFile, HTTPException, BackgroundTasks


from models.common import Task
from routers.common import Checker, ServiceException, ParseDocumentsPayload, FetchContextPayload
from models.rag_model import RagConfig, LoadSelectionEnum, SourceNode, VectorDBEnum
from services.services_factory import ServicesFactory
from services.rag.rag_service import RAGService
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

async def long_running_task(task: Task, saved_files):
    logger.debug(f"IN long_running_task, ragConfig: {task.data}")
    # result = "some_result"
    # requests.post(callback_url, json={"result": result})
    try:
        if task and task.data:
            ragConfig = task.data
            utils = ServicesFactory.get_common_utils()
            if isinstance(ragConfig, RagConfig):
                ragConfig = ragConfig.model_dump(mode="json") 
            rag_service: RAGService = ServicesFactory.get_rag_service()
            await rag_service.load_docs_in_db(saved_files, ragConfig)
            if task.audit is not None and 'user_id' in task.audit:
                await ServicesFactory.get_ws_service().send_message(client_id=task.audit['user_id'], message="Document Upload Task Completed !")
            utils.delete_task(task.uid)
    except Exception as err:
        logger.error(err)
        if task and task.uid:
            utils.delete_task(task.uid)
        raise HTTPException(status_code=404, detail=f"Some Error while loading and parsing document, TaskID: {task.uid}")
    
def run_async_in_thread(task: Task, saved_files):
    # asyncio.run(long_running_task(task, saved_files))
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(long_running_task(task, saved_files))
    loop.close()

@router.post("/api/rag/default", tags=["RAG"], summary="Setup Default RAG for Application")
async def default_setup(api_key_valid: bool = Depends(get_api_key), ragConfig: RagConfig = None):                    
    try:
        # logger.debug(f"\n\n ------ IN RAG_API.showSourceOnPage, sourceNode: {sourceNode} -------- \n\n")
        rag_service: RAGService = ServicesFactory.get_rag_service()
        if ragConfig is None:
            ragConfig: RagConfig = RagConfig()

        return await rag_service.default_setup(ragConfig)
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)
    
@router.post("/api/rag/upload", tags=["RAG"], summary="Upload files for RAG")
async def uploadFiles(files: List[UploadFile], api_key_valid: bool = Depends(get_api_key), 
            ragConfig: RagConfig = Depends(Checker(RagConfig)), worker: BackgroundTasks = None):                    
    try:
        logger.info(f"\n\n-------- IN RAG_API.uploadFiles Type: ragConfig: {ragConfig}----------\n\n")
        if isinstance(ragConfig, RagConfig):
            ragConfig = ragConfig.model_dump(mode="json") 
        # prefix = f"{ragConfig['vectordb_config']['db_name']}/{ragConfig['vectordb_config']['collection_name']}"
        # utils = ServicesFactory.get_common_utils()
        # savedFiles = await utils.upload_files(files=files, prefix=prefix)
        cos = ServicesFactory.get_cos_service()
        savedFiles = await cos.upload_files(files=files)
        logger.info(f"------------ Files saved in folder: {savedFiles} ------- \n\n")
        return savedFiles
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)

@router.post("/api/rag/load", tags=["RAG"], summary="Load and parse documents for RAG")
async def load_documents(api_key_valid: bool = Depends(get_api_key), payload: ParseDocumentsPayload = None, worker: BackgroundTasks = None):                    
    try:
        logger.info(f"\n\n-------- IN RAG_API.load_documents Type: ParseDocumentsPayload: {payload}----------\n\n")
        if payload is None or payload.ragConfig is None or payload.savedFiles is None:
            raise HTTPException(status_code=402, detail="Invalid Payload")
        if isinstance(payload.ragConfig, RagConfig):
            ragConfig = payload.ragConfig.model_dump(mode="json") 
        task: Task = None
        if worker and ragConfig and payload.savedFiles:
            task: Task = ServicesFactory.get_common_utils().create_task(ragConfig, ragConfig['audit'])
            thread = threading.Thread(target=run_async_in_thread, args=(task, copy.deepcopy(payload.savedFiles)))
            thread.start()
            # thread.join()
            # run_in_threadpool(long_running_task, task, copy.deepcopy(payload.savedFiles))            
            # worker.add_task(long_running_task, task, copy.deepcopy(payload.savedFiles)) 

            # await asyncio.to_thread(run_async_in_thread, task, copy.deepcopy(payload.savedFiles))
            
            # loop = asyncio.get_event_loop()
            # running_task = loop.create_task(long_running_task(task, copy.deepcopy(payload.savedFiles)))            
            # loop = asyncio.get_running_loop()
            # loop.run_in_executor(None, lambda: long_running_task(task, copy.deepcopy(payload.savedFiles)))            
        return task
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)

@router.post("/api/rag/fetch_context", tags=["RAG"], summary="Fetch Context using RAG")
async def fetchContext(api_key_valid: bool = Depends(get_api_key), 
                       payload: FetchContextPayload = None):   
    try:                 
        logger.info(f"\n\n ------ IN RAG_API.fetchContext: {payload} -------- \n\n") 
        rag_service: RAGService = ServicesFactory.get_rag_service()
        docs = await rag_service.fetch_context(payload=payload)
        # for ix, doc in enumerate(docs):
        #     print(f"\n\n{ix}) Text: {doc.text} \nScore: {doc.score}")
        return docs
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)


@router.post("/api/rag/reset", tags=["RAG"], summary="Reset RAG")
async def resetRag(api_key_valid: bool = Depends(get_api_key), ragConfig: RagConfig = None):  
    try:                  
        logger.info(f"\n\n ------ IN RAG_API.resetRag -------- \n\n")
        rag_service: RAGService = ServicesFactory.get_rag_service()
        # if ragConfig is None:
        #     ragConfig: RagConfig = app.utils.getFromCache("rag_config")
        return await rag_service.resetRag(ragConfig)
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)

@router.post("/api/rag/collections", tags=["RAG"], summary="Fetch VectorDB Collections")
async def fetchCollections(api_key_valid: bool = Depends(get_api_key), ragConfig: RagConfig = None):                    
    try:
        logger.info(f"\n\n ------ IN RAG_API.fetchCollections, ragConfig: {type(ragConfig)} -------- \n\n")
        rag_service: RAGService = ServicesFactory.get_rag_service()
        return await rag_service.fetch_collections(ragConfig=ragConfig)
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)

@router.delete("/api/rag/collections/{dbName}/{collection_name}", tags=["RAG"], summary="Delete VectorDB Collections")
async def deleteCollection(api_key_valid: bool = Depends(get_api_key), collection_name: str = None, dbName: VectorDBEnum = VectorDBEnum.MILVUSDB):                    
    try:
        logger.info(f"\n\n ------ IN RAG_API.deleteCollection, dbName: {dbName}, collection_name: {collection_name} -------- \n\n")
        rag_service: RAGService = ServicesFactory.get_rag_service()
        return await rag_service.delete_collection(collection_name, dbName)
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)
    
@router.post("/api/rag/source", tags=["RAG"], summary="Show source on page")
async def showSourceOnPage(api_key_valid: bool = Depends(get_api_key), sourceNode: SourceNode = None):                    
    try:
        # logger.debug(f"\n\n ------ IN RAG_API.showSourceOnPage, sourceNode: {sourceNode} -------- \n\n")
        rag_service: RAGService = ServicesFactory.get_rag_service()
        return await rag_service.showSourceOnPage(sourceNode=sourceNode)
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)
