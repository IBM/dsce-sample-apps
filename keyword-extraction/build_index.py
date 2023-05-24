#
# build_index.py: Use to process a set of records and create inverted index files used for searching data.
# The inverted index files record docids/record ids for each keyword / entity extracted by the libraries.
#

import requests
import json
import pandas as pd
from datetime import datetime

SERVER_URL = 'https://8f96122371.dsceapp.buildlab.cloud'

headers = {
        'accept': 'application/json',
        'content-type': 'application/json',
    }

# extracts keywords from text using library API
def extract_keywords(text):
    REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/KeywordsPredict'

    MODEL_STOCK = 'keywords_text-rank-workflow_lang_en_stock'

    payload = {
       'rawDocument': {
            'text': text
        },
        'limit': 5
    }

    headers['grpc-metadata-mm-model-id'] = MODEL_STOCK
    response = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
    response_json = response.json()
    keywords_list = response_json['keywords']
    key_list = []
    for i in range(len(keywords_list)):
        dict_list = {}
        dict_list['phrase'] = keywords_list[i]['text']
        dict_list['relevance'] = keywords_list[i]['relevance']
        key_list.append(dict_list)
    return (key_list)

# extracts entities from text using library API
def extract_entities(text):
    REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/EntityMentionsPredict'

    MODEL_BILSTM = 'entity-mentions_bilstm-workflow_lang_en_stock'

    payload = {
        'rawDocument': {
            'text': text
        }
    }

    headers['grpc-metadata-mm-model-id'] = MODEL_BILSTM
    response_bilstm = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
    response_bilstm_json = response_bilstm.json()
    entities_list_bi = response_bilstm_json['mentions']
   
    return entities_list_bi


# read the CSV and process each record to build index files
df = pd.read_csv('hotel_review/uk_england_london_belgrave_hotel.csv').dropna(axis=0)

entity_index = {}
keywd_index = {}
start = datetime.now()

# Append new data to the existing dictionary
for i in range(len(df["text"])):
    print("Processing record ", i ," of ", len(df["text"]))

    # Get Keywords
    k_key_list = extract_keywords(df['text'][i])
    for item in k_key_list:
        # removing extra spaces between two words
        result = " ".join(item['phrase'].lower().split())
        if result in keywd_index:
            keywd_index[result].append(i)
        else:
            keywd_index[result] = [i]
    
    # Get Entities
    e_key_list = extract_entities(df['text'][i])
    for item in e_key_list:
        # removing extra spaces between two words
        result = " ".join(item['span']['text'].lower().split())
        
        # For index_keywords.json
	# currently entity values are also added to keywords - this needs to be fixed
        if result in keywd_index:
            if i not in keywd_index[result]:
                keywd_index[result].append(i)
        else:
            keywd_index[result] = [i]
        
        # For index_entities.json
        item_dict = {item['type'] : result }
        item_dict = json.dumps(item_dict)
        if item_dict in entity_index:
            if i not in entity_index[item_dict]:
                entity_index[item_dict].append(i)
        else:
            entity_index[item_dict] = [i]

# create the index files
with open('index_keywords.json', 'w') as file:
    json.dump(keywd_index, file)
with open('index_entities.json', 'w') as file:
    json.dump(entity_index, file)

# record processing time and print
end = datetime.now()
print("start = ", start)
print("end = ", end)
