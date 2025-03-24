import os, time, math
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc, ALL, MATCH, callback_context
import pandas as pd
import requests
import json
import base64
import io
from transformers import AutoTokenizer
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# instantiate config
configs = Properties()
# load properties into configs
with open('app-config.properties', 'rb') as config_file:
    configs.load(config_file)
# read into dictionary
configs_dict = {}
items_view = configs.items()
for item in items_view:
    configs_dict[item[0]] = item[1].data

# For LLM call
SERVER_URL = os.getenv('SERVER_URL')
WATSONX_PROJECT_ID = os.getenv('WATSONX_PROJECT_ID')
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }
risk_list=[]
question_list = []
with open('data.json') as data:
    data = json.load(data)
    risk_list = data.keys()
    question_list = data

category = {"social bias": "social_bias", "harm (generic)": "harm", "profanity":"profanity", "unethical behavior":"unethical_behavior", "violence":"violence", "jailbreak": "jailbreak", "rag": "groundedness"}
hf_model_path = "ibm-granite/granite-guardian-3.1-8b"
tokenizer = AutoTokenizer.from_pretrained(hf_model_path)

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(configs_dict['navbartitle'],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                        ],
                        toggle_class_name="nav-dropdown-btn", caret=False,
                        nav=True, in_navbar=True,
                        label=html.Img(src="/assets/settings.svg", height="16px", width="16px", style={'filter': 'invert(1)'}),
                        align_end=True,
                    ),
        ],
    style={'paddingLeft': '1rem', 'height': '3rem', 'borderBottom': '1px solid #393939', 'color': '#fff'},
    class_name = "bg-dark"
)

payload_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("My Payloads")),
        dbc.ModalBody([
            dbc.Tabs(id="payload-modal-tb", active_tab="payload-tab-0")
        ]),
    ],
    id="payload-modal",
    size="xl",
    scrollable=True,
    is_open=False,
)


risk_input = dbc.InputGroup([
        dbc.Select(
    id="risk-value",
    options=[{
            "label": i,
            "value": i
        }for i in risk_list],
    placeholder="Select a risk..."
),
    ],
    className="mb-3",
)

prompts = html.Div(
    [
        html.Div(id='input-prompt-table', children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})])
    ]
)
            
footer = html.Footer(
    dbc.Row([
        dbc.Col(children=[dcc.Markdown(configs_dict['footer_text'])],className="p-3 pb-0")]),
    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
    className="bg-dark position-fixed bottom-0"
)

vertical_layout = dbc.Row(
                    [
                        dbc.Col(className="col-2"),
                        dbc.Col(
                            children=[
                                dbc.Label("Risk category"),
                                html.Div(risk_input),
                                html.Div(prompts),
                                html.Br(),
                                html.Br()
                            ],
                            className="col-8"
                        ),
                        dbc.Col(className="col-2"),
                    ],
                    className="px-3 pb-5"
                )

horizontal_layout = dbc.Row(
                    [
                        dbc.Col(className="col-1"),
                        dbc.Col(
                            children=[
                                dbc.Label("Risk category"),
                                html.Div(risk_input),
                                html.Div(prompts),
                                html.Br(),
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-5 border-end",
                            style={'padding': '1rem'}
                        ),
                        dbc.Col(className="col-1"),
                    ],
                    className="px-3 pb-5"
                )

app.layout = html.Div(children=[
                    dcc.Store(id='current-prompts', data=[]),
                    navbar_main,
                    html.Div(payload_modal),
                    html.Br(),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----
safe_token = "No"
risky_token = "Yes"
# helper functions
def parse_output(generated_tokens_list):
    label, prob_of_risk = None, None
    top_tokens_list = [generated_tokens['top_tokens'] for generated_tokens in generated_tokens_list]
    prob = get_probablities(top_tokens_list)
    prob_of_risk = prob[1]

    res = next(iter(generated_tokens_list))['text'].strip()

    if risky_token.lower() == res.lower():
        label = risky_token
    elif safe_token.lower() == res.lower():
        label = safe_token
    else:
        label = "Failed"

    return label, prob_of_risk

def get_probablities(top_tokens_list):
    safe_token_prob = 1e-50
    risky_token_prob = 1e-50
    for top_tokens in top_tokens_list:
        for token in top_tokens:
            if token['text'].strip().lower() == safe_token.lower():
                safe_token_prob += math.exp(token['logprob'])
            if token['text'].strip().lower() == risky_token.lower():
                risky_token_prob += math.exp(token['logprob'])

    probabilities = softmax([math.log(safe_token_prob), math.log(risky_token_prob)])

    return probabilities

def softmax(values):
    exp_values = [math.exp(v) for v in values]
    total = sum(exp_values)
    return [v / total for v in exp_values]

# Fetch payloads for viewing
def get_payloads(question, risk):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    try:
        user_prompt = question
        messages =  [{"role": "context", "content": user_prompt['context_text']}, {"role": "assistant", "content": user_prompt['response_text']}] if risk.lower()=="rag" else [{"role": "user", "content": user_prompt}]
        guardian_config = {"risk_name": category[risk.lower()]}
        chat = tokenizer.apply_chat_template(messages, guardian_config = guardian_config, tokenize=False, add_generation_prompt=True)
    except:
        chat = "Please select risk categoty first"
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        payload_f_json['data']['input'] = chat # payload_f_json['data']['input'].replace('{user_text}', question if question is not None else '{user_question}').replace('{risk_definition}', risk_definition if risk_definition is not None else '{risk_definition}')
        payload_f_json = json.dumps(payload_f_json, indent=2)
        payloads_output.append(
            dbc.Tab([
                    dcc.Markdown(f'''```json
{payload_f_json}
                        '''
                    ),
                ],
                tab_id=f'payload-tab-{n}',
                label=label, label_style={'borderRadius': 0}
            ),
        )
    return payloads_output

def parse_output_ui(res, type):
    parseoutput = []
    if(type == 'text'):
        return res
    if(type == 'label'):
        if(res.lower()=="safe"):
            return dbc.Badge(res, color="success", pill=True, style={'fontSize': 'medium'})
        elif(res.lower()=="unsafe"):
            return dbc.Badge(res, color="danger", pill=True, style={'fontSize': 'medium'})
        return dbc.Badge(res, color="warning", pill=True, style={'fontSize': 'medium'})
    elif(type == 'key-value'):
        pairs = res.split(',')
        for pair in pairs:
            k, v = pair.split(':')
            parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
        return html.Div(parseoutput, className="key-value-div-parent")
    elif(type == 'markdown'):
        res = res.replace("###", "\n\n")
        return dcc.Markdown(md(res))

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# LLM API call
def llm_fn(question, risk, payload_json, type, access_token):
    user_prompt = question
    messages =  [{"role": "context", "content": user_prompt['context_text']}, {"role": "assistant", "content": user_prompt['response_text']}] if risk.lower()=="rag" else [{"role": "user", "content": user_prompt}]
    guardian_config = {"risk_name": category[risk.lower()]}
    chat = tokenizer.apply_chat_template(messages, guardian_config = guardian_config, tokenize=False, add_generation_prompt=True)
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['input'] = chat # payload_json['input'].replace('{user_text}', question).replace('{risk_definition}', risk_definition)
    print("calling LLM", datetime.now())
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()
    generated_tokens = response_llm_json['results'][0]['generated_tokens']
    label, prob_of_risk = parse_output(generated_tokens)
    if(label.lower()=="yes"):
        answer = "Unsafe"
    elif(label.lower()=="no"):
        answer="Safe"
    else:
        answer="Failed"
    try:
        return parse_output_ui(answer, type), prob_of_risk
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()),response_llm_json)
        return "Error occured. Status code: {}. Please try again.".format(response_llm_json['status_code']), ""


# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open")],
    State('risk-value', 'value'),
    State('current-prompts', 'data'),
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, risk, questions):
    if n1:
        op=[]
        if(not is_open):
            question = questions[0] if len(questions)>=1 else None
            op=get_payloads(question, risk)
        return not is_open,op
    return is_open, []


# display table of input prompt
@app.callback(
    Output('input-prompt-table', 'children'),
    Output('current-prompts', 'data'),
    Input('risk-value', 'value'),
    prevent_initial_call=True
)
def show_table(risk):
    questions = question_list[risk]['examples']
    if(risk=="RAG"):
        table_header = [
            html.Thead(html.Tr([html.Th("Context text", style={'width': '25%'}), 
                                html.Th("Response text", style={'width': '25%'}),
                                html.Th("Action button", style={'textAlign':'center', 'width': '10%'}), 
                                html.Th('Groundedness', style={'textAlign':'center', 'width': '10%'}),
                                 html.Th('Risk probability', style={'textAlign':'center', 'width': '10%'})
                                ]
                            )
                    )]
    else:
        table_header = [
            html.Thead(html.Tr([html.Th("Input prompt", style={'width': '53%'}), 
                                html.Th("Action button", style={'textAlign':'center', 'width': '10%'}), 
                                html.Th(configs_dict['generate_btn_output_labels'], style={'textAlign':'center', 'width': '10%'}),
                                 html.Th('Risk probability', style={'textAlign':'center', 'width': '10%'})
                                ]
                            )
                    )]
    rows = []
    if(risk=='RAG'):
        for i in range(len(questions)):
            rows.append(html.Tr([
                                html.Td(questions[i]['context_text']), 
                                html.Td(questions[i]['response_text']), 
                                html.Td(dbc.Button('Submit', id={'type': 'generate-button', 'index': i}, n_clicks=0), 
                                            style={'alignContent': 'center', 'textAlign':'center'}), 
                                html.Td(
                                            dbc.Spinner(color="primary", size="sm", children=[html.Div(id={'type': 'result', 'index': i}, style={'justifySelf': 'center'})]),
                                            style={'alignContent': 'center'}
                                        ),
                                html.Td(
                                            dbc.Spinner(color="primary", size="sm", children=[html.Div(id={'type': 'confidence_score', 'index': i}, style={'justifySelf': 'center'})]),
                                            style={'alignContent': 'center'}
                                        )
                                ]))
    else:
        for i in range(len(questions)):
            rows.append(html.Tr([html.Td(questions[i]), html.Td(dbc.Button('Submit', id={'type': 'generate-button', 'index': i}, n_clicks=0), style={'alignContent': 'center', 'textAlign':'center'}), html.Td(
                dbc.Spinner(color="primary", size="sm", children=[html.Div(id={'type': 'result', 'index': i}, style={'justifySelf': 'center'})]),
                style={'alignContent': 'center'}
                ),
                html.Td(
                        dbc.Spinner(color="primary", size="sm", children=[html.Div(id={'type': 'confidence_score', 'index': i}, style={'justifySelf': 'center'})]),
                        style={'alignContent': 'center'}
                    )
                                 ]))

    table_body = [html.Tbody(rows)]

    table = dbc.Table(table_header + table_body, bordered=True)
    return table, questions


# get the result and disply in the table
@app.callback(
    Output({'type': 'result', 'index': MATCH}, 'children', allow_duplicate=True),
    Output({'type': 'confidence_score', 'index': MATCH}, 'children', allow_duplicate=True),
    Input({'type': 'generate-button', 'index': ALL}, 'n_clicks'),
    State('current-prompts', 'data'),
    State('risk-value', 'value'),
    prevent_initial_call=True,
)
def generate_output(n_clicks, questions, risk):
    ctx = callback_context
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    button_data = json.loads(button_id)
    clicked_index = button_data['index']
    
    if n_clicks[clicked_index] > 0:
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        types = configs_dict['generate_btn_output_type'].split(',')
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()
        payload_f_json=[]
        with open('payload/{}.json'.format(payloads[0])) as payload_f:
            payload_f_json = json.load(payload_f)
        resp, prob_of_risk = llm_fn(questions[clicked_index], risk, payload_f_json, types[0], access_token)
        return resp, round(prob_of_risk, 2)
    return dash.no_update, dash.no_update



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
