from langchain_classic.tools import StructuredTool
from pydantic import BaseModel, Field
from src.core.llm import Watsonx
from config.app_config import AppConfig
app_config = AppConfig()
import logging
import os
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

_granite_llm = None

def get_granite_llm():
    global _granite_llm
    if _granite_llm is None:
        _granite_llm = Watsonx(model=app_config.MODEL.GRANITE_3_8_B_INSTRUCT).get_llm()
    return _granite_llm

class InputSchema(BaseModel):
    multiple_news_articles: str = Field(description="all the news articles recieved from web search.")

class SummarizerTool:
    def __init__(self):
        self.init_prompt_templates()
    
    def init_prompt_templates(self):
        with open(app_config.PROMPT.SUMMARIZER_PROMPT, 'r') as ffile:
            self.summary_prompt = ffile.read()

    def summarize_articles(self, multiple_news_articles):
        if app_config.USE_TOOL_CACHE and os.path.exists(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE):
            try:
                with open(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE, 'r') as f:
                    tool_output = f.read()
                logger.info("TOOL: summarizer_tool - returning cached results")
                return tool_output
            except (IOError, OSError):
                pass

        prompt_formatted_str = self.summary_prompt.format(document=multiple_news_articles)
        response = get_granite_llm().generate_text(prompt_formatted_str, guardrails=False)

        cache_dir = os.path.dirname(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE)
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir, exist_ok=True)
        with open(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE, 'w') as f:
            f.write(response)
        logger.info("TOOL: summarizer_tool - returning actual results")
        return response
        
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.summarize_articles,
            name="summarizer_tool",
            description="Use this tool to summarize the web news.",
            args_schema=InputSchema
        )