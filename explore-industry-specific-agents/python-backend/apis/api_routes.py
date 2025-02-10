import json
import time
from fastapi import File, UploadFile
from main import app, Depends, get_api_key, Query
from pydantic import BaseModel
import os
import asyncio
from typing import Literal

''' 
    API CALL SUCCESS VALIDATOR MODELS (Output Validator)

    - This model describe what to expect in case of a successful response.
    - This model is requrired to generate an OpenAPI spec file with proper output definition.
'''

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


class InputPayload(BaseModel):
    agent: Literal['travel_agent', 'research_agent', 'financial_agent']


''' 
    HANDLE RESPONSES 

    - Define how 2xx, 3xx, 4xx, 5xx responses look like.
    - The OpenAPI spec json will have these details.
'''

def handleResponse(method):
    if method == 'POST':
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
    elif method == 'GET':
        return {
            200: {
                'content': {
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {}
                },
                'description': 'A successful response will return the downloadable file'
            },
            404: {
                'model': PostValidatorError,
                'description': 'File not found'
            }
        }

''' 
    API ROUTES 

    - Define the API routes
'''

api_url1 = "/api/v1/ai-agent"
api_details1 = "This is a GET API to run the agent and get output."
api_tags1 = ["watsonx.ai"]
@app.get(api_url1 , tags=api_tags1, responses=handleResponse('POST'), summary=api_details1)
async def get_agent(agent: Literal['travel_agent', 'research_agent', 'financial_agent'], api_key_valid: bool = Depends(get_api_key)):
    start_time = time.time()
    if agent == 'travel_agent':
        from agents.travel_agent import TravelAgent
        from src.foundation_model_call import WatsonxModelCall
        obj = TravelAgent()
        fm_obj = WatsonxModelCall(usecase=agent)
        reasoning, result, metadata = await asyncio.to_thread(obj.get_travel_info,
            user_message="I am planning a trip to New York city next week. Can you get me information about the tourist attractions, weather forecast and social events?"
        )
        standalone_model_response = await asyncio.to_thread(fm_obj.invoke)

    elif agent == 'research_agent':
        from agents.research_agent import ResearchAgent
        from src.foundation_model_call import WatsonxModelCall
        obj = ResearchAgent()
        fm_obj = WatsonxModelCall(usecase=agent)
        reasoning, result, metadata = await asyncio.to_thread(obj.get_research_info,
            user_message="What are some advancements in machine learning applications in healthcare?"
        )
        standalone_model_response = await asyncio.to_thread(fm_obj.invoke)
    elif agent == 'financial_agent':
        from agents.financial_agent import FinancialAgent
        from src.foundation_model_call import WatsonxModelCall
        obj = FinancialAgent()
        fm_obj = WatsonxModelCall(usecase=agent)
        reasoning, result, metadata = await asyncio.to_thread(obj.get_financial_info,
            user_message="Summarize the recent trend in tech stocks?"
        )
        standalone_model_response = await asyncio.to_thread(fm_obj.invoke)

    end_time = time.time()
    execution_time = end_time - start_time
    execution_time = round(execution_time, 2)
    return {
        "llm_response": result,
        "llm_reasoning": reasoning,
        "llm_metadata": metadata,
        "standalone_llm_response": standalone_model_response,
        "exec_time": f"{execution_time} seconds"
    }