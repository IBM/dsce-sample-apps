from typing import Literal
from ibm_watsonx_ai.foundation_models import ModelInference
from config.app_config import AppConfig

class WatsonxModelCall:
    def __init__(self, usecase: Literal['travel_agent', 'research_agent', 'financial_agent']):
        self.app_config = AppConfig()
        self.usecase = usecase
        if self.usecase == 'travel_agent':
            self.model = ModelInference(
			model_id = self.app_config.MODEL.GRANITE_3_8_B_INSTRUCT,
			credentials = {
				"apikey": self.app_config.IBM_CLOUD_API_KEY,
				"url": self.app_config.WX_ENDPOINT
			},
			project_id = self.app_config.WX_PROJECT_ID,
			params = self.app_config.PARAMETERS,
		)
            self.prompt = "I am planning a trip to New York city next week. Can you get me information about the tourist attractions, weather forecast and social events?"
        elif self.usecase == 'research_agent':
            self.model = ModelInference(
			model_id = self.app_config.MODEL.LLAMA_3_70_B_INSTRUCT,
			credentials = {
				"apikey": self.app_config.IBM_CLOUD_API_KEY,
				"url": self.app_config.WX_ENDPOINT
			},
			project_id = self.app_config.WX_PROJECT_ID,
			params = self.app_config.PARAMETERS
		)
            self.prompt = "What are some advancements in machine learning applications in healthcare?"
        elif self.usecase == 'financial_agent':
            self.model = ModelInference(
			model_id = self.app_config.MODEL.GRANITE_3_8_B_INSTRUCT,
			credentials = {
				"apikey": self.app_config.IBM_CLOUD_API_KEY,
				"url": self.app_config.WX_ENDPOINT
			},
			project_id = self.app_config.WX_PROJECT_ID,
			params = self.app_config.PARAMETERS
		)
            self.prompt = "What's the recent trend in tech stocks?"
        
    def invoke(self):
        return self.model.generate_text(prompt=self.prompt)

if __name__ == '__main__':
    obj = WatsonxModelCall(usecase='travel_agent')
    response = obj.invoke()
    print(response)