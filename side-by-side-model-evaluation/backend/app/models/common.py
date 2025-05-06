from pydantic import BaseModel

class Audit(BaseModel):
    user_id: str = None

class Task(BaseModel):
    uid: str | None = None
    status: str | None = 'in_progress'
    data: object | None = None
    audit: Audit | dict | None = None



       

