from main import app, Depends, get_api_key
from pydantic import BaseModel
from src.core.agent import Agent
from src.core.rag import Rag
from fastapi.responses import FileResponse
import re

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

    portfolio_report_match = re.search(
        r"report on (.+?)'?s stock investment portfolio",
        input_data,
        re.IGNORECASE
    )

    if portfolio_report_match:
        username = portfolio_report_match.group(1).strip()
        portfolio_markdown = portfolio_retriever_tool.get_portfolio(username)

        if "not found in the database" in portfolio_markdown.lower():
            return {
                "output": portfolio_markdown,
                "reasoning": None,
                "execution_time": "0 sec"
            }

        security_names = []
        for line in portfolio_markdown.splitlines():
            if "|" not in line or "Security Name" in line or "---" in line:
                continue
            parts = [part.strip() for part in line.split("|") if part.strip()]
            if len(parts) >= 4:
                security_names.append(parts[1])

        web_sections = []
        reasoning_steps = []

        for security_name in security_names:
            performance_query = f"{security_name} performance"
            news_query = f"{security_name} news"

            performance_result = web_search_tool.get_web_info(performance_query)
            news_result = web_search_tool.get_web_info(news_query)

            reasoning_steps.append((type("Step", (), {"tool": "web_search_tool", "tool_input": performance_query})(), performance_result))
            reasoning_steps.append((type("Step", (), {"tool": "web_search_tool", "tool_input": news_query})(), news_result))

            web_sections.append(
                f"## {security_name}\n\n"
                f"### Performance\n{performance_result.get('answer', str(performance_result))}\n\n"
                f"### News\n{news_result.get('answer', str(news_result))}\n"
            )

        combined_web_content = "\n\n".join(web_sections)
        summarized_web_content = summarizer_tool.summarize_articles(combined_web_content)
        goldman_summary = goldman_report_tool.get_information(username)

        report_markdown = (
            f"# Stock Investment Portfolio Report for {username}\n\n"
            f"## Portfolio Holdings\n\n{portfolio_markdown}\n\n"
            f"## Market and News Summary\n\n{summarized_web_content}\n\n"
            f"## Goldman Sachs Report Insights\n\n{goldman_summary}\n"
        )

        save_pdf_tool.save_pdf_to_disk(report_markdown)

        reasoning_steps.append((type("Step", (), {"tool": "portfolio_retriever", "tool_input": username})(), portfolio_markdown))
        reasoning_steps.append((type("Step", (), {"tool": "summarizer_tool", "tool_input": "compiled market and news content"})(), summarized_web_content))
        reasoning_steps.append((type("Step", (), {"tool": "goldman_reports_retriever", "tool_input": username})(), goldman_summary))
        reasoning_steps.append((type("Step", (), {"tool": "save_pdf_to_disk", "tool_input": "generated markdown report"})(), report_markdown))

        return {
            "output": report_markdown,
            "reasoning": agent.summarize_agent_actions(reasoning_steps) if agent else None,
            "execution_time": "0 sec"
        }
    
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