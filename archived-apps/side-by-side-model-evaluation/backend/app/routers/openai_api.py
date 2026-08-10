import json
import logging

from routers.common import ServiceException, VisionPayload, GeneratePayload
from main import Depends, get_api_key, Query
from services.services_factory import ServicesFactory
from services.utils import CommonUtils
from services.openai_service import OpenAI_Service
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, HTTPException

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

''' 
    API ROUTES 
    - Generative AI API routes
'''

@router.get("/api/openai/foundation_model_specs", tags=["OpenAI"], summary="Available LLMs in OpenAI")
async def fetchLLMSpecs(api_key_valid: bool = Depends(get_api_key), apikey: str = Query(default=None, description="OpenAI API Key")):
    # -------------- Invoke Business Logic here and get output --------------    
    logger.info(f"\n\n------------- IN OpenAIAPI.fetchLLMSpecs ------------- ")
    try:
        utils: CommonUtils = ServicesFactory.get_common_utils()
        result = utils.getFromDB("openai_llm_specs")
        if result is None or len(result) == 0:
            openaiService = OpenAI_Service(api_key=apikey)
            result = await openaiService.fetchLLMSpecs()
            utils.setInDB("openai_llm_specs", result)
        return result
    except ServiceException as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)
    # -----------------------------------------------------------------------
    
@router.post("/api/openai/generate", tags=["OpenAI"], summary="Call OpenAI to generate text")
def openaiGenerate(api_key_valid: bool = Depends(get_api_key), apikey: str = Query(default=None, description="OpenAI API Key"), payload: GeneratePayload = None):
    # -------------- Invoke Business Logic here and get output --------------
    openaiService = OpenAI_Service(api_key=apikey)
    logger.info(f"\n\n------------- IN OpenAIAPI.openaiGenerate with model_id: {payload.modelid} ------------- ")
    # return openaiService.generate(payload)
    # TODO: Remove below line
    # payload.asynchronous = False
    if payload.asynchronous == True:
        if len(payload.input) <= 150:
            if payload.enable_rag == True:
                resp = openaiService.generate_using_LI(payload, True)
            else:
                resp = openaiService.generate_direct(payload, True)
        else:
            resp = openaiService.generate_direct(payload, True)
        # logger.debug(f"\n\nIN openaiGenerate, OPENAI RESPONSE COMPLETED: >> {resp}\n\n")
        return StreamingResponse(resp)        
    else:
        if len(payload.input) <= 150:
            if payload.enable_rag == True:
                resp = openaiService.generate_using_LI(payload, False)
            else:
                resp = openaiService.generate_direct(payload, False)
        else:
            resp = openaiService.generate_direct(payload, False)
       
        # logger.info(f"\n\nIN openaiGenerate with async False, OPENAI RESPONSE COMPLETED: >> {resp}\n\n")
        return resp
        
    
@router.post("/api/openai/vision", tags=["OpenAI"], summary="Call OpenAI vision model")
def openaiVision(api_key_valid: bool = Depends(get_api_key), apikey: str = Query(default=None, description="OpenAI API Key"), payload: VisionPayload = None):
    # -------------- Invoke Business Logic here and get output --------------
    openaiService = OpenAI_Service(api_key=apikey)
    logger.info(f"\n\n------------- IN OpenAIAPI.openaiVision with model_id: {payload.model_id} ------------- ")
    return openaiService.call_vision_model(payload)
    # -----------------------------------------------------------------------
    