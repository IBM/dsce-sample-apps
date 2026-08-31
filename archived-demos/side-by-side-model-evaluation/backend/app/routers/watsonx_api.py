import json
import logging
import asyncio

from routers.common import GeneratePayload, handleResponse
from services.services_factory import ServicesFactory
from services.utils import CommonUtils
from main import app, Depends, get_api_key, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.watsonx_service import WatsonX_Service

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

''' 
    WATSONX API ROUTES 
    - Generative AI API routes
'''

@router.get("/api/watsonx/foundation_model_specs", tags=["Watsonx.ai"], responses=handleResponse(), summary="Available LLMs")
async def fetchLLMSpecs(api_key_valid: bool = Depends(get_api_key)):
    logger.info(f"\n\n------------- IN WatsonxAPI.fetchLLMSpecs ------------- ")
    utils: CommonUtils = ServicesFactory.get_common_utils()
    result = utils.getFromDB("wx_llm_specs")
    if result is None or len(result) == 0:
        wxService = WatsonX_Service()
        # return asyncio.run(wxService.fetchLLMSpecs())
        result = await wxService.fetchLLMSpecs()
        utils.setInDB("wx_llm_specs", result)
    return result
    # -----------------------------------------------------------------------
    
async def response_streamer(response):
    for token in response:
        print(token)
        yield f"{token}"

@router.post("/api/watsonx/generate", tags=["Watsonx.ai"], summary="Call watsonx.ai to generate text")
async def watsonxGenerate(api_key_valid: bool = Depends(get_api_key), payload: GeneratePayload = None):
    logger.info(f"\n\n------------- IN WatsonxAPI.watsonxGenerate with model_id: {payload.modelid}, enable_rag: {payload.enable_rag}, input length: {len(payload.input)} ------------- ")
    wxService = WatsonX_Service()
    # return asyncio.run(wxService.generate(payload))
    # payload.asynchronous = False
    try:
        if payload.asynchronous == True:
            if len(payload.input) <= 150:
                if payload.enable_rag == True:
                    resp = wxService.generate_using_LI(payload, True)
                else:
                    resp = wxService.generate_direct(payload, True)            
            else:
                resp = wxService.generate_direct(payload, True)
            return StreamingResponse(resp, media_type='text/event-stream')        
        else:
            result = wxService.generate_using_LI(payload, False)
            return result
    except Exception as err:
        raise HTTPException(status_code=err.status_code, detail=err.detail)
        
@router.get("/api/watsonx/refresh", tags=["Watsonx.ai"], responses=handleResponse(), summary="Refresh Watsonx Tokens")
async def refreshTokens(api_key_valid: bool = Depends(get_api_key)):
    # -------------- Invoke Business Logic here and get output --------------    
    logger.info(f"\n\n------------- IN WatsonxAPI.refreshTokens ------------- ")
    wxService = WatsonX_Service()
    return await wxService.refreshToken()
    

