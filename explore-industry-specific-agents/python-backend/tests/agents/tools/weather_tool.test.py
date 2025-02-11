import unittest
from agents.tools.weather_tool import OpenMetoTool, OpenWeatherMapTool

class TestOpenMetoTool(unittest.TestCase):

    def setUp(self):
        self.obj = OpenMetoTool()

    def test_invoke_tool(self):
        result = self.obj.weather_tool('Bengaluru')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

class TestOpenWeatherMapTool(unittest.TestCase):

    def setUp(self):
        self.obj = OpenWeatherMapTool()

    def test_invoke_tool(self):
        result = self.obj.open_weather_tool('Bengaluru')
        self.assertIsNotNone(result)
        # Add more assertions here based on the expected output of invoke_tool

if __name__ == '__main__':
    unittest.main()