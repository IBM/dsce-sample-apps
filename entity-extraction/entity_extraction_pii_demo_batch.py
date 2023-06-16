#
# This is a modified version of entity_extraction_pii_demo.py to handle batch processing
# of a set of newline separated records in a file and identify PII entities in each record.
# You can add a data file in the same directory, remove the sample text to type 
# 'batch process file:<filename>' in the given text box and click the button.
#
# This file is given as an example to demonstrate how a sample app can be modified to create a
# a custom demo with a data set, change UI, language models etc.
#

import os
import dash
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html
import pandas as pd
import requests
import json

# pre-defined URL for backend
SERVER_URL = 'https://8f96122371.dsceapp.buildlab.cloud'

# API end-points used
REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/EntityMentionsPredict'

# pre-trained models used
MODEL_BILSTM = 'entity-mentions_bilstm-workflow_lang_en_stock'
MODEL_RBR = 'entity-mentions_rbr_lang_multi_pii'
# for a more updated list of models available on the container, refer to the latest README in the GitHub repo for this sample

# change this text if you want a different sample in the UI
entity_sample_text = 'Hi I am Ravi Dube. I am writing to you to report an unauthorised transaction on my credit card. \
On March 30th, 2023, I noticed a charge of $1,000 on my credit card statement that I did not authorise. \
The transaction was made at a restaurant in New York, while I was in California on that day. I am concerned about the \
security of my account and I would appreciate if you could investigate this matter promptly. Please \
contact me at my phone number (123)456-7890 or email me at ravi.dube@email.com to provide me with an update \
on the investigation. My credit card number is 3572267594198019 and my social security number is 175-43-9027. \
I look forward to hear from you soon.'


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = 'Watson NLP - Extract PII'

navbar_main = dbc.Navbar(
        [
            dbc.Row(
                [
                    dbc.Col([
                            "Watson NLP (Extract Personal Identifiable Information)",
                        ],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                ]
            )
        ],
    style={
          'paddingLeft': '1rem', 'height': '3rem', 'paddingRight': '2rem',
          'borderBottom': '1px solid #393939', 'color': '#fff'},
    class_name = "bg-dark"
)

entity_sample_text = 'Hi I am Ravi Dube. I am writing to you to report an unauthorised transaction on my credit card. On March 30th, 2023, I noticed a charge of $1,000 on my credit card statement that I did not authorise. \
The transaction was made at a restaurant in New York, while I was in California on that day. I am concerned about the security of my account and I would appreciate if you could investigate this matter promptly. Please \
contact me at my phone number (123)456-7890 or email me at ravi.dube@email.com to provide me with an update on the investigation. My credit card number is 3572267594198019 and my social security number is 175-43-9027. \
I look forward to hear from you soon.'

entity_input = dbc.InputGroup(
    [
        # dbc.InputGroupText("Enter Text"),
        dbc.Textarea(id="entity-input", 
                     value=entity_sample_text,
                     placeholder="Text for entity extraction",
                     rows=4,
                     style={'borderRadius': '0', 'borderTop': 'none', 'borderLeft': 'none', 'borderRight': 'none', 'backgroundColor': '#f4f4f4','borderBottomColor': '#8d8d8d', 'resize': 'none'}
                     )
    ],
    className="mb-3",
)

entity_button = html.Div(
    [
        dbc.Button(
            "Get entities", id="entity-button", outline=True, color="primary", className="me-2", n_clicks=0,
            style={'height': '2.5rem', 'width': 'min(250px, 100%)', 'borderRadius': 0, 'textAlign': 'left', 'paddingLeft': '1rem', 'paddingRight': '4rem', 'marginTop': '0.5rem'}
        ),
    ],
    className = "text-center"
)

entities_df = pd.DataFrame(columns=['Record Number', 'Entity Type', 'Entity Text', 'Score'])
entity_output_table = dash_table.DataTable(
    columns=[
        dict(id='Record Number', name='Record Number'),
        dict(id='Entity Type', name='Entity Type'),
        dict(id='Entity Text', name='Entity Text'),
        dict(id='Score', name='Score (%)', type='numeric', format=dict(specifier='.0%', locale=dict(percent='')))
    ],
    style_header={
        'border': 'none',
        'backgroundColor': '#e0e0e0',
        'fontSize': '0.875rem',
        'fontWeight': '600'
    },
    style_cell={
        'textAlign': 'left',
        'fontFamily': ['IBM Plex Sans', 'sans-serif'],
        'fontSize': '0.875rem',
        'fontWeight': '400',
        'padding': '0 1rem',
        'height': '2.5rem',
        'backgroundColor': '#f4f4f4',
    },
    style_table={
        'overflowX': 'scroll', 
        'overflowY': 'auto',
    },
    style_as_list_view=True,
    cell_selectable=False,
    id='entity-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                    html.Br(),
                    html.Br(),
                    dbc.Row(
                        [
                            dbc.Col(className="col-2"),
                            dbc.Col(
                                children=[
                                    html.Div(entity_input),
                                    html.Div(entity_button),
                                    html.Br(),
                                    html.Hr(),
                                    html.Div([ 
                                          html.Div(
                                                html.H5("PII labels suggested by custom ML model"),
                                                    style={'backgroundColor': '#f4f4f4', 'padding': '1rem 1rem 1.5rem 1rem'}
                                                ),
                                          entity_output_table],
                                        style={'padding': '2rem 5rem'}
                                    ),
                                ],
                                className="col-8"
                            ),
                            dbc.Col(className="col-2"),
                        ],
                        className="px-3 pb-5"
                    ),
                    html.Br(),
                    html.Br(),
                    html.Footer(
                        dbc.Row([
                        dbc.Col(
                            "This App is built using Watson NLP library. Please note that this content is made available to foster Embedded AI technology adoption. \
                                The library may include systems & methods pending patent with USPTO and protected under US Patent Laws. \
                                Copyright - 2023 IBM Corporation",
                            className="p-3"
                        )]),
                        style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
                        className="bg-dark position-fixed bottom-0"
                    )
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)


# ---- end UI code ----

#
# batch process a set of records from a given file
#
import sys, traceback
def batch_process(f):

	try:
		ent_list = []
		lines = f.readlines()
		i = 0
		for line in lines:
			print("processing record", i)
			if len(line) > 10:
				r = extract_entities(line)
				v = r['Entities']
				for j in range(0, len(v)):
					v[j]['recordid'] = i
					ent_list.append(v[j])
				i=i+1
	except Exception as e:
		print(traceback.format_exc())
	return {'Entities': ent_list}

# function that can filter the entities list to only show what is considered as PII
# you can tweak the list to get other entities or block more
def pii_filter(list):

        # only these will be shown in UI and others filtered out
        valid_pii = ['Person', 'Money', 'Location', 'Facility', 'PhoneNumber', 'EmailAddress', 'BankAccountNumber.CreditCardNumber.Other',
                        'NationalNumber.SocialSecurityNumber.US', 'NationalNumber.TaxID.US']
        try:
                flist = []
                for e in list:
                        if e['ent_type'] in valid_pii and 'XXX' not in e['ent_text']:
                                # check for duplicate key
                                found = False
                                for f in flist:
                                        if e['ent_type'] in f['ent_type']:
                                                found = True
                                                t = f['ent_text'] + ', ' + e['ent_text']
                                                f['ent_text'] = t
                                if(not found):
                                        flist.append(e)
        except Exception as e:
                print(traceback.format_exc())

        return flist


#
# function that calls the backend API
#
def extract_entities(data):

    # used in local scope and not the html from Dash
    import html

    input_text = str(data)
    text = html.unescape(input_text)
   
    headers = {
        'accept': 'application/json',
        'content-type': 'application/json',
    }
    payload = {
        'rawDocument': {
            'text': text 
        }
    }

    # Call BiLSTM Model
    headers['grpc-metadata-mm-model-id'] = MODEL_BILSTM
    payload['rawDocument']['text'] = text
    response_bilstm = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
    response_bilstm_json = response_bilstm.json()
    entities_list_bi = response_bilstm_json['mentions']

    # Call RBR Model
    headers['grpc-metadata-mm-model-id'] = MODEL_RBR
    payload['rawDocument']['text'] = text
    payload['languageCode'] = 'en'
    response_rbr = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
    response_rbr_json = response_rbr.json()
    entities_list_rbr = response_rbr_json['mentions']
    
    entities_list = entities_list_bi + entities_list_rbr
    ent_list=[]
    for i in range(len(entities_list)):
        ent_type = entities_list[i]['type']
        ent_confidence = round(entities_list[i]['confidence'],2)
        ent_text = entities_list[i]['span']['text']
        ent_list.append({'ent_type': ent_type, 'ent_text': ent_text, 'ent_confidence': ent_confidence})
    if len(ent_list) > 0:
        # MODIFICATION: filter the list for only pii and dedup
        filtered_ent_list = pii_filter(ent_list)
        filtered_ent_list.sort(key=lambda x: x["ent_confidence"], reverse=True)
        return {'Entities':filtered_ent_list}
    else:
        return {}


# call back functions from UI

@app.callback(
    Output('entity-output-table', 'data'),
    Input('entity-button', 'n_clicks'),
    State('entity-input', 'value'),
)

def text_entity_callback(n_clicks, entity_input):

    # MODIFICATION
    if "batch process" in entity_input:

      # get file name
      filename = ''
      words = entity_input.split()
      print(words)
      for w in words:
              if 'file:' in w:
                   filename = w.split(':')[1]
                   break

      if filename == '':
              print("No file name found")
              entities_dict = {'Entities':[]}
      else:
              try:    
                   print("filename", filename)
                   f = open(filename, "r")
                   entities_dict = batch_process(f)
              except:
                   print("Error opening file")
                   entities_dict = {'Entities':[]}
    else:
      # process single text from UI
      entities_dict = extract_entities(entity_input)

    # END MODIFICATION

    if len(entities_dict) > 0:
        entities_df = pd.DataFrame(entities_dict['Entities']).rename(columns={'recordid':'Record Number', 'ent_type':'Entity Type', 'ent_text':'Entity Text', 'ent_confidence': 'Score'})
    else:
        entities_df = pd.DataFrame([{'Record Number': 'NONE/EMPTY', 'Entity Type': 'NONE/EMPTY', 'Entity Text': 'NONE/EMPTY', 'Score': 'NONE/EMPTY'}])

    return entities_df.to_dict('records')

# main -- runs on localhost. change the port to run multiple apps on your machine

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
