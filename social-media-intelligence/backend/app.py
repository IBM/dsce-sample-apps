from flask import Flask,request
import json
from flask_cors import CORS
import functools

from social_media_issues import *
from regional_issues import *

import os
from dotenv import load_dotenv
import time

load_dotenv()

app = Flask(__name__)
CORS(app)
api_key = os.getenv('API_KEY')
cache = {}
cache_file_path = 'cache.json'
cache_initialized = False

def auth(api_key):
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    data = f'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={api_key}'
    response = requests.post('https://iam.cloud.ibm.com/identity/token', headers=headers, data=data)
    token = (response.json()['access_token'])
    return token

def save_cache_to_file(cache, file_path):
    with open(file_path, 'w') as f:
        json.dump(cache, f)

def load_cache_from_file(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

token = auth(api_key)

def cache_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Generate a unique key based on function's name and its arguments
        key = json.dumps({'args': args, 'kwargs': kwargs}, sort_keys=True)

        if key in cache:
            return cache[key]

        result = func(*args, **kwargs)
        cache[key] = result
        return result
    return wrapper

@app.before_request
def before_any_request():
    time.sleep(1)
    global cache_initialized
    if not cache_initialized:
        global cache
        cache = load_cache_from_file(cache_file_path)
        cache_initialized = True

@app.teardown_appcontext
def save_cache_on_shutdown(exception=None):
    save_cache_to_file(cache, cache_file_path)

@app.route('/summary', methods=['GET', 'POST']) # social_media_issues
def generate():
    mimetype = request.mimetype
    if mimetype == 'application/x-www-form-urlencoded':
        form = json.loads(next(iter(request.form.keys())))
    elif mimetype == 'multipart/form-data':
        form = dict(request.form)
    elif mimetype == 'application/json':
        form = request.json
    else:
        form = request.data.decode()
    
    input_value = form
    output = get_summary(input_value)
    return output

@app.route('/regional_summary', methods=['GET', 'POST']) # regional_issues
def regional_summary():
    mimetype = request.mimetype
    if mimetype == 'application/x-www-form-urlencoded':
        form = json.loads(next(iter(request.form.keys())))
    elif mimetype == 'multipart/form-data':
        form = dict(request.form)
    elif mimetype == 'application/json':
        form = request.json
    else:
        form = request.data.decode()
    
    input_value = form 

    # cleaned_string = json.loads(pre_output.replace("    ", "").replace("\n", "").replace("\\","").replace("```", ""))
    result = get_regional_issues(input_value)
    return result

@cache_decorator
def get_regional_issues(form):
    return RegionalIssues(form["city"], form['province'], form['affected_services'], form['concern'], form['tweets'], form['competitor'])

@cache_decorator
def get_summary(form):
    entity_dict = {"Affected Services": "unknown", "Area": "unknown", "Device": "unknown", "Duration": "unknown"}
    try:
        sentiment = sentimentGenerator(form['prompt'], token)
    except:
        sentiment = ""
    try:
        tone = toneGenerator(form['prompt'], token)
    except:
        tone = ""
    try:
        Entity_Prompt = form['prompt'] + "."
        entity = '{' + (entityExtractor(Entity_Prompt, token)) + '}'
        entity_dict = eval(entity)
    except:
        entity_dict = {"Affected Services": "unknown", "Area": "unknown", "Device": "unknown", "Duration": "unknown"}

    responsedict = reponseGenerator(form['carrier'], entity_dict["Affected Services"], form['prompt'], form['username'])
    output = {'Sentiment': sentiment, 'Tone': tone, "Entity": entity_dict, 'Generated Response': responsedict}
    return output

@app.route('/test/', methods=['GET'])
def test():
    return "Call is working!"

if __name__ == '__main__':
    cache = load_cache_from_file(cache_file_path)
    app.run(debug=True, host='0.0.0.0', port=5000)
