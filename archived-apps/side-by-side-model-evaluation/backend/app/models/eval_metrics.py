from pydantic import BaseModel

class LLMJudgeParams(BaseModel):
    llm_platform: str = "watsonx"
    model_id: str = None
    llm_params: dict
    metrics: str        
    metrics_params: dict

class MetricsInput(BaseModel):
    evaluate: list = ["rouge", "bleu", "perplexity"]
    input_text: str = ""
    expected_output: str = ""
    generated_output: object = {
            "model_id": "ibm/granite-13b-chat-v2",
            "text": ""
        },
    llm_as_judge_params: LLMJudgeParams = None
class Scores(BaseModel):
    PerplexityScore: str
    RogueScore: str
    BeluScore: str

class MetricsOutput(BaseModel):
    output: object = {
        "model1": {
            "PerplexityScore": "",
            "RogueScore": "",
            "BeluScore": ""
        }, 
        "model2": {
            "PerplexityScore": "",
            "RogueScore": "",
            "BeluScore": ""
        }
    }