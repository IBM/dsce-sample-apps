import unittest
from agents.tools.web_search_tool import WikipediaSearchTool, DuckDuckGoSearchTool, WebCrawlerTool, GoogleSearchTool

class TestWikipediaTool(unittest.TestCase):

    def setup(self):
        self.obj = WikipediaSearchTool()

    def test_invoke_tool(self):
        result = self.obj.wikipedia_tool('Bengaluru')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

class TestGoogleSearchTool(unittest.TestCase):

    def setup(self):
        self.obj = GoogleSearchTool()

    def test_invoke_tool(self):
        result = self.obj.google_search_tool('Social events in Bengaluru')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

class TestDuckDuckGoSearchTool(unittest.TestCase):

    def setup(self):
        self.obj = DuckDuckGoSearchTool()

    def test_invoke_tool(self):
        result = self.obj.duckduckgo_search_tool('Social events in Bengaluru')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

class TestWebCrawlerTool(unittest.TestCase):

    def setup(self):
        self.obj = WebCrawlerTool()

    def test_invoke_tool(self):
        result = self.obj.webcrawler_tool("https://dsce.ibm.com/watsonx")
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()