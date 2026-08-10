import os
from flask import Flask, Response, g, request
from flasgger import Swagger
from core.framework import *
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# APIs section.

# Get providers list based on aiTask
# Special values for aiTask :
#   "all" - to get all available ai tasks
#   "provider_wise_tasks" - to get all providers & ai tasks supported by each of them
@app.route('/get-providers/<aiTask>', methods=["GET"])
def get_providers(aiTask):

    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    return find_providers(aiTask)

# Get all tags based on provider and aiTask
# Sample request body :
# {
#    "provider": "",
#    "aiTask": ""
# }
@app.route('/get-tags', methods=["POST"])
def get_search_tags():

    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    body = request.json
    providerName = body.get("provider")
    aiTask = body.get("aiTask")

    return find_search_tags(providerName, aiTask)

# Get examples from the payload
# Sample request body :
# {
#    "provider": "",
#    "search": ["", ""]
# }
@app.route('/get-examples', methods=["POST"])
def get_examples():

    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    body = request.json
    providerName = body.get("provider")
    searchList = body.get("search")

    error = validateMandatoryProviderAndSearchFields(providerName, searchList)
    if isinstance(error, Response):
        return error

    return find_examples(providerName, searchList)

# Set examples in the payload
# Sample request body :
# {
#    "provider": "",
#    "search": ["", ""],
#    "text": ""
# }
@app.route('/update-examples', methods=["POST"])
def set_examples():

    # Authorize request/user
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    body = request.json
    providerName = body.get("provider")
    searchList = body.get("search")
    text = body.get("text")

    error = validateMandatoryProviderAndSearchFields(providerName, searchList)
    if isinstance(error, Response):
        return error
    if text is None:
        return Response("Missing mandatory fields in body.", status=400)

    return update_examples(providerName, searchList, text)

# Find the prompt based on search parameters
# Sample request body :
# {
#    "provider": "",
#    "search": ["", ""]
# }
@app.route('/find-prompt', methods=["POST"])
def find_prompt():

    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    body = request.json
    providerName = body.get("provider")
    searchList = body.get("search")
    error = validateMandatoryProviderAndSearchFields(providerName, searchList)
    if isinstance(error, Response):
        return error

    payloads = pick_prompt(providerName, searchList)
    return payloads

# Find prompt and make the LLM call to selected provider.
# Returns paylods array as a response if multiple payloads are found.
# Sample request body :
# {
#    "provider": "",
#    "search": ["", ""],
#    "input_text": "",
#    "OPENAI_API_KEY": "", required when provider is "openai" & you want to consume user provided key
# }
@app.route('/find-execute-prompt', methods=["POST"])
def find_and_execute_prompt():

    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)

    body = request.json
    providerName = body.get("provider")
    searchList = body.get("search")
    inputText = body.get("input_text")

    if providerName == 'OpenAI':
        if 'OPENAI_API_KEY' not in body:
            return Response("Missing openai api key.", status=400)
        else:
            g.USER_OPENAI_API_KEY = body["OPENAI_API_KEY"]

    error = validateMandatoryProviderAndSearchFields(providerName, searchList)
    if isinstance(error, Response):
        return error
    if inputText is None:
        return Response("Missing mandatory fields in body.", status=400)

    payloads = pick_prompt(providerName, searchList)

    if payloads is not None and len(payloads) != 1:
        return payloads
    providerTuple = (payloads[0], providerName)
    return call_llm(providerTuple, inputText)

# Temporary endpoint just to verify globals
@app.route('/read', methods=["GET"])
def read_globals():
    # Authorize request
    auth_code = request.headers.get('APIAUTHCODE')
    if(not isVerified(auth_code)):
        return Response("Forbidden", status=403)
    return dict(provider_json_master=provider_json_master, provider_task_master=provider_task_master)

# Private methods section.
def isVerified(auth_code):
    return auth_code==os.getenv('APIAUTHCODE', default="eaa9ef370841")

def validateMandatoryProviderAndSearchFields(providerName, searchList):
    error = None

    if providerName is None or searchList is None:
        error = Response("Missing mandatory fields in body.", status=400)
    elif not isinstance(searchList, list):
        error = Response("'search' field in the body must be an array.", status=400)

    return error

# OpenAPI configuration
swagger_config = {
    "headers": [
    ],
    "title": "Trifecta - Framework API documentation",
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,  # all in
            "model_filter": lambda tag: True,  # all in
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs/"
}

Swagger(app, template_file='openapi-specs.yaml', config=swagger_config)

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8000")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="False"))
    app.run(port=SERVICE_PORT, debug=DEBUG_MODE)