from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import csv
import logging

from config.app_config import AppConfig
from src.core.sql import SQL

app_config = AppConfig()
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

# Define tags to categorize APIs on SwaggerUI

tags_metadata = [
    {
        "name": "IBM watsonx.ai",
        "description": "APIs to interact with watsonx.ai"
    },
    {
        "name": "Others",
        "description": "Miscellaneous APIs"
    }
]

with open('config.json', 'r') as config:
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

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://dsce-prod-ce-wtx-wealth-manager-single-agent-ui.1op8ay1afyb7.us-south.codeengine.appdomain.cloud",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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

# Initialize database with sample data on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database with sample portfolio data if empty"""
    print("=" * 80)
    print("STARTUP: Initializing database...")
    print("=" * 80)
    try:
        db = SQL()
        # Check if database has any data
        existing_data = db.read_all()
        
        if not existing_data:
            print("STARTUP: Database is empty. Populating with sample data from CSV...")
            logger.info("Database is empty. Populating with sample data from CSV...")
            csv_file = app_config.CSV_FILE_PATH
            
            if os.path.exists(csv_file):
                print(f"STARTUP: Found CSV file at {csv_file}")
                with open(csv_file, newline='', encoding='utf-8-sig') as file:
                    reader = csv.DictReader(file)
                    # Fix headers if BOM is present
                    if reader.fieldnames:
                        reader.fieldnames = [name.lstrip('\ufeff') for name in reader.fieldnames]
                    
                    row_count = 0
                    for row in reader:
                        db.create(
                            security_name=row["security_name"].strip(),
                            market_value_usd=int(row["market_value_usd"].strip()),
                            y2y_percent=int(row["y2y_percent"].strip()),
                            industry_sector=row["industry_sector"].strip(),
                            username=row["username"].strip()
                        )
                        row_count += 1
                print(f"STARTUP: Database successfully populated with {row_count} records.")
                logger.info(f"Database successfully populated with {row_count} records.")
            else:
                print(f"STARTUP: CSV file not found at {csv_file}. Database remains empty.")
                logger.warning(f"CSV file not found at {csv_file}. Database remains empty.")
        else:
            print(f"STARTUP: Database already contains {len(existing_data)} records. Skipping initialization.")
            logger.info(f"Database already contains {len(existing_data)} records. Skipping initialization.")
    except Exception as e:
        print(f"STARTUP ERROR: Error initializing database: {e}")
        logger.error(f"Error initializing database: {e}")
        import traceback
        traceback.print_exc()
    print("=" * 80)

from apis import *