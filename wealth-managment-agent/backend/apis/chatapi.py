from main import app, Depends, get_api_key
from pydantic import BaseModel
from src.core.agent import Agent
from src.core.rag import Rag
from fastapi.responses import FileResponse

# Tools
from src.tools.goldman_report_retriever import GoldmanReportRetriever
from src.tools.portfolio_retriever import PortfolioRetriever
from src.tools.save_pdf_tool import SavePdfTool
from src.tools.summarizer_tool import SummarizerTool
from src.tools.vectorstore_retriever import RAGTool
from src.tools.web_search import WebSearchTool
from src.tools.transcript_retriever import TranscriptRetriever

milvus_client = Rag()

goldman_report_tool = GoldmanReportRetriever(milvus_client=milvus_client)
portfolio_retriever_tool = PortfolioRetriever()
save_pdf_tool = SavePdfTool()
summarizer_tool = SummarizerTool()
rag_tool = RAGTool(milvus_client=milvus_client)
web_search_tool = WebSearchTool()
transcript_retriever_tool = TranscriptRetriever()

from config.app_config import AppConfig
app_config = AppConfig()

''' AGENT CONFIGURATION '''

agent = None
is_agent_initialized = False
agent_session_id = None

''' API DETAILS '''

api_url = "/api/v1/session/create"
api_details = "API to create a new chat session"
api_tags = ["IBM watsonx.ai"]

api_url2 = "/api/v1/chat/generate"
api_details2 = "API to generate response from LLM agent"
api_tags2 = ["IBM watsonx.ai"]

''' API CALL ERROR VALIDATORS '''

class PostValidatorError(BaseModel):
    detail: str = 'Validation Error Occurred'

class PostValidatorError2(BaseModel):
    detail: str = 'Invalid credentials'

''' API CALL SUCCESS VALIDATORS '''

class GenerateOutputSchema(BaseModel):
    output: str
    reasoning: str
    execution_time: str

class CreateSessionOutputSchema(BaseModel):
    session_id: str
    output: str

''' POST API CALL Params '''

from typing import Optional

class GenerateInputSchema(BaseModel):
    session_id: Optional[str] = None
    input_data: str

''' HANDLE RESPONSES '''

def handleResponse(outputSchema):
    return {
        200: {
            'model': outputSchema,
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

''' API ROUTES '''

@app.get(
        api_url,
        tags=api_tags,
        responses=handleResponse(CreateSessionOutputSchema),
        summary=api_details
)

async def create_new_session(api_key_valid: bool = Depends(get_api_key)):
    
    tools_to_use = [
        goldman_report_tool.get_tool(),
        portfolio_retriever_tool.get_tool(),
        save_pdf_tool.get_tool(),
        summarizer_tool.get_tool(),
        rag_tool.get_tool(),
        web_search_tool.get_tool(),
        transcript_retriever_tool.get_tool()
    ]

    # Read the planning prompt
    with open(app_config.PROMPT.AGENT_PLANNING_PROMPT, 'r') as ffile:
        planning_prompt = ffile.read()
    
    # Memory
    selected_memory = 'Chat history memory'

    global agent, is_agent_initialized, agent_session_id

    # Initialize the Agent with the selected tools
    agent = Agent(
        tools=tools_to_use,
        planning=planning_prompt,
        memory=selected_memory
    )
    
    response_obj = agent.init_agent()
    agent_session_id = response_obj["session_id"]
    if response_obj["session_id"]:
        is_agent_initialized = True

    return response_obj

@app.post(
        api_url2,
        tags=api_tags2,
        responses=handleResponse(GenerateOutputSchema),
        summary=api_details2
)

async def generate(req: GenerateInputSchema, api_key_valid: bool = Depends(get_api_key)):
    global agent, is_agent_initialized, agent_session_id

    input_data = req.input_data
    session_id = req.session_id if req.session_id else agent_session_id
    
    if is_agent_initialized:
        response = agent.invoke_agent(
            session_id=session_id,
            input_=input_data
        )
        return response
    else:
        return {
            "output": {
                "output": "Agent not initialized, please initialize the agent and try again",
                "intermediate_steps": None,
                "execution_time": None
            }
        }

@app.get("/download/report")
async def download_report(api_key_valid: bool = Depends(get_api_key)):
    file_path = app_config.FILE_SAVE_PATH
    return FileResponse(file_path, filename="portfolio_report.pdf", media_type="application/pdf")