from datetime import datetime
from pydantic import BaseModel
from typing import List

class CompanyProfile(BaseModel):
    name: str
    description: str

class RfpOpportunity(BaseModel):
    title: str
    description: str
    customer: str
    ref_number: str
    posting_url: str
    region_of_delivery: List[str]
    posting_date: datetime | None
    closing_date: datetime | None
    match_score: float = 0.0