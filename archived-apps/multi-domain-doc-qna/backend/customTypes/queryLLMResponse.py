from pydantic import BaseModel
from typing import List, Dict

class queryLLMResponse(BaseModel):
    llm_response: str
    references: List[Dict]
