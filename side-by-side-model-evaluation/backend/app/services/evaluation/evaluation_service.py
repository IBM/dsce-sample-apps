
import os
from services.utils import CommonUtils, singleton
from services.evaluation.deepeval.llm_as_judge import LLMAsJudgeService
from services.evaluation.deepeval.rouge_metric import RougeMetric
from services.evaluation.deepeval.bleu_metric import BleuMetric
from models.eval_metrics import MetricsInput
# from datasets import load_metric
import evaluate
from deepeval.test_case import LLMTestCase
# from deepeval.metrics import AnswerRelevancyMetric
# from transformers import AutoModelForCausalLM, AutoTokenizer
# import torch

# from main import app

import logging
from core.log_config import init_loggers

import nltk
nltk.download('punkt_tab')

init_loggers(__name__)
logger = logging.getLogger(__name__) 

@singleton
class EvaluationService:

    def __init__(self) -> None:
        os.environ['HF_EVALUATE_OFFLINE'] = '1' 
        self.utils = CommonUtils()
        self.perplexity = None
        self.rouge = None
        self.sacrebleu = None        

    def evaluate(self, metricsPayload: MetricsInput = None):
        if metricsPayload.generated_output and "model_id" in metricsPayload.generated_output:
            # key = generatedOutput["model_id"]
            result = {}
            result["model_id"] = metricsPayload.generated_output["model_id"]
            result["metrics"] = {}
            if "rouge" in metricsPayload.evaluate:
                result["metrics"]["rouge"] = self.RogueScore(metricsPayload)
            if "bleu" in metricsPayload.evaluate:
                result["metrics"]["bleu"] = self.BleuScore(metricsPayload)
            if "perplexity" in metricsPayload.evaluate:
                result["metrics"]["perplexity"] = self.PerplexityScore(metricsPayload.generated_output["text"])
            if "llm_as_judge" in metricsPayload.evaluate:
                llmAsJudgeService = LLMAsJudgeService(self.utils)
                result["metrics"]["llm_as_judge"] = llmAsJudgeService.evaluate(metricsPayload)
                    
        return result

    def PerplexityScore(self, generatedText):
        # model = AutoModelForCausalLM.from_pretrained("gpt2")
        # tokenizer = AutoTokenizer.from_pretrained("gpt2")
        # inputs = tokenizer(generatedText, return_tensors="pt")
        # loss = model(input_ids=inputs["input_ids"], labels=inputs["input_ids"]).loss
        # ppl = torch.exp(loss)
        # # self.perplexity = f"{ppl.item():.2f}%"
        # self.perplexity = ppl.item() 
        # self.perplexity = evaluate.load("perplexity", module_type="metric") 
        self.perplexity = evaluate.load("perplexity", module_type="metric")   
        # self.perplexity.add(predictions=generatedText)  
        # perplexity = self.perplexity.compute(model_id='gpt2')
        perplexity = self.perplexity.compute(predictions=generatedText, model_id='gpt2')        
        return perplexity
    
    def RogueScore(self, metricsPayload: MetricsInput):
        # rouge = load_metric("rouge")
        # self.rouge = evaluate.load("rouge")
        # references = [referenceText]
        # predictions = [generatedText]
        # rogue = self.rouge.compute(predictions=predictions, references=references, use_aggregator=True)
        test_case = LLMTestCase(
            input=metricsPayload.input_text,
            actual_output=metricsPayload.generated_output["text"],
            expected_output=metricsPayload.expected_output
        )
        rouge1 = RougeMetric(threshold=0.5, score_type="rouge1")
        rouge1.measure(test_case)
        rouge2 = RougeMetric(threshold=0.5, score_type="rouge2")
        rouge2.measure(test_case)
        rougeL = RougeMetric(threshold=0.5, score_type="rougeL")
        rougeL.measure(test_case)
        metric = {
            "rouge1": {"score": rouge1.score},
            "rouge2": {"score": rouge2.score},
            "rougeL": {"score": rougeL.score}               
        }               
        return metric
    
    def BleuScore(self, metricsPayload: MetricsInput):
        # sacrebleu = load_metric("sacrebleu")
        # self.sacrebleu = evaluate.load("sacrebleu")
        # references = [[referenceText]]
        # predictions = [generatedText]
        # bleu = self.sacrebleu.compute(predictions=predictions, references=references)
        test_case = LLMTestCase(
            input=metricsPayload.input_text,
            actual_output=metricsPayload.generated_output["text"],
            expected_output=metricsPayload.expected_output
        )
        bleu1 = BleuMetric(threshold=0.5, bleu_type="bleu1")
        bleu1.measure(test_case)
        bleu2 = BleuMetric(threshold=0.5, bleu_type="bleu2")
        bleu2.measure(test_case)
        bleu3 = BleuMetric(threshold=0.5, bleu_type="bleu3")
        bleu3.measure(test_case)
        bleu4 = BleuMetric(threshold=0.5, bleu_type="bleu4")
        bleu4.measure(test_case)
        metric = {
            "bleu1": {"score": bleu1.score},
            "bleu2": {"score": bleu2.score},
            "bleu3": {"score": bleu3.score},
            "bleu4": {"score": bleu4.score}               
        }
        return metric
    