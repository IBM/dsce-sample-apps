from pydantic import BaseModel
from typing import List, Optional

class ApplicationBase(BaseModel):
    id: int
    applicant_name: str
    loan_type: str
    amount: float
    status: str
    submitted_date: str
    validation_comments: Optional[str] = None  # Optional comments field
    app_id_str: str # This is the app_id_str from the model

class Application(ApplicationBase):
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    firstName: str
    lastName: str
    dateOfBirth: str

class UserDetail(UserBase):
    id: int
    first_name: str
    last_name: str
    date_of_birth: str

class User(UserBase):
    id: int
    # applications: List[Application] = []
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None