from ibm_watsonx_ai.foundation_models import ModelInference
from langchain_ibm import WatsonxLLM
from config.app_config import AppConfig
app_config = AppConfig()

class Watsonx:
	def __init__(self, model, langchain_wrapper=False,) -> None:
		self.model = model
		self.use_langchain_wrapper = langchain_wrapper
		self.initialize_llm()	

	def initialize_llm(self):
		self.model = ModelInference(
			model_id = self.model,
			credentials = {
				"apikey": app_config.IBM_CLOUD_API_KEY,
				"url": app_config.WX_ENDPOINT
			},
			project_id = app_config.WX_PROJECT_ID,
			params = app_config.PARAMETERS
		)
		if self.use_langchain_wrapper:
			langchain_wrapper = WatsonxLLM(watsonx_model=self.model)
			self.model = langchain_wrapper

	def get_llm(self) -> ModelInference | WatsonxLLM:
		return self.model