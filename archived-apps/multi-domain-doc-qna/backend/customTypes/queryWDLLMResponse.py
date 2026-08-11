from pydantic import BaseModel
from typing import List, Dict

class queryWDLLMResponse(BaseModel):
    llm_response: str
    references: List[Dict]
