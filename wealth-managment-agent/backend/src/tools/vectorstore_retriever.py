from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field
from src.core.rag import Rag
import logging
import os

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

class VectorstoreInputSchema(BaseModel):
    query: str = Field(description="a query to get details from vectorstore")

class RAGTool:
    def __init__(self, milvus_client):
        self.milvus_client = milvus_client

    def get_information(self, query):
        formatted_response = self.milvus_client.rag_retriever(query)
        logger.info("TOOL: vectorstore_retriever - returning actual results")
        return formatted_response
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.get_information,
            name="vectorstore_retriever",
            description="Use this tool to search for information in the vectorstore db.",
            args_schema=VectorstoreInputSchema
        )