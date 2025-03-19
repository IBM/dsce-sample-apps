from tavily import TavilyClient
from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field
from config.app_config import AppConfig
app_config = AppConfig()
import json
import logging
import os
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)
class InputSchema(BaseModel):
    query: str = Field(description="a query to search the web.")

class WebSearchTool:
    def get_web_info(self, query):
        with open(app_config.TOOL_CACHE.WEB_SEARCH_TOOL_CACHE, 'r') as f:
            tool_output = json.loads(f.read())
        if app_config.USE_TOOL_CACHE:
            if query in tool_output:
                logger.info("TOOL: web_search_tool - returning cached results")
                return tool_output[query]
        tavily_client = TavilyClient()
        response = tavily_client.search(query=query, max_results=5, include_answer=True)
        tool_output[query] = response
        with open(app_config.TOOL_CACHE.WEB_SEARCH_TOOL_CACHE, 'w') as f:
            json.dump(tool_output, f, indent=4)
        logger.info("TOOL: web_search_tool - returning actual results")
        return response
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.get_web_info,
            name="web_search_tool",
            description="Use this tool to Search the web for relevant information.",
            args_schema=InputSchema
        )