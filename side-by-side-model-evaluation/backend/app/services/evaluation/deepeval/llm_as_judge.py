import os

from pathlib import Path
from dotenv import load_dotenv
from models.eval_metrics import MetricsInput
from services.evaluation.deepeval.watsonx_llm import IBMWatsonxLLM
from services.utils import CommonUtils
from langchain_ibm import WatsonxLLM

from deepeval.metrics import AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

import logging
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class LLMAsJudgeService:

    def __init__(self, utils: CommonUtils) -> None:  
        self.utils = utils     
        self.llm = None
        self.ibm_watsonx_llm = None
        self.DEFAUL_LLM_JUDGE = "mistralai/mixtral-8x7b-instruct-v01"

    def __init_llm(self, llm_params=None, model_id=None):
        if llm_params is None:
            llm_params = {
                "decoding_method": "sample",
                "max_new_tokens": 800,
                "min_new_tokens": 1,
                "temperature": 0.5,
                "top_k": 50,
                "top_p": 1
                # "stop_sequences": ["}"]
            }
        
        if model_id is None or len(model_id) < 5:
            model_id = self.DEFAUL_LLM_JUDGE

        watsonx_llm = WatsonxLLM(model_id=model_id,
                                url=self.utils.getFromCache("WX_ENDPOINT"),
                                project_id=self.utils.getFromCache("WX_PROJECT_ID"),
                                params=llm_params,
                                apikey=self.utils.getFromCache("IBMCLOUD_API_KEY")
                    )
        return watsonx_llm
        
    def evaluate(self, metricsPayload: MetricsInput):
        if metricsPayload.llm_as_judge_params is None or metricsPayload.llm_as_judge_params.metrics is None:
            return None
        
        if metricsPayload.llm_as_judge_params.llm_platform == 'watsonx':
            watsonx_llm = self.__init_llm(metricsPayload.llm_as_judge_params.llm_params, metricsPayload.llm_as_judge_params.model_id)
        else:
            logger.info("Only Watsonx LLM can be used as of now for Judging results !")
            return None

        if self.ibm_watsonx_llm is None:
            self.ibm_watsonx_llm = IBMWatsonxLLM(watsonx_llm)

        if metricsPayload.llm_as_judge_params.metrics == "AnswerRelevancyMetric":
            test_case = LLMTestCase(
                input=metricsPayload.input_text,
                actual_output=metricsPayload.generated_output["text"]
                # expected_output=metricsPayload.expected_output
            )
            metrics_params = metricsPayload.llm_as_judge_params.metrics_params
            metric = AnswerRelevancyMetric(model=self.ibm_watsonx_llm, async_mode=metrics_params['async_mode'], verbose_mode=metrics_params['verbose_mode'], include_reason=metrics_params['include_reason'], strict_mode=metrics_params['strict_mode'])
            # print(f"metrics_params: {metrics_params}")
            # metric = AnswerRelevancyMetric(model=self.ibm_watsonx_llm, async_mode=False, verbose_mode=False, include_reason=True, strict_mode=False)
            metric.measure(test_case)
            result = {
                        "model_id": metricsPayload.llm_as_judge_params.model_id, 
                        "metrics": {
                            "AnswerRelevancyMetric": {"score": metric.score, "reason": metric.reason}
                        }
                    }
                        
            print(f"\n\nEVALUATION RESULT: {result}\n\n")
            return result
        return None
        