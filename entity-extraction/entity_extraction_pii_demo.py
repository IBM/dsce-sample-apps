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
On March 30th, 2023, I noticed a charge of $1,000 on my credit card statement that I did not authorise.\
The transaction was made at a restaurant in New York, while I was in California on that day. I am concerned about the \
security of my account and I would appreciate if you could investigate this matter promptly. Please \
contact me at my phone number (123)456-7890 or email me at ravi.dube@email.com to provide me with an update \
on the investigation. My credit card number is 3572267594198019 and my social security number is 175-43-9027. \
I look forward to hear from you soon.'


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP])
app.title = 'Watson NLP - Extract PII'

navbar_main = dbc.Navbar(
        [
            dbc.Col(
                [
                    dbc.Row(
                        [   
                            dbc.Col([]),
                            dbc.Col([])
                        ],
                        className='me-auto',
                        align='center',
                        justify='right',
                    ),
                ],
                align = 'center'
            ),
            dbc.Col(
                [
                    dbc.Row(html.H2("Watson NLP", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center',
                    ),
                    dbc.Row(html.H4("Extract Personal Identifiable Information", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center'
                    ),
                ],
                align = 'center'
            ),
            dbc.Col(
                [
                    dbc.Row(
                        [   
                            dbc.Col([]),
                            dbc.Col([])
                        ],
                        className='me-auto',
                        align='center',
                        justify='right',
                    ),  
                ],
                align = 'center'
            ),
        ],
    className = "bg-dark text-light"
)

entity_input = dbc.InputGroup(
    [
        dbc.InputGroupText("Enter Text"),
        dbc.Textarea(id="entity-input", 
                     value=entity_sample_text,
                     placeholder="Text for Entity Extraction",
                     rows=7),
    ],
    className="mb-3",
)

entity_button = html.Div(
    [
        dbc.Button(
            "Get Entities", id="entity-button", className="me-2", n_clicks=0
        ),
    ],
    className = "text-center"
)

entities_df = pd.DataFrame(columns=['Entity Type', 'Entity Text', 'Score'])
entity_output_table = dash_table.DataTable(
    columns=[{"name": i, "id": i} for i in entities_df.columns],
    style_cell={
        'textAlign': 'left',
        'font-family':'sans-serif'
    },
    style_table={
        'overflowX': 'scroll', 
        'overflowY': 'auto'
    },
    style_as_list_view=True,
    sort_action='native',
    sort_mode='multi',
    id='entity-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                    html.Br(),
                    dbc.Row(
                        [
                        dbc.Col(
                            children=[
                                html.Div(entity_input),
                                html.Div(entity_button),
                                html.Hr(),
                                html.Div(entity_output_table),
                            ],
                        ),
                        ],
                        className="px-3 pb-5"
                    ),
                    html.Br(),
                    html.Br(),
                    html.Footer(
                        dbc.Row([
                        dbc.Col(
                            "This App is built using Watson NLP library. Please note that this content is made \
                             available to foster Embedded AI technology adoption. The library may include \
                             systems & methods pending patent with USPTO and protected under US Patent Laws. \
                             Copyright - 2023 IBM Corporation",
                            className="p-3"
                        )]),
                        className="bg-dark text-light position-fixed bottom-0"
                    )
], className="bg-white")


# ---- end UI code ----


# function that can filter the entities list to only show what is considered as PII
# you can tweak the list for custom filtering 
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

    # Call BiLSTM Model - a workflow model implicitly calls the syntax model
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
        filtered_ent_list = pii_filter(ent_list)
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

    # call the backend for analysis
    entities_dict = extract_entities(entity_input)

    if len(entities_dict) > 0:
        entities_df = pd.DataFrame(entities_dict['Entities']).rename(columns={'ent_type':'Entity Type', 'ent_text':'Entity Text', 'ent_confidence': 'Score'})
    else:
        entities_df = pd.DataFrame([{'Entity Type': 'NONE/EMPTY', 'Entity Text': 'NONE/EMPTY', 'Score': 'NONE/EMPTY'}])

    return entities_df.to_dict('records')



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)