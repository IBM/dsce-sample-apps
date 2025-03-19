from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field
from mistletoe import markdown
from fpdf import FPDF

from config.app_config import AppConfig
app_config = AppConfig()

import logging
import os
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

class InputSchema(BaseModel):
    markdown_string: str = Field(description="markdown string.")

class SavePdfTool:
    def save_pdf_to_disk(self, markdown_string):
        try:
            html = markdown(markdown_string)
            pdf = FPDF()
            pdf.add_page()
            pdf.write_html(html)
            pdf.output(app_config.FILE_SAVE_PATH)
            logger.info("TOOL: save_pdf_to_disk - returning actual results")
        except Exception as e:
            print(f"An error occurred while saving the PDF: {e}")
        return markdown_string
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.save_pdf_to_disk,
            name="save_pdf_to_disk",
            description="Use this to convert the markdown to pdf and save to disk.",
            args_schema=InputSchema
        )