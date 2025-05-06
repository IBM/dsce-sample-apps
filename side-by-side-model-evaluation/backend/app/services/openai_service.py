import os
import json
from time import time
import datetime
import logging
from dotenv import load_dotenv
from httpx import AsyncClient
import requests
from routers.common import GeneratePayload, ServiceException
from services.services_factory import ServicesFactory
from services.utils import CommonUtils

from llama_index.core import Settings
from llama_index.core.callbacks import CallbackManager, TokenCountingHandler

from llama_index.llms.openai import OpenAI

# from langchain.chains.llm import LLMChain
# from langchain_core.prompts import PromptTemplate

# from langchain_community.chat_models import ChatOpenAI
# from langchain_openai import ChatOpenAI
# from openai import OpenAI
# from langchain_community.callbacks import get_openai_callback

from main import app
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

load_dotenv()

class NodeEncoder(json.JSONEncoder):
	def default(self, o):
		return o.__dict__

class OpenAI_Service:
	def __init__(self, api_key: str = None) -> None:
		self.utils: CommonUtils = ServicesFactory.get_common_utils()
		if api_key is None:
			self.OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', None)
		else:
			self.OPENAI_API_KEY = api_key		

	async def fetchLLMSpecs(self):
		FETCH_LLM_SPECS_URL = f"https://api.openai.com/v1/models"
		# async with AsyncClient(timeout=30) as client:
		request = app.client.build_request(method='GET', url=FETCH_LLM_SPECS_URL, headers={"Authorization": f"Bearer {self.OPENAI_API_KEY}"})
		response = app.client.send(request)		
		# response = requests.get(FETCH_LLM_SPECS_URL, headers={"Authorization": f"Bearer {self.OPENAI_API_KEY}"})
		# logger.info(f"IN OpenAI_Service.fetchLLMSpecs, response: {response} ")
		# client.aclose()
		resp = response.json()
		result = []
		logger.info(f"IN OpenAI_Service.fetchLLMSpecs, data response: {resp} ")
		if resp and 'data' in resp:
			for llmSpec in resp['data']:
				# if 'owned_by' in llmSpec and (llmSpec['owned_by'] == 'openai' or llmSpec['owned_by'] == 'system'):
				if 'owned_by' in llmSpec and llmSpec['owned_by'] == 'openai':
					# logger.info(f"llmSpec: {llmSpec['tasks']}\n\n")
					llmSpec['model_id'] = llmSpec['id']
					llmSpec['label'] = llmSpec['id']
					llmSpec['platform'] = "openai"
					llmSpec['pricing_page'] = "https://openai.com/pricing"
					openai_pricings = self.__fetch_pricing("openai")
					if openai_pricings is not None and llmSpec['id'] in openai_pricings:
						llmSpec['price_input'] = openai_pricings[llmSpec['id']]['price_input']
						llmSpec['price_output'] = openai_pricings[llmSpec['id']]['price_output']
					else:
						llmSpec['price_input'] = 30
						llmSpec['price_output'] = 60
					result.append(llmSpec)
		elif resp and 'error' in resp and 'message' in resp['error']:
			raise ServiceException(status_code=404, detail=resp['error']['message'])
		else:
			result.append({
				"id": 'gpt-4',
				"model_id": 'gpt-4',
				"label": 'gpt-4',
				"platform": "openai",
				"price_input": 30,
				"price_output": 60,
				"pricing_page": "https://openai.com/pricing"
			});	
			result.append({
				"id": 'gpt-3.5-turbo',
				"model_id": 'gpt-3.5-turbo',
				"label": 'gpt-3.5-turbo',
				"platform": "openai",
				"price_input": 1.5,
				"price_output": 2,
				"pricing_page": "https://openai.com/pricing"
			});	
		return result
	
	def generate_direct(self, payload: GeneratePayload, asynchronous=True):
		logger.debug(f"\n\nIN OpenAI_Service.generate_direct, async: {asynchronous}, payload:>>>>>>>>>>> {payload}\n\n")
		start_time = time()
		openai_llm = OpenAI(api_key=self.OPENAI_API_KEY, model=payload.modelid, max_tokens=payload.parameters['max_new_tokens'])
		token_counter = TokenCountingHandler()
		Settings.callback_manager = CallbackManager([token_counter])
		Settings.llm = openai_llm
			
		token_counter.reset_counts()
		
		if asynchronous == True:
			api_start_time = time()
			text = ""
			query_res = openai_llm.stream_complete(payload.input, max_tokens=payload.parameters['max_new_tokens'])
			for r in query_res:
				token = r.delta
				text = text + token
				yield token

			result = {
				"generated_text": text,
				"source_nodes": [],
				"metadata": {},
				"stop_reason": "not_finished"
			}

			end_time = time()
			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time
			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time

			# json.dumps([ob.__dict__ for ob in query_res.source_nodes])
			result["source_nodes"] = []
			result["stop_reason"] = "COMPLETED"
			# result["generated_token_count"] = len(text) * 4/3
			result["generated_token_count"] = token_counter.completion_llm_token_count
			result["total_llm_token_count"] = token_counter.total_llm_token_count
			result["input_token_count"] = token_counter.total_llm_token_count - token_counter.completion_llm_token_count
			print(f"input_token_count: {result['input_token_count']}")
			resp = json.dumps(result)
			logger.debug(f"\n\n\n---------- ASYNC DIRECT RESPONSE COMPLETED FOR {payload.modelid}, in {llm_call_time} llm_call_time and {total_time} total_time, stop_reason {result['stop_reason']} ------------- \n\n\n")
			yield resp
			
		else:
			api_start_time = time()
			query_res = openai_llm.complete(payload.input, max_tokens=payload.parameters['max_new_tokens'])
			
			end_time = time()
			result = {
				"generated_text": query_res.text,
				"source_nodes": [],
				"metadata": {},
				"stop_reason": "COMPLETED",
				"generated_token_count": token_counter.completion_llm_token_count,
				"total_llm_token_count": token_counter.total_llm_token_count,
				"input_token_count": token_counter.total_llm_token_count - token_counter.completion_llm_token_count
			}

			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time
			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time
			
			logger.debug(f"\n\n\n---------- DIRECT RESPONSE COMPLETED FOR {payload.modelid}, generated_text: {result['generated_text']} ------------- \n\n\n")
			json.dumps(result)
			return result

	def generate_using_LI(self, payload: GeneratePayload, asynchronous=False):
		logger.debug(f"\n\nIN OpenAI_Service.generate_using_LI, payload:>>>>>>>>>>> {payload}\n\n")
		start_time = time()
		openai_llm = OpenAI(api_key=self.OPENAI_API_KEY, model=payload.modelid, max_tokens=payload.parameters['max_new_tokens'])
		if payload.vectordb_config is None:
			raise ServiceException("vectordb_config is missing in the payload")
		
		vectorDbService = ServicesFactory.get_vectordb_service(dbName=payload.vectordb_config.db_name.value)
		index, embed_model = vectorDbService.fetch_index(payload.vectordb_config, REFRESH=False)
		
		token_counter = TokenCountingHandler()
		Settings.callback_manager = CallbackManager([token_counter])
		Settings.llm = openai_llm
		if embed_model is not None:
			Settings.embed_model = embed_model
			
		token_counter.reset_counts()
		query_engine = index.as_query_engine(similarity_top_k=3, response_mode=payload.vectordb_config.response_mode.value, streaming=asynchronous, verbose=True)
		api_start_time = time()
		query_res = query_engine.query(payload.input)
		
		if asynchronous == True:			
			text = ""
			streamResp = query_res.response_gen	
			for token in streamResp:
				text = text + token
				yield token

			result = {
				"generated_text": text,
				"source_nodes": [],
				"metadata": {},
				"stop_reason": "not_finished"
			}

			# json.dumps([ob.__dict__ for ob in query_res.source_nodes])
			nodes = []
			# for node in query_res.source_nodes:
			# 	nodes.append(json.loads(json.dumps(node, cls=NodeEncoder)))

			end_time = time()
			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time
			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time

			result["source_nodes"] = nodes
			result["stop_reason"] = "COMPLETED"
			result["generated_token_count"] = token_counter.completion_llm_token_count
			result["total_llm_token_count"] = token_counter.total_llm_token_count,
			result["input_token_count"] = token_counter.total_llm_token_count - token_counter.completion_llm_token_count

			resp = json.dumps(result)
			logger.debug(f"\n\n\n---------- ASYNC RESPONSE COMPLETED FOR {payload.modelid}, in {llm_call_time} llm_call_time and {total_time} total_time, stop_reason {result['stop_reason']} ------------- \n\n\n")
			yield resp
			
		else:
			result = {
				"model_id": payload.modelid,
				"generated_text": f"{query_res.response}",
				"source_nodes": [],
				"metadata": {},
				"stop_reason": "not_finished"			
			}

			# json.dumps([ob.__dict__ for ob in query_res.source_nodes])
			nodes = []
			# for node in query_res.source_nodes:
			# 	nodes.append(json.loads(json.dumps(node, cls=NodeEncoder)))
			
			end_time = time()
			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time

			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time
			result["source_nodes"] = nodes
			result["stop_reason"] = "COMPLETED"
			result["generated_token_count"] = token_counter.completion_llm_token_count
			result["total_llm_token_count"] = token_counter.total_llm_token_count
			result["input_token_count"] = token_counter.total_llm_token_count - token_counter.completion_llm_token_count
			
			logger.debug(f"\n\n\n---------- RESPONSE COMPLETED FOR {payload.modelid}, in {llm_call_time} llm_call_time and {total_time} total_time, stop_reason {result['stop_reason']} ------------- \n\n\n")
			return result

	# def call_vision_model(self, payload):
	# 	client = OpenAI(api_key=self.OPENAI_API_KEY)
	# 	response = client.chat.completions.create(
	# 		model=payload.model_id,
	# 		messages=payload.messages,
	# 		max_tokens=payload.max_tokens,
	# 		)
	# 	result = response.choices[0]
	# 	return {"result": result}
	
	def __fetch_pricing(self, platform):
		key = f"pricing_{platform}"
		result = self.utils.getFromDB(key)
		if result is None or result == False:
			result = {
								"gpt-3.5-turbo": {"price_input": 1.5, "price_output": 2},
								"gpt-4-0613": {"price_input": 1.5, "price_output": 2},
								"gpt-4": {"price_input": 30, "price_output": 60},
								"gpt-4o-mini": {"price_input": 0.150, "price_output": 0.60},
								"gpt-4o": {"price_input": 2.50, "price_output": 10},
							}
			self.utils.setInDB(key, result)
		
		return result



	