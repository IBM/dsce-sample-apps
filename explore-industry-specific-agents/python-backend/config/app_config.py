import os
from enum import Enum

class ModelEnum(str, Enum):
    # Models that are good at reasoning
    LLAMA_3_70_B_INSTRUCT = 'meta-llama/llama-3-3-70b-instruct'
    GRANITE_3_8_B_INSTRUCT = 'ibm/granite-3-8b-instruct'
    MISTRAL_LARGE = 'mistralai/mistral-large'
    LLAMA_3_90_B_VISION = 'meta-llama/llama-3-2-90b-vision-instruct'

class AppConfig:
    try:
        FASTAPI_KEY = os.getenv("FASTAPI_KEY")
        WX_ENDPOINT = os.getenv("WX_ENDPOINT")
        IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY")
        WX_PROJECT_ID = os.getenv("WX_PROJECT_ID")
        USE_CACHE_TOOL_RESPONSES = True if os.getenv('USE_CACHE_TOOL_RESPONSES').lower() == 'true' else False
        UPDATE_TOOL_CACHE = True if os.getenv('UPDATE_TOOL_CACHE').lower() == 'true' else False
        UPDATE_AGENT_CACHE = True if os.getenv('UPDATE_AGENT_CACHE').lower() == 'true' else False
    except AttributeError as e:
        raise EnvironmentError(f"Missing environment variable: {e}")

    MODEL = ModelEnum
    PARAMETERS = {
        "decoding_method": "greedy",
        "min_new_tokens": 1,
        "max_new_tokens": 500,
        "repetition_penalty": 1
    }
    TOOL_CACHE_LOCATION = 'cache/tools/'
    AGENT_CACHE_LOCATION = 'cache/'