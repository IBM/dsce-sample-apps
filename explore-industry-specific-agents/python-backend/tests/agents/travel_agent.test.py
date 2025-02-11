import unittest
from agents.travel_agent import TravelAgent

class TestWikipediaTool(unittest.TestCase):

    def setup(self):
        self.obj = TravelAgent()

    def test_invoke_tool(self):
        reasoning, response, metadata = self.obj.get_travel_info(
            "I am planning a trip to New York next week. Can you get me information about the tourist attractions, weather forecast and social events?"
        )
        self.assertIsNotNone(reasoning)
        self.assertIsNotNone(response)
        self.assertIsNotNone(metadata)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()