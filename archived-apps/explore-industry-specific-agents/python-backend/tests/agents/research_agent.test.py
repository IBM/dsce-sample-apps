import unittest
from agents.research_agent import ResearchAgent

class TestWikipediaTool(unittest.TestCase):

    def setup(self):
        self.obj = ResearchAgent()

    def test_invoke_tool(self):
        reasoning, response, metadata = self.obj.get_research_info(
            "Can you help me gather recent studies on machine learning applications in healthcare?"
        )
        self.assertIsNotNone(reasoning)
        self.assertIsNotNone(response)
        self.assertIsNotNone(metadata)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()