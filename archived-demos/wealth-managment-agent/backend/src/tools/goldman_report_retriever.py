from langchain_classic.tools import StructuredTool
from pydantic import BaseModel, Field
import os
import logging
from src.core.llm import Watsonx
from config.app_config import AppConfig
app_config = AppConfig()

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

_llama3_llm = None

def get_llama3_llm():
    global _llama3_llm
    if _llama3_llm is None:
        _llama3_llm = Watsonx(model=app_config.MODEL.LLAMA_3_70_B_INSTRUCT).get_llm()
    return _llama3_llm

class InputSchema(BaseModel):
    username: str = Field(description="user name to get the goldman report.")

class GoldmanReportRetriever:
    def __init__(self, milvus_client):
        self.init_prompt_templates()
        self.milvus_client = milvus_client
    
    def init_prompt_templates(self):
        with open(app_config.PROMPT.GOLDMAN_REPORT_EXTRACTION_PROMPT, 'r') as ffile:
            self.goldman_prompt = ffile.read()
        with open(app_config.PROMPT.SUMMARIZER_PROMPT, 'r') as ffile:
            self.summary_prompt = ffile.read()

    def get_information(self, username):
        # Check cache if enabled and file exists
        if app_config.USE_TOOL_CACHE and os.path.exists(app_config.TOOL_CACHE.GOLDMAN_TOOL_CACHE):
            try:
                with open(app_config.TOOL_CACHE.GOLDMAN_TOOL_CACHE, 'r') as f:
                    tool_output = f.read()
                logger.info("TOOL: goldman_reports_retriever - returning cached results")
                return tool_output
            except (IOError, OSError):
                pass
        
        final_resp = "## Goldman report\n\n"
        # User questions
        goldman_report_questions = (
            "How does the US equity market compare to the rest of world?",
            "How much have global equities grown?",
            "How much have US equities grown?",
            "Summarize the disclosures",
        )
        # RAG on the report
        for q in goldman_report_questions:
            context = self.milvus_client.rag_retriever(q)
            prompt_formatted_str = self.goldman_prompt.format(documents=context, query=q)
            response = get_llama3_llm().generate_text(prompt_formatted_str, guardrails=False)
            final_resp += f"Question: {q}\nAnswer: {response}\n\n"
        prompt_formatted_str = self.summary_prompt.format(document=final_resp)
        response = get_llama3_llm().generate_text(prompt_formatted_str, guardrails=False)
        
        # Ensure cache directory exists before writing
        cache_dir = os.path.dirname(app_config.TOOL_CACHE.GOLDMAN_TOOL_CACHE)
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir, exist_ok=True)
        
        with open(app_config.TOOL_CACHE.GOLDMAN_TOOL_CACHE, 'w') as f:
            f.write(response)
        logger.info("TOOL: goldman_reports_retriever - returning actual results")
        return response
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.get_information,
            name="goldman_reports_retriever",
            description="Use this tool to get the goldman report summary.",
            args_schema=InputSchema
        )