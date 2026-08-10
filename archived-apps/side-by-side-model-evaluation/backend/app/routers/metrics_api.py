import json
import logging

from models.eval_metrics import MetricsInput

from main import Depends, get_api_key
from fastapi import APIRouter
from services.evaluation.evaluation_service import EvaluationService
from services.services_factory import ServicesFactory

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

''' 
    API ROUTES 
    - Generative AI API routes
'''

@router.post("/api/metrics/evaluate", tags=["Model Metrics"], summary="Get model metrics")
def modelMetricsEvaluate(api_key_valid: bool = Depends(get_api_key), payload: MetricsInput = None):
    if payload and payload.generated_output and 'model_id' in payload.generated_output:
        logger.debug(f"IN modelMetricsEvaluate START, for model_id : {payload.generated_output['model_id']}")
        
    model_metrics: EvaluationService = ServicesFactory.get_evaluation_service()
    
    result = model_metrics.evaluate(payload)
    if result and 'model_id' in result:
        logger.info(f"IN modelMetricsEvaluate COMPLETED for : {result['model_id']}")
        # logger.debug(f"IN modelMetricsEvaluate RESULT : {result}")
    return result
    # -----------------------------------------------------------------------

