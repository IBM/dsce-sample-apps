import sys
import os
import json
from time import time
import datetime
import logging

import tiktoken

from routers.common import GeneratePayload
from services.services_factory import ServicesFactory
from services.utils import CommonUtils
# from ibm_watsonx_ai.foundation_models import Model
from ibm_watsonx_ai.foundation_models import ModelInference

import llama_index.core
from llama_index.llms.ibm import WatsonxLLM
from llama_index.core import Settings
from llama_index.core.callbacks import CallbackManager, LlamaDebugHandler, CBEventType, TokenCountingHandler
from llama_index.core import PromptTemplate

from ibm_watsonx_ai import APIClient, Credentials

from main import app
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

# logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
# logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

llama_index.core.set_global_handler("simple")

class NodeEncoder(json.JSONEncoder):
		def default(self, o):
			return o.__dict__

class WatsonX_Service:
	def __init__(self) -> None:
		self.utils: CommonUtils = ServicesFactory.get_common_utils()
		self.WX_ENDPOINT = os.environ.get('WX_ENDPOINT', None)
		self.IBMCLOUD_API_KEY = os.environ.get('IBMCLOUD_API_KEY', None)
		os.environ["WATSONX_APIKEY"] = self.IBMCLOUD_API_KEY
		self.WX_PROJECT_ID = os.environ.get('WX_PROJECT_ID', None)
		self.token = None
		credentials = Credentials(url = self.WX_ENDPOINT, api_key = self.IBMCLOUD_API_KEY)
		self.client = APIClient(credentials)
		# DEFAULT_TEMPLATE_STR = ("<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou always answer the questions with markdown formatting. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.\n\nAny HTML tags must be wrapped in block quotes, for example ```<html>```. You will be penalized for not rendering code in block quotes.\n\nWhen returning code blocks, specify language.\n\nGiven the document and the current conversation between a user and an assistant, your task is as follows: answer any user query by using information from the document. Always answer as helpfully as possible, while being safe. When the question cannot be answered using the context or document, output the following response: \"I cannot answer that question based on the provided document.\".\n\nYour answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n[Document]\n{context_str}\n[End]\n\n<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{query_str}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n")
		# DEFAULT_TEMPLATE_STR = ("[Document]\n{context}\n[End]\n\n\nINSTRUCTIONS:\n\nYou always answer the questions with markdown formatting. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.\n\nAny HTML tags must be wrapped in block quotes, for example ```<html>```. You will be penalized for not rendering code in block quotes.\n\nWhen returning code blocks, specify language.\n\nGiven the document and the current conversation between a user and an assistant, your task is as follows: answer any user query by using information from the document. Always answer as helpfully as possible, while being safe. When the question cannot be answered using the context or document, output the following response: \"I cannot answer that question based on the provided document.\".\n\nYour answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don'\''t know the answer to a question, please don'\'t share false information.\"\n\nUSER: {query}\n\nASSISTANT:\n")
		# self.DEFAULT_TEMPLATE = PromptTemplate(template=DEFAULT_TEMPLATE_STR, template_var_mappings={"query_str": "query", "context_str": "context"},)
		DEFAULT_TEMPLATE_STR = """<|start_of_role|>system<|end_of_role|>You are Granite, an AI language model developed by IBM in 2024. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You are a AI language model designed to function as a specialized Retrieval Augmented Generation (RAG) assistant. When generating responses, prioritize correctness, i.e., ensure that your response is correct given the context and user query, and that it is grounded in the context. Furthermore, make sure that the response is supported by the given document or context. Always make sure that your response is relevant to the question. If an explanation is needed, first provide the explanation or reasoning, and then give the final answer. Avoid repeating information unless asked.<|end_of_text|>
		<|start_of_role|>user<|end_of_role|>Use the following pieces of context to answer the question.

		{context}

		Question: {query}<|end_of_text|>
		<|start_of_role|>assistant<|end_of_role|>"""
		DEFAULT_TEMPLATE = PromptTemplate(template=DEFAULT_TEMPLATE_STR, template_var_mappings={"query_str": "query", "context_str": "context"},)
		
	def verify_token(self):
		if self.token == None:
			return False
		
		now = datetime.datetime.utcnow()
		expiration_time = self.token.get('expiration')
		if expiration_time is None:
			return True
		token_expire_time = datetime.datetime.fromtimestamp(expiration_time)
		return now > token_expire_time
  
	def fetchToken(self):
		FETCH_TOKEN_ENDPOINT = "https://iam.cloud.ibm.com/identity/token"
		payload = {
					"grant_type": "urn:ibm:params:oauth:grant-type:apikey",
					"apikey": self.IBMCLOUD_API_KEY
				}
		
		# async with AsyncClient(timeout=30) as client:
		request = app.client.build_request(method='POST', url=FETCH_TOKEN_ENDPOINT, data=payload)
		response = app.client.send(request)
		tokenJson = response.json()
		# print(tokenJson)
		return tokenJson
	
	async def refreshToken(self):
		self.token = self.fetchToken()
		return self.token
	
	async def fetchLLMSpecs(self):
		llmSpecs = self.client.foundation_models.get_model_specs()
		# logger.info(f"\nllmSpecs: {json.dumps(llmSpecs, indent=2)}\n")
		wx_prices = self.__fetch_pricing("watsonx")
		logger.info(f"\nwx_prices: {wx_prices}\n")
		result = []
		for llmSpec in llmSpecs['resources']:
			if 'lifecycle' in llmSpec and len(llmSpec['lifecycle']) > 0 and llmSpec['lifecycle'][0]['id'] == 'available':
				if wx_prices is not None and 'tasks' in llmSpec and 'input_tier' in llmSpec:
					# logger.debug(f"\nllmSpec: {json.dumps(llmSpec, indent=2)}\n")
					logger.debug(f"LLM: {llmSpec['model_id']}, input_tier: {llmSpec['input_tier']}")
					logger.debug(f"LLM: {llmSpec['model_id']}, output_tier: {llmSpec['output_tier']}")

					if llmSpec["input_tier"] in wx_prices:
						llmSpec['price_input'] = wx_prices[llmSpec["input_tier"]]
					if 'output_tier' in llmSpec and llmSpec["output_tier"] in wx_prices:
						llmSpec['price_output'] = wx_prices[llmSpec["output_tier"]]
					llmSpec['platform'] = "watsonx"
					llmSpec['pricing_page'] = "https://www.ibm.com/products/watsonx-ai/foundation-models#generative"
					result.append(llmSpec)		
		return result

	def generate(self, payload: GeneratePayload):
		start_time = time()
		output = self.__generate_using_API(payload)
		
		end_time = time()
		api_call_time = end_time - start_time
		result = {
			"output": output,
			"time_taken": api_call_time
		}
		return result
	
	def __generate_using_API(self, payload: GeneratePayload):
		if self.verify_token() == False:
			self.token = self.fetchToken()	
		ENDPOINT = f"{self.WX_ENDPOINT}/ml/v1/text/generation?version=2023-05-29"
		headers = {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Authorization": f"Bearer {self.token['access_token']}"
		}

		data = {
			"input": payload.input,
			"parameters": payload.parameters,
			"model_id": payload.modelid,
			"project_id": self.WX_PROJECT_ID
		}
		# async with AsyncClient(timeout=30) as client:
		request = app.client.build_request(method='POST', url=ENDPOINT, json=data, headers=headers)
		response = app.client.send(request)
		# client.aclose()	
		if response.status_code != 200:
			if response.status_code == 401:
				self.token = self.fetchToken()
			else:
				raise Exception("Non-200 response: " + str(response.text))
		else:
			resp = response.json()
			if "results" in resp and len(resp["results"]) > 0:
				return resp["results"][0]
			else:
				return resp

	def generate_direct(self, payload: GeneratePayload, asynchronous=False):
		# logger.debug(f"\n\nIN Watsonx_Service.generate_direct, payload: {payload}\n\n")
		start_time = time()
		model = ModelInference(
			model_id=payload.modelid,
			params=payload.parameters,
			credentials={
				"apikey": self.IBMCLOUD_API_KEY,
				"url": self.WX_ENDPOINT
			},
			project_id=self.WX_PROJECT_ID
		)

		token_counter = TokenCountingHandler()
		token_counter.reset_counts()
		api_start_time = time()
		if asynchronous == True:
			resp = model.generate_text_stream(prompt=payload.input, raw_response=True)
			text = ""
			generated_token_count = 0
			for chunk in resp:
				if "results" in chunk and len(chunk["results"]) > 0:
					# print(f"chunk 1: {chunk}")
					token = chunk["results"][0]["generated_text"]
					text = text + token					
					generated_token_count = chunk["results"][0]["generated_token_count"]
					yield token
				else:
					# print(f"chunk 2: {chunk}")
					yield chunk
				
			
			result = {
				"generated_text": text,
				"source_nodes": [],
				"metadata": {},
				"stop_reason": "COMPLETED",
				# "generated_token_count": len(text) * 3/4,
				# "input_token_count": len(payload.input) * 3/4,
				"generated_token_count": generated_token_count
				# "total_llm_token_count": token_counter.total_llm_token_count
			}

			end_time = time()
			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time
			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time

			print(f"\n\n\nRESPONSE COMPLETED FOR {payload.modelid}, in {llm_call_time} llm_call_time and {total_time} total_time, stop_reason {result['stop_reason']}\n")
			print(f"generated_token_count: {result['generated_token_count']}\n\n\n")
			
			yield json.dumps(result)
		else:	
			resp = model.generate(payload.input, async_mode=False)
			print(resp)
			if "results" in resp and len(resp["results"]) > 0:
				return resp["results"][0]
			else:
				return resp
			
	def display_prompt_dict(self, prompts_dict):
		for k, p in prompts_dict.items():
			text_md = f"**Prompt Key**: {k}<br>" f"**Text:** <br>"
			print(text_md)
			print(p.get_template())
			print("\n\n")
				
	def generate_using_LI(self, payload: GeneratePayload, asynchronous=False):
		logger.debug(f"\n\nIN Watsonx_Service.generate_using_LI, payload: {payload}\n\n")

		llama_debug = LlamaDebugHandler(print_trace_on_end=True)
		# callback_manager = CallbackManager([llama_debug])
		start_time = time()
		
		watsonx_llm = WatsonxLLM(
			model_id=payload.modelid,
			url=self.WX_ENDPOINT,
			project_id=self.WX_PROJECT_ID,
			additional_params=payload.parameters,
		)
		if payload.vectordb_config is None:
			raise ServiceException("vectordb_config is missing in the payload")
		
		vectorDbService = ServicesFactory.get_vectordb_service(dbName=payload.vectordb_config.db_name.value)
		index, embed_model = vectorDbService.fetch_index(payload.vectordb_config, REFRESH=False) 
		
		token_counter = TokenCountingHandler()
		Settings.callback_manager = CallbackManager([token_counter, llama_debug])
		Settings.llm = watsonx_llm
		if embed_model is not None:
			Settings.embed_model = embed_model

		# prompt = self.DEFAULT_TEMPLATE.format(context=..., query=...)
			
		token_counter.reset_counts()
		query_engine = index.as_query_engine(
			summary_template=self.DEFAULT_TEMPLATE,
			similarity_top_k=3, 
			response_mode=payload.vectordb_config.response_mode.value, 
			streaming=asynchronous, 
			verbose=True)
		
		query_engine.update_prompts(
			{"response_synthesizer:summary_template": self.DEFAULT_TEMPLATE}
		)

		prompts_dict = query_engine.get_prompts()
		self.display_prompt_dict(prompts_dict)

		api_start_time = time()
		query_res = query_engine.query(payload.input)
		text = ""
		if asynchronous == True:
			streamResp = query_res.response_gen			
			for token in streamResp:
				text = text + token
				yield token

			result = {
				"model_id": payload.modelid,
				"generated_text": text,
				"source_nodes": [],
				"metadata": query_res.metadata,
				"stop_reason": "not_finished"
			}

			# json.dumps([ob.__dict__ for ob in query_res.source_nodes])

			nodes = []
			for node in query_res.source_nodes:
				nodes.append(node.to_json())

			end_time = time()
			llm_call_time = end_time - api_start_time
			total_time = end_time - start_time
			result["llm_call_time"] = llm_call_time
			result["total_time"] = total_time
			
			result["source_nodes"] = nodes
			result["stop_reason"] = "COMPLETED"
			result["generated_token_count"] = token_counter.completion_llm_token_count
			result["total_llm_token_count"] = token_counter.total_llm_token_count
			# result["input_token_count"] = token_counter.total_llm_token_count - token_counter.completion_llm_token_count
			print(f"\n\n\nRESPONSE COMPLETED FOR {payload.modelid}, in {llm_call_time} llm_call_time and {total_time} total_time, stop_reason {result['stop_reason']}\n")
			print(f"generated_token_count: {result['generated_token_count']}, total_llm_token_count: {result['total_llm_token_count']}\n\n\n")
			yield json.dumps(result)
			
		else:
			result = {
				"model_id": payload.modelid,
				"generated_text": f"{query_res}",
				"source_nodes": [],
				# "metadata": query_res.metadata,
				"stop_reason": "not_finished"			
			}

			# json.dumps([ob.__dict__ for ob in query_res.source_nodes])
			nodes = []
			# for node in query_res.source_nodes:
			# 	nodes.append(node.to_json())
			
			result["source_nodes"] = nodes
			result["stop_reason"] = "COMPLETED"
			result["generated_token_count"] = token_counter.completion_llm_token_count
			result["total_llm_token_count"] = token_counter.total_llm_token_count
			# result["input_token_count"] = token_counter.total_llm_token_count - token_counter.completion_llm_token_count

			end_time = time()
			api_call_time = end_time - api_start_time
			total_time = end_time - start_time
			logger.debug(f"\n\n\nRESPONSE COMPLETED FOR {payload.modelid}, in {api_call_time} api_call and {total_time} total time, stop_reason {result['stop_reason']}\n\n\n")
			# yield query_res
			yield result

	def __fetch_pricing(self, platform):
		key = f"pricing_{platform}"
		result = self.utils.getFromDB(key)
		if result is None or result == False:
			result = {"class_c1": 0.10, "class_8": 0.15, "class_12": 0.20, "class_9": 0.35, "class_1": 0.60, "class_2": 1.80, "class_10": 2.0, "class_3": 5.0, "class_7": 16.0, "mistral_large": 10.0}
			self.utils.setInDB(key, result)
		
		return result
		