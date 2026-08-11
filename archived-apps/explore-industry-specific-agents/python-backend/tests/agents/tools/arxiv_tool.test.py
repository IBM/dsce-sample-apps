import unittest
from agents.tools.arxiv_tool import ArxivTool

class TestArxivTool(unittest.TestCase):

    def setUp(self):
        self.obj = ArxivTool()

    def test_invoke_tool(self):
        result = self.obj.arxiv_tool('machine learning applications in healthcare')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()