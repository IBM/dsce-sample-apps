
from enum import Enum
import json
from typing import List
from models.rag_model import RagConfig, VectorDbConfig
from fastapi import Form, status
from pydantic import BaseModel, ValidationError
from fastapi.exceptions import HTTPException
from fastapi.encoders import jsonable_encoder

class Checker:
    def __init__(self, model: BaseModel):
        self.model = model

    def __call__(self, data: str = Form(...)):
        try:
            # print(data)
            # return self.model.model_validate_json(data)
            return json.loads(data)
        except ValidationError as e:
            raise HTTPException(
                detail=jsonable_encoder(e.errors()),
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        
class GANEAI_TASK_ENUM(str, Enum):
    QuestionNAnswer = "QuestionNAnswer"
    Summarization = "Summarization"
    Classification = "Classification"
    Extraction = "Extraction"
    Generation = "Generation"
        
class FetchContextPayload(BaseModel):
    query: str
    fetch_count: int = 3
    vectordb_config: VectorDbConfig = VectorDbConfig()
    where: list = None

class ParseDocumentsPayload(BaseModel):
    savedFiles: List[str]
    ragConfig: RagConfig = None

class UpdateDBPayload(BaseModel):
    key: str
    data: object = None

class GeneratePayload(BaseModel):
    input: str
    parameters: object | None = None
    modelid: str | None = None
    project_id: str | None = None
    enable_rag: bool = False
    genai_task: GANEAI_TASK_ENUM = GANEAI_TASK_ENUM.QuestionNAnswer
    asynchronous: bool = True
    vectordb_config: VectorDbConfig = VectorDbConfig()
   
class VisionPayload(BaseModel):
    modelid: str | None = None
    messages: list | None = None
    max_tokens: int = None

class ServiceException(Exception):
    def __init__(self, status_code=500, detail=None, err: Exception = None):
        self.status_code = status_code
        self.detail = detail
        self.err = err


class PublishPayload(BaseModel):
    topic: str
    data: object = None

class PostValidatorSuccess(BaseModel):
    output: str = 'Your output will be a json object with a key named `output`.'

''' 
    API CALL ERROR VALIDATOR MODELS (Error Validator)
    
    - These models describe what output to expect in case of an error.
    - These models are required to generate an OpenAPI spec file with proper error handling definition.
'''

class PostValidatorError(BaseModel):
    detail: str = 'Validation Error Occurred'


class PostValidatorError2(BaseModel):
    detail: str = 'Invalid credentials'


''' 
    HANDLE RESPONSES 
    - Define how 2xx, 3xx, 4xx, 5xx responses look like.
    - The OpenAPI spec json will have these details.
'''

def handleResponse():
    return {
        200: {
            'model': PostValidatorSuccess,
            'description': 'A successful response will look something like this'
        },
        400: {
            'model': PostValidatorError2,
            'description': 'A response with invalid username/password will look something like this'
        },
        422: {
            'model': PostValidatorError,
            'description': 'A failed response will look something like this'
        }
    }

