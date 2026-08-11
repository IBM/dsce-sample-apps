from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from config.app_config import AppConfig
app_config = AppConfig()

# Allow CORS for local testing.

origins = [
    "http://localhost",
    "localhost:3000",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:3001",
    "*"
]

# Define tags to categorize APIs on SwaggerUI

tags_metadata = [
    {
        "name": "watsonx.ai",
        "description": "APIs to interact with watsonx.ai."
    },
    {
        "name": "Others",
        "description": "Miscellaneous APIs."
    }
]

with open('config/config.json', 'r') as config:
    configFile = json.loads(config.read())

app = FastAPI(
    title=configFile['title'],
    description=configFile['description'],
    version=configFile['version'],
    license_info=configFile['license_info'],
    swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    openapi_version="3.0.2", # This version is compatable with Watsonx Assistant
    openapi_tags=tags_metadata
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = app_config.FASTAPI_KEY

api_key_scheme = APIKeyHeader(name="X-API-Key")

def get_api_key(api_key: str = Depends(api_key_scheme)):
    if api_key == API_KEY:
        return True
    else:
        raise HTTPException(status_code=401, detail="Invalid API Key")


@app.get('/', tags=["Others"], summary="Home Route")
def home():
    html_content = """
    <!DOCTYPE html>
        <html>
            <body>
                <script>
                    function myFunction() {
                        location.replace("/docs")
                    }
                myFunction()
                </script>
            </body>
        </html>
    """
    return HTMLResponse(content=html_content, status_code=200)
from apis import *