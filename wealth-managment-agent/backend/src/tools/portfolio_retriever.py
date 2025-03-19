from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from src.core.sql import SQL
import pandas as pd
import logging
import os
from config.app_config import AppConfig

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)
app_config = AppConfig()
db = SQL()

class InputSchema(BaseModel):
    username: str = Field(description="user name to get the portfolio details.")

class PortfolioRetriever:
    def get_portfolio(self, username):
        if app_config.USE_TOOL_CACHE:
            with open(app_config.TOOL_CACHE.PORTFOLIO_TOOL_CACHE, 'r') as f:
                tool_output = f.read()
            logger.info("TOOL: portfolio_retriever - returning cached results")
            return tool_output
        try:
            data = db.read_by_username(username)
            if not data:
                logger.info("TOOL: portfolio_retriever - No data found in market_data table.")
                return f"User {username} details not found in the database."
            
            data_without_username = [row[:-1] for row in data]
            df = pd.DataFrame(data_without_username, columns=['ID', 'Security Name', 'Market Value (USD)', 'Y2Y %', 'Industry Sector'])
            portfolio = df.to_markdown(index=False)
            with open(app_config.TOOL_CACHE.PORTFOLIO_TOOL_CACHE, 'w') as f:
                f.write(
                    portfolio
                )
            logger.info("TOOL portfolio_retriever - returning actual results")
            return portfolio
        except Exception as e:
            logger.info(f"TOOL: portfolio_retriever - An error occurred: {e}")
            return f"An error occurred calling the tool portfolio_retriever: {e}"
        # finally:
        #     db.close()
    
    def get_tool(self):
        return StructuredTool.from_function(
            func=self.get_portfolio,
            name="portfolio_retriever",
            description="Use this tool to get user portfolio information from the database.",
            args_schema=InputSchema
        )
