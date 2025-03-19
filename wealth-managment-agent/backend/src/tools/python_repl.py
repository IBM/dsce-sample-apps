from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field
from langchain_experimental.utilities import PythonREPL
import os
import logging
from config.app_config import AppConfig
app_config = AppConfig()

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)
class InputSchema(BaseModel):
    code: str = Field(description="python code to execute.")

class PythonRepl:
    def python_repl_tool(self, code):
            if app_config.USE_TOOL_CACHE:
                with open(app_config.TOOL_CACHE.PYTHON_REPL_TOOL_CACHE, 'r') as f:
                    tool_output = f.read()
                logger.info("TOOL: python_repl_tool - returning cached results")
                return tool_output
            python_repl = PythonREPL()
            logger.info("TOOL: python_repl_tool - executing the following piece of code:\n", code)
            result = python_repl.run(code)
            logger.info("TOOL: python_repl_tool - results:\n", result)
            return result
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.python_repl_tool,
            name="python_repl_tool",
            description="Use this to execute python code. If you want to see the output of a value, you should print it out with `print(...)`. This is visible to the user.",
            args_schema=InputSchema
        )