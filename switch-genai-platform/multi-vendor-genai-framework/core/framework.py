import os, requests, json, time, copy, jmespath, re
from flask import g
from functools import reduce
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from datetime import datetime
from core.payloadParser import parsePayload, defaultExampleParser, defaultInstructionParser
from dotenv import load_dotenv
load_dotenv()

# Core framework methods

all_providers = {}
with open('providers.json') as p:
    all_providers = json.load(p)

provider_json_master = {}
task_wise_providers = {}

# Prepare in-memory objects from payload files on server startup for performance optimization.
def perpare_with_defaults():
	global provider_json_master
	global task_wise_providers
	for prov in all_providers.keys():
		file = open(f"payload/{prov}-payload.json")
		file_json = json.load(file)
		provider_json_master[prov] = file_json

		for task in file_json:
			aiTask = task['ai_task']
			ar = task_wise_providers.get(aiTask) or []
			ar.append(prov)
			task_wise_providers[aiTask] = list(set(ar))

perpare_with_defaults()
# Master dict
provider_task_master = dict(task_wise_providers=task_wise_providers)


# List available providers supporting the provided ai_task.
def find_providers(aiTask):
	if aiTask == 'all':
		return provider_task_master["task_wise_providers"]
	return {aiTask: provider_task_master["task_wise_providers"].get(aiTask)}

# List all search tags based on provider and aiTask.
def find_search_tags(provider, aiTask):
	providerFullConfigFile = provider_json_master[provider]
	providerFullConfigFileCopy = copy.deepcopy(providerFullConfigFile)

	result = jmespath.search(f"[?ai_task == '{aiTask}'].search_tags", providerFullConfigFileCopy)
	tags = list(set(reduce(lambda x,y: x+y, result)))
	tags = list(filter(lambda t: not re.match('^uid-', t), tags))
	tags.sort()
	return tags

# Search examples from payload based on the search criteria.
# This method uses 'defaultExampleParser' to parse payload and extract example string.
# To use your custom logic, overwrite or create a new parser method & use that instead of 'defaultExampleParser'.
def find_examples(provider, searchTags):
	payloads = search_in_master(provider, searchTags)

	if payloads is not None and len(payloads) != 1:
		return "Please improve your search criteria to get a single match for payload. Found either none or multiple payloads based on your inputs."
	
	input_var = payload_input_variable(provider)
	# Payload parser to find the examples
	return parsePayload(payloads[0], input_var, defaultExampleParser)

# Set examples to payload file
# This method uses 'defaultInstructionParser' to parse payload and extract instruction string.
# To use your custom logic, overwrite or create a new parser method & use that instead of 'defaultInstructionParser'.
def update_examples(provider, searchTags, text):
	payloads = search_in_master(provider, searchTags, False)

	if payloads is not None and len(payloads) != 1:
		return "Please improve your search criteria to get a single match for payload. Found either none or multiple payloads based on your inputs."

	input_var = payload_input_variable(provider)
	# Payload parser to find an instruction
	instruction = parsePayload(payloads[0], input_var, defaultInstructionParser)
	new_prompt = "{}{}".format(instruction, text)

	payloads[0][input_var] = new_prompt

	# Write the new prompt to provider file.
	file = open(f"payload/{provider}-payload.json", "w+")
	json.dump(provider_json_master[provider], file, indent=2)

	return "Examples set successfully."

# Find a prompt based on the provider name & search_tags provided.
def pick_prompt(provider, searchTags):
	payloads = search_in_master(provider, searchTags)
	return payloads

# Call the LLM api with provided payload and input. Returns response from LLM.
def call_llm(providerTuple, text):
	try:
		provider, payload, header, request_url = _prepare_payload_and_header(providerTuple, text)
		print(f"{datetime.now()} calling LLM with '{provider}' as a provider")
		response = requests.post(request_url, headers=header, data=payload)
		response_json = response.json()
		print('response generated.')
		return response_json
	except Exception as e:
		e.with_traceback()
		print("call_llm: Error")

# Private methods section.
def payload_input_variable(provider):
	provider_details = all_providers[provider]
	return provider_details['payload_input_var']

def _prepare_payload_and_header(providerTuple, text):
	payload_json, provider = providerTuple

	provider_details = all_providers[provider]
	input_var = payload_input_variable(provider)
	payload_json[input_var] = payload_json[input_var] + "Input:" + text + "\n\nOutput:\n"

	if 'project_id' in payload_json:
		payload_json['project_id'] = os.getenv(provider_details['projectid'])
	
	header = {}
	if 'apikey' in provider_details:
		apikey = os.getenv(provider_details['apikey']) or g.USER_OPENAI_API_KEY
		if provider_details['authtype'] == 'token':
			authenticator = IAMAuthenticator(apikey)
			apikey = authenticator.token_manager.get_token()
		header = {
			'accept': 'application/json',
			'content-type': 'application/json',
			'Authorization': 'Bearer {}'.format(apikey)
		}
	else:
		print("No api key found")

	return provider, json.dumps(payload_json), header, provider_details['url']

# Lookup in the in-memory master dictionary and return payload (either a copy or actual reference of master dictionary)
def search_in_master(provider, searchTags, returnCopy=True):
	providerFullConfigFile = provider_json_master[provider]

	configuredList = copy.deepcopy(providerFullConfigFile) if returnCopy else providerFullConfigFile
	searchList = set(searchTags if isinstance(searchTags, list) else [searchTags])
	matchingPayloads = []
	for config in configuredList:
		searchTags = set(config['search_tags'])
		if searchList.issubset(searchTags):
			matchingPayloads.append(config['payload'])
	return matchingPayloads
