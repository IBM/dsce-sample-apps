from deepeval.test_case import LLMTestCase
from deepeval.metrics import BaseMetric
from deepeval.scorer import Scorer
from deepeval.test_case import LLMTestCase

class BleuMetric(BaseMetric):
    score = 0
    success = None    
    def __init__(self, threshold: float = 0.5, bleu_type="bleu1"):
        self.threshold = threshold
        self.scorer = Scorer()
        self.bleu_type = bleu_type

    def measure(self, test_case: LLMTestCase):
        self.score = self.scorer.sentence_bleu_score(
            prediction=test_case.actual_output,
            references=test_case.expected_output,
            bleu_type=self.bleu_type)
      
        self.success = self.score >= self.threshold
        return self.score

    async def a_measure(self, test_case: LLMTestCase):
        return self.measure(test_case)

    def is_successful(self):
        return self.success

    @property
    def __name__(self):
        return "BLEU Metric"