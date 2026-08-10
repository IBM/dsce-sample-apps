from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class Moderations(BaseModel):
    hap_input: str = 'true'
    threshold: float = 0.75
    hap_output: str = 'true'

class Parameters(BaseModel):
    decoding_method: str = "greedy"
    min_new_tokens: int = 1
    max_new_tokens: int = 500
    repetition_penalty: float = 1.1
    temperature: float = 0.7
    top_k: int = 50
    top_p: int = 1
    moderations: Moderations = Moderations()

    def dict(self, *args, **kwargs):
        """
        Override dict() method to return a dictionary representation
        """
        params_dict = super().dict(*args, **kwargs)
        params_dict['moderations'] = self.moderations.dict()
        return params_dict

class LLMParams(BaseModel):
    model_id: str = "meta-llama/llama-3-70b-instruct"
    inputs: list = []
    parameters: Parameters = Parameters()

    # Resolves warning error with model_id:
    #     Field "model_id" has conflict with protected namespace "model_".
    #     You may be able to resolve this warning by setting `model_config['protected_namespaces'] = ()`.
    #     warnings.warn(
    class Config:
        protected_namespaces = ()

class queryLLMRequest(BaseModel):
    question: str
    es_index_name: str
    es_index_text_field: Optional[str] = Field(default="body_content_field")
    es_model_name: Optional[str] = Field(default=".elser_model_2")
    es_model_text_field: Optional[str] = Field(default="ml.tokens")
    llm_instructions: Optional[str] = Field(default="[INST]<<SYS>>You are a helpful, respectful, and honest assistant. Always answer as helpfully as possible, while being safe. Be brief in your answers. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\\'\''t know the answer to a question, please do not share false information. <</SYS>>\nGenerate the next agent response by answering the question. You are provided several documents with titles. If the answer comes from different documents please mention all possibilities and use the tiles of documents to separate between topics or domains. Answer with no more than 150 words. If you cannot base your answer on the given document, please state that you do not have an answer.\n{context_str}<</SYS>>\n\n{query_str} Answer with no more than 150 words. If you cannot base your answer on the given document, please state that you do not have an answer. [/INST]", title="LLM Instructions", description="Instructions for LLM")
    num_results: Optional[str] = Field(default="5")
    llm_params: Optional[LLMParams] = LLMParams()
    filters: Optional[Dict[str, Any]] = Field(None,
        example={
            "date": "2022-01-01",
            "file_name": "test.pdf"
        })

