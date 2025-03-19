from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from src.core.llm import Watsonx
from docx import Document
from config.app_config import AppConfig
app_config = AppConfig()

import logging
import os

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

granite_llm = Watsonx(model=app_config.MODEL.GRANITE_3_8_B_INSTRUCT).get_llm()

class InputSchema(BaseModel):
    no_input: str = Field(description="No input required.")

class TranscriptRetriever:
    def __init__(self):
        self.init_prompt_templates()
    
    def init_prompt_templates(self):
        with open(app_config.PROMPT.SUMMARIZER_PROMPT, 'r') as ffile:
            self.summary_prompt = ffile.read()

    def transcript_retriever_and_summarizer(self, no_input):
        if app_config.USE_TOOL_CACHE:
            with open(app_config.TOOL_CACHE.TRANSCRIPT_TOOL_CACHE, 'r') as f:
                tool_output = f.read()
            logger.info("TOOL: transcript_retriever_tool - returning cached results")
            return tool_output
        doc = Document(app_config.CALL_TRANSCRIPT_PATH)
        content = "\n".join([para.text for para in doc.paragraphs])
        
        prompt_formatted_str = self.summary_prompt.format(email=content)
        
        response = granite_llm.generate_text(prompt_formatted_str, guardrails=False)
        with open(app_config.TOOL_CACHE.TRANSCRIPT_TOOL_CACHE, 'w') as f:
                f.write(
                    response
                )
        logger.info("TOOL: transcript_retriever_tool - returning actual results")
        return response
        
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.transcript_retriever_and_summarizer,
            name="transcript_retriever_tool",
            description="Use this tool to get the summarized email from the transcript.",
            args_schema=InputSchema
        )