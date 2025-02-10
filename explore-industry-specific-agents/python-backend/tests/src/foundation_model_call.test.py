import unittest
from src.foundation_model_call import WatsonxModelCall

class TestTravelUsecaseFMCall(unittest.TestCase):

    def setup(self):
        self.obj = WatsonxModelCall(usecase='travel_agent')

    def test_invoke_tool(self):
        response = self.obj.invoke()
        self.assertIsNotNone(response)
        # Add more assertions here based on the expected output of invoke_tool

class TestResearchUsecaseFMCall(unittest.TestCase):

    def setup(self):
        self.obj = WatsonxModelCall(usecase='research_agent')

    def test_invoke_tool(self):
        response = self.obj.invoke()
        self.assertIsNotNone(response)
        # Add more assertions here based on the expected output of invoke_tool

class TestFinancialUsecaseFMCall(unittest.TestCase):

    def setup(self):
        self.obj = WatsonxModelCall(usecase='financial_agent')

    def test_invoke_tool(self):
        response = self.obj.invoke()
        self.assertIsNotNone(response)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()