import os, time, requests, json, base64, io
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc, ALL, ctx
import pandas as pd
from sql_formatter.core import format_sql
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

# Data file
data_f_json = []
with open('data.json') as data_f:
    data_f_json = json.load(data_f)

# pricing list
model_pricing = {}
with open('pricing_list.json') as pricing_data:
    model_pricing = json.load(pricing_data)

# to get the list of models
model_list_url = os.getenv("MODEL_LIST_URL")

# For LLM call
SERVER_URL = os.getenv('SERVER_URL')
WATSONX_PROJECT_ID = os.getenv('WATSONX_PROJECT_ID')
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

app_index = 0

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
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
        dbc.ModalHeader(dbc.ModalTitle("My Payloads", id="payload-modal-title")),
        dbc.ModalBody([
            dbc.Tabs(id="payload-modal-tb", active_tab="payload-tab-0")
        ]),
    ],
    id="payload-modal",
    size="xl",
    scrollable=True,
    is_open=False,
)

user_input = dbc.InputGroup([
        dbc.Textarea(id="user-input",
                     value="",
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input"
                     ),
    ],
    className="mb-3",
)


buttons_panel = dbc.Row(children=[], id="btn-list")
btn_list = []
for usecase in data_f_json:
    btn_list.append(dbc.Col(dbc.Button(usecase["llm_calls"][0]["button_text"], id="btn", color="primary", n_clicks=0, className="carbon-btn")))


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
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttons_panel,
                                html.Br(),
                                html.Hr(),
                                html.Div([
                                        # html.H5(configs.get('Output_title')),
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output')
                                    ],
                                    style={'padding': '1rem 1rem'}
                                ),
                            ],
                            className="col-8"
                        ),
                        dbc.Col(className="col-2"),
                    ],
                    className="px-3 pb-5"
                )

appsLGI = []
for index, p in enumerate(data_f_json):
    appsLGI.append(
            dbc.ListGroupItem(
                [
                    html.H6(p['name'], className="card-title"),
                ], 
                id={"type": "app", "index": index},
                n_clicks=0, action=True,
                color="secondary",
                class_name="d-flex align-items-center",
                style={'height': '2.5rem'}
            )
        )

horizontal_layout = dbc.Row(
                    [
                        dbc.Col(children=[
                                html.Div(
                                    html.H5("Use cases"),
                                        style={'border': 'none', 'backgroundColor': '#e0e0e0', 'fontSize': '0.875rem', 'fontWeight': '600', 'padding': '1rem 1rem 1.5rem 1rem'},
                                    ),
                                html.Div(dbc.ListGroup(appsLGI, flush=True), style={'overflow': 'scroll', 'maxHeight': '76vh'})
                            ],
                            className="col-2"
                        ),
                        dbc.Col(
                            children=[
                                # html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttons_panel,
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-5 border-end",
                            style={'padding': '0rem 1rem'}
                        ),
                        dbc.Col(
                            children=[
                                dbc.Row(
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output-1',
                                    className="generate-output"
                                ), style={"height":"calc(50% - 16px)", "overflow": "auto"}),
                                html.Hr(),
                                dbc.Row(
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output-2',
                                    className="generate-output"
                                ), style={"height":"calc(50% - 16px)", "overflow": "auto"})
                            ],
                            className="col-5",
                            style={'height': 'calc(100vh - 10rem)'}
                        ),
                        # dbc.Col(className="col-1"),
                    ],
                    className="px-3"
                )

app.layout = html.Div(children=[
                    dcc.Store(id="selected-index-store", data=app_index),
                    dcc.Store(id="store-inference", data=0),
                    navbar_main,
                    html.Div(payload_modal),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    html.Br(),
                    footer,
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

# get list of models
def get_models(access_token):
    payload = {}
    headers_for_model = {
        'Authorization': f'Bearer {access_token}'
    }
    response = requests.request("GET", model_list_url, headers=headers_for_model, data=payload)
    response_json = response.json()
    models = []
    for r in response_json["resources"]:
        models.append(r["model_id"])
    models_to_remove = ["ibm/granite-13b-chat-v2", "ibm/granite-13b-instruct-v2", "ibm/slate-125m-english-rtrvr", "ibm/slate-30m-english-rtrvr"]
    for model in models_to_remove:
        models.remove(model)
    return models

# Fetch payloads for viewing
def get_payloads(text, selected_app_index):
    app = data_f_json[selected_app_index]
    payloads_output = []
    labels = []
    payloads = []
    for i in app["llm_calls"]:
        labels.append(i["call"])
        payloads.append(i["payload-view"])
    for label, payload, n in zip(labels, payloads, range(len(payloads))):
        payload['data']['input'] = text
        payload = json.dumps(payload, indent=2)
        payloads_output.append(
            dbc.Tab([
                    dcc.Markdown(f'''```json
{payload}
                        '''
                    ),
                ],
                tab_id=f'payload-tab-{n}',
                label=label, label_style={'borderRadius': 0}
            ),
        )
    return payloads_output, f'My Payloads-{app["name"]}'

def parse_output(res, type):
    parseoutput = []
    if(type == 'sql'):
        return html.Pre(format_sql(res))
    if(type == 'text'):
        return res
    if(type == 'label'):
        return html.H5(dbc.Badge(res, color="#1192e8", style={'borderRadius': '12px','marginLeft':'8px','paddingLeft':'16px', 'paddingRight':'16px'}))
    elif(type == 'key-value'):
        try:
            pairs = res.split(',')
            for pair in pairs:
                pair = pair.strip()
                if(pair!="" and ":" in pair and len(pair.split(":"))==2):
                    k, v = pair.split(':')
                    parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
            return html.Div(parseoutput, className="key-value-div-parent")
        except:
            return res
    elif(type == 'markdown'):
        return dcc.Markdown(md(res.replace("\n", "<br/>")))


# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# LLM API call
def llm_fn(text, payload_json, res_type, access_token):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['input'] = payload_json['input']+text+"\n\nOutput:\n"
    print("calling LLM", datetime.now())
    
    start_time = time.perf_counter()
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    end_time = time.perf_counter()
    api_resp_time = end_time - start_time
    
    response_llm_json = response_llm.json()
    resp = response_llm_json['results'][0]['generated_text']
    intput_token = response_llm_json['results'][0]['input_token_count']
    output_token = response_llm_json['results'][0]['generated_token_count']
    total_token = intput_token + output_token
    formatted_total_token = ('{:,}'.format(total_token)) # to add comman in the tokens
    try:
        cost = model_pricing[payload_json["model_id"]]*total_token if type(model_pricing[payload_json["model_id"]])==float else (model_pricing[payload_json["model_id"]]["input"]*intput_token + model_pricing[payload_json["model_id"]]["output"]*output_token)
        cost = "${}".format(round(cost, 2))
    except Exception as e:
        print(e)
        cost = "N/A"
    try:
        return parse_output(resp, res_type), formatted_total_token, cost, round(api_resp_time, 2)
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()),response_llm_json)
        return "Error occured. Status code: {}. Please try again.".format(response_llm_json['status_code'])


# For Upload Data processing
def parse_contents(contents, filename, date):
    content_type, content_string = contents.split(',')

    decoded = base64.b64decode(content_string)
    try:
        f = io.StringIO(decoded.decode('utf-8'))
        return f.getvalue()
    except Exception as e:
        print(e)
        return "There is some error while processing the file."


# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    Output("payload-modal-title", "children"),
    Output("payload-modal-tb","active_tab"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'), State("selected-index-store", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, selected_app_index):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, selected_app_index)
        return not is_open,op[0], op[1], "payload-tab-0"
    return is_open, [], [], "payload-tab-0"


# User select an app
@app.callback(
    [
     Output("selected-index-store", "data"),
     Output({"type": "app", "index": ALL}, "active"),
     Output("user-input", "value"),
     Output("btn-list", "children")
     ],
    Input({"type": "app", "index": ALL}, "n_clicks"),
    State("selected-index-store", "data")
)
def display_output(n_clicks, index):
        try:
            selectedindex = ctx.triggered_id.index
        except:
            selectedindex = 0

        active = []
        for i, d in enumerate(data_f_json):
            active.append(i == selectedindex)

        # data['selected_app_index'] = selectedindex
        app = data_f_json[selectedindex]
        return selectedindex, active, app["input_text"], btn_list[selectedindex]


@app.callback(
    Output("generate-output-1", "children", allow_duplicate=True),
    Output("generate-output-2", "children", allow_duplicate=True),
    Input('store-inference', "data"),
    State('user-input', 'value'),
    State("selected-index-store", "data"),
    prevent_initial_call=True
)
def generateOutput(n, text, selected_app_index):
    if(n>0):
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()
        selected_app = data_f_json[selected_app_index]
        call = selected_app["llm_calls"][0]
        label = call["call"]
        type = call["type"]
        model1 = call["model_1"]
        model2 = call["model_2"]
        payload1 = call["payload"].copy()
        payload2 = payload1.copy()
        payload2["model_id"] = model2
        resp, total_token, cost, api_resp_time = llm_fn(text, payload1, type, access_token)
        return [
                            html.Div([
                                            html.Div(children=[ html.H5(label), 
                                                                html.Span(f"Model: {model1}", style={"borderBottom": "1px solid black"})
                                                             ]
                                                    ),

                                    html.Br(),
                            # html.Br(), 
                            resp,
                            ], className="output-div"), 
            html.Div(children=[html.Span(f"Tokens consumed: {total_token} | Response time: {api_resp_time}s | *Cost per 1,000 similar sized sessions: {cost}", style={"fontStyle": "normal", "fontWeight": "bold"}), html.Br(), dcc.Markdown("*Cost provided is an estimate and is subject to change. It is for model runtime usage only, excluding additional services. For current pricing, visit [this page.](https://www.ibm.com/products/watsonx-ai/foundation-models)", link_target="_blank")],id="api-info-btm", className="api-info-btm")], [html.Div(
            [
            html.Div(children=[html.H5(label), 
                                html.Div(children=
                                    [
                                        html.Span(f"Model: ", style={"borderBottom": "1px solid black", "marginTop": "10px"}), 
                                        dcc.Dropdown(options=get_models(access_token), value=model2, searchable=False, clearable=False, optionHeight=45,
                                        id="model-drpdown", style={"width": "16rem", "borderTop": "none", "borderRight": "none", "borderLeft": "none", "borderRadius": "unset"}),
                                    ], style={"display": "flex", "flexDirection": "row", "gap":"1rem"}
                                )
                            ]
                    ),
            html.Br(),
            html.Div(children=[dbc.Spinner(color="primary", size="sm"), " Please wait..."], id="div-part-b-res")
            ], className="output-div"), html.Div(id="api-info-btm-part-b", className="api-info-btm")]
    return html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"}), html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})


@app.callback(
    Output("div-part-b-res", "children"),
    Output('api-info-btm-part-b', 'children'),
    Input("model-drpdown", "value"),
    State("selected-index-store", "data"),
    State('user-input', 'value')
)
def model_change(model, selected_app_index, text):
    authenticator = IAMAuthenticator(API_KEY)
    access_token = authenticator.token_manager.get_token()
    selected_app = data_f_json[selected_app_index]
    call = selected_app["llm_calls"][0]
    payload = call["payload"].copy()
    type = call["type"]
    payload["model_id"] = model
    resp, total_token, cost, api_resp_time = llm_fn(text, payload, type, access_token)
    return [resp], [html.Span(f"Tokens consumed: {total_token} | Response time: {api_resp_time}s | *Cost per 1,000 similar sized sessions: {cost}", style={"fontStyle": "normal", "fontWeight": "bold"}), html.Br(), dcc.Markdown("*Cost provided is an estimate and is subject to change. It is for model runtime usage only, excluding additional services. For current pricing, visit [this page.](https://www.ibm.com/products/watsonx-ai/foundation-models)", link_target="_blank")]

@app.callback(
    Output("div-part-b-res", "children", allow_duplicate=True),
    Input("model-drpdown", "value"),
    State("selected-index-store", "data"),
    prevent_initial_call=True
)
def show_spinner(model, selected_app_index):
    return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]


# for showing loading spinner
@app.callback(
    Output('store-inference', 'data', allow_duplicate=True),
    Output('generate-output-1', 'children', allow_duplicate=True),
    Output('generate-output-2', 'children', allow_duplicate=True),
    Input('btn', 'n_clicks'),
    prevent_initial_call=True
)
def show_spinner(n):
    if(n>0):
        return 1, html.Div([dbc.Spinner(color="primary", size="sm"), " Please wait..."]), html.Div([dbc.Spinner(color="primary", size="sm"), " Please wait..."])
    return 0, [], []
            
# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)