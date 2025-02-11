import json
from langchain_community.utilities import ArxivAPIWrapper
from config.app_config import AppConfig

class ArxivTool:
    def __init__(self):
        pass

    def arxiv_tool(self, query: str) -> str:
        """
        Get information about a scientific article or papers from the arxiv repo.

        Args:
            query (str): The search query string.

        Returns:
            str: The Publishing date, Title, Authors and summary of the article of paper.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'arxiv_tool_cache.json', 'r') as f:
                    result = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                result = result.get('tool_response')
            else:
                arxiv = ArxivAPIWrapper()
                result = arxiv.run(query)
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'arxiv_tool_cache.json', 'w') as f:
                        f.write(json.dumps({'tool_response': result}))
            return result
        except Exception as e:
            # Log the exception or handle it as needed
            return f"An error occurred while fetching data from arXiv: {str(e)}"