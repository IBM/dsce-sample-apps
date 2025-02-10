import json
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.document_loaders import WikipediaLoader
from langchain_community.utilities import GoogleSerperAPIWrapper
import re
import requests
from config.app_config import AppConfig

class DuckDuckGoSearchTool:
    def __init__(self):
        pass

    def duckduckgo_search_tool(self, query: str) -> str:
        """
        Search the web with DuckDuckGo API.

        Args:
            query (str): The search query string.

        Returns:
            str: search results obtained from DuckDuckGo.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'r') as f:
                    result = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                result = result.get('tool_response')
            else:
                search = DuckDuckGoSearchResults()
                result = search.invoke(query)
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'w') as f:
                        json.dump({'tool_response': result}, f)
            return result
        except Exception as e:
            print(f"Error: {e}")
            return 'Cannot perform DuckDuckGo search.'

class GoogleSearchTool:
    def __init__(self):
        pass

    def google_search_tool(self, query: str) -> dict:
        """
        Search the web with google search.

        Args:
            query (str): The search query string.

        Returns:
            dict: A dictionary containing the results.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'r') as f:
                    result = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                result = result.get('tool_response')
            else:
                search = GoogleSerperAPIWrapper()
                result = search.results(query)
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'w') as f:
                        json.dump({'tool_response': result}, f)
            return result
        except Exception as e:
            print(f"Error: {e}")
            return {'error': 'Cannot perform Google search.'}

class WikipediaSearchTool:
    def __init__(self, load_max_docs=2):
        self.load_max_docs = load_max_docs

    def wikipedia_tool(self, query: str) -> str:
        """
        Query Wikipedia for information and return the result as a string.

        Args:
            query (str): The search query string to retrieve information from Wikipedia.

        Returns:
            str: A string containing the retrieved information from Wikipedia.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'r') as f:
                    result = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                result = result.get('tool_response')
            else:
                # Search
                search_docs = WikipediaLoader(
                    query=query,
                    load_max_docs=self.load_max_docs
                ).load()

                # Format
                formatted_search_docs = "\n\n---\n\n".join(
                    [
                        f'<Document source="{doc.metadata["source"]}" page="{doc.metadata.get("page", "")}"/>\n{doc.page_content}\n</Document>'
                        for doc in search_docs
                    ]
                )

                result = {"context": [formatted_search_docs]}
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'w') as f:
                        json.dump({'tool_response': result}, f)
            return result
        except Exception as e:
            print(f"Error: {e}")
            return {"error": "Cannot perform Wikipedia search."}

class WebCrawlerTool:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36"
        }

    def clean_text(self, text):
        link_pattern = r"https?://[^\s]+"
        image_pattern = r"\[(Image\s+\d+)|(!\[.+?\]\(.+\))\]\(.+\)"
        clean_text = re.sub(link_pattern, "", text)
        clean_text = re.sub(image_pattern, "", clean_text)
        clean_text = clean_text.replace("[!](", "").replace("!](", "").replace("URL Source:", "").replace("Markdown Content:", "").replace("Title:", "")
        return clean_text
    
    def webcrawler_tool(self, url):
        """
        Takes url as input string, extracts the web content and return the output in string.
        Args:
            url: The url of the web page.
        
        Returns:
            str: The crawled web page.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'r') as f:
                    result = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                result = result.get('tool_response')
            else:
                response = requests.get("https://r.jina.ai/" + url)
                result = response.text
                if len(result) == 0:
                    return result
                self.result = self.clean_text(result)
                result = self.result
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'web_search_tool_cache.json', 'w') as f:
                        json.dump({'tool_response': result}, f)
            return result
        except Exception as e:
            print(f"Error: {e}")
            return 'Cannot scrape the website.'