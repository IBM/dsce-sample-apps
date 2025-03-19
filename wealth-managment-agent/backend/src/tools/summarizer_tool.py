from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from src.core.llm import Watsonx
from config.app_config import AppConfig
app_config = AppConfig()
import logging
import os
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

granite_llm = Watsonx(model=app_config.MODEL.GRANITE_3_8_B_INSTRUCT).get_llm()

class InputSchema(BaseModel):
    multiple_news_articles: str = Field(description="all the news articles recieved from web search.")

class SummarizerTool:
    def __init__(self):
        self.init_prompt_templates()
    
    def init_prompt_templates(self):
        with open(app_config.PROMPT.SUMMARIZER_PROMPT, 'r') as ffile:
            self.summary_prompt = ffile.read()

    def summarize_articles(self, multiple_news_articles):
        if app_config.USE_TOOL_CACHE:
            with open(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE, 'r') as f:
                tool_output = f.read()
            logger.info("TOOL: summarizer_tool - returning cached results")
            return tool_output
        
        prompt_formatted_str = self.summary_prompt.format(document=multiple_news_articles)
        response = granite_llm.generate_text(prompt_formatted_str, guardrails=False)
        with open(app_config.TOOL_CACHE.SUMMARIZER_TOOL_CACHE, 'w') as f:
                f.write(
                    response
                )
        logger.info("TOOL: summarizer_tool - returning actual results")
        return response
        
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.summarize_articles,
            name="summarizer_tool",
            description="Use this tool to summarize the web news.",
            args_schema=InputSchema
        )