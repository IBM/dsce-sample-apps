import os, time, dash, requests, json
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
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
HEADERS = {'APIAUTHCODE': os.getenv("APIAUTHCODE")}

# multigenai framework endpoints to fetch or set example, payloads etc
GET_ALL_PROVIDERS = SERVER_URL+"/get-providers/all"
GET_PAYLOAD = SERVER_URL+"/find-prompt"
GET_EXAMPLES = SERVER_URL+"/get-examples"
EXECUTE_PROMPTS = SERVER_URL+"/find-execute-prompt"
UPDATE_EXAMPLE = SERVER_URL+"/update-examples"

# Read Sample text from file
sample_from_file = ""
with open('sales-conv-sample.txt', 'r') as sample_text_f:
    sample_from_file = sample_text_f.read()

api_store = {}

# get all providers details with ai task
provider_by_tasks = requests.get(GET_ALL_PROVIDERS, headers=HEADERS)
provider_by_tasks = provider_by_tasks.json()
all_ai_task = list(provider_by_tasks.keys())

filtered_ai_task = list(filter(lambda a: a in ["summarization", "entity-extraction"], all_ai_task))

# this will only keep the unique providers
all_unique_providers = list({x for l in provider_by_tasks.values() for x in l})

preffered_provider = {}

# setting watsonx as a default provider
for i in filtered_ai_task:
    preffered_provider[i] = "watsonx"

# setting api key for all providers empty
for i in all_unique_providers:
    api_store[i] = ""

payloads = {}
examples = {}


# get examples
def fetch_examples():
    for ai_task in filtered_ai_task:
        examples[ai_task] = {}
        for provider in all_unique_providers:
            payload = {
                "provider": provider,
                "search": [ai_task, "uid-s1" if ai_task=="summarization" else "uid-e1"]
            }
            HEADERS['Content-Type'] = 'application/json'
            example_res = requests.post(GET_EXAMPLES, headers=HEADERS, data=json.dumps(payload))
            example = example_res.text
            examples[ai_task][provider] = example

# call it when server start up
fetch_examples()

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
                            dbc.DropdownMenuItem("Change provider", id="provider-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("Edit examples", id="example-button", n_clicks=0, class_name="dmi-class")
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

provider_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Change provider")),
        dbc.ModalBody([
            dbc.Tabs(id="provider-modal-tb", active_tab=f"provider-tab-{filtered_ai_task[0]}", children=[
                dbc.Tab([
                        html.Div(id=f"{ai_task}-provider-div", children=[
                                dbc.Label(children=[html.B("Select Provider")], style={"margin-top": "0.5rem"}),
                                dcc.Dropdown(provider_by_tasks[ai_task], preffered_provider[ai_task], searchable=False,clearable=False, id=f"{ai_task}-provider-drpdown", style={"width": "8rem"})
                            ],
                            style={"padding-top":"1rem", "display":"flex", "flex-direction":"row", "gap": "1rem", "align-items": "center"}
                        ),
                        html.Div(id=f"{ai_task}-api-div",children=[
                                                                dbc.Label("", id=f"{ai_task}-api-lable"),
                                                                dbc.Input(id=f"{ai_task}-api-key", placeholder="", type="password", className="carbon-input", value=api_store[preffered_provider[ai_task]])
                                                                ]
                                                ),
                        html.Div(children = [dbc.Button("Save", id=f"{ai_task}-save-provider", color="primary", n_clicks=0, className="carbon-btn", style={"margin-top":"1rem"}),
                                             dbc.Button("Cancel", id=f"{ai_task}-cancel-provider", color="danger",outline=True, n_clicks=0, className="carbon-btn", style={"margin-top":"1rem"}),
                        ], style={"display":"flex", "flex-direction": "row", "gap": "1rem"}),
                        dbc.Alert(f"{ai_task} updated", color="success", id=f"{ai_task}-save-msg", style={"margin-top": "1rem", "display": "none"})
                    ], 
                    tab_id=f'provider-tab-{ai_task}', label=ai_task, label_style={'borderRadius': 0}, style={"background-color": "white",  "padding-left": "1rem", "padding-right": "1rem"}) for ai_task in filtered_ai_task]) 
        ]),
    ],
    id="provider-modal",
    size="l",
    scrollable=True,
    is_open=False,
)

edit_example_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Edit examples")),
        dbc.ModalBody([
            dbc.Tabs(id="example-modal-tb", active_tab=f"example-tab-{filtered_ai_task[0]}") 
        ]),
    ],
    id="example-modal",
    size="xl",
    scrollable=True,
    is_open=False
)

user_input = dbc.InputGroup([
        dbc.Textarea(id="user-input",
                     value=sample_from_file,
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input",
                     disabled=True
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn"
)

buttonsPanel = dbc.Row([
                dbc.Col(generate_button)
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                   dbc.Col(generate_button)
                ])

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
                                buttonsPanel,
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

horizontal_layout = dbc.Row(
                    [
                        dbc.Col(className="col-1"),
                        dbc.Col(
                            children=[
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttonsPanel,
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-5 border-end",
                            style={'padding': '1rem'}
                        ),
                        dbc.Col(
                            children=[
                                html.Div([
                                        # html.H5(configs.get('Output_title')),
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output')
                                    ],
                                    style={'padding': '1rem 3rem'}
                                ),
                            ],
                            className="col-5"
                        ),
                        dbc.Col(className="col-1"),
                    ],
                    className="px-3 pb-5"
                )

app.layout = html.Div(children=[
                    dcc.Location(id='url', refresh=False),
                    dcc.Store(id="provider-api-key-store", data=api_store),
                    dcc.Store(id="preffered-provider-store", data=preffered_provider),
                    dcc.Store(id="examples-store", data=examples),
                    navbar_main,
                    html.Div(payload_modal),
                    html.Div(provider_modal),
                    html.Div(edit_example_modal),
                    html.Br(),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    footer,
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----


# Fetch payloads for viewing
def get_payloads(text, preffered_provider, examples):
    payloads_output = []
    
    for ai_task, n in zip(filtered_ai_task, range(len(filtered_ai_task))):
        # example = examples[ai_task][preffered_provider[ai_task]]
        HEADERS['Content-Type'] = 'application/json'
        payloads = requests.post(GET_PAYLOAD, headers=HEADERS, data=json.dumps({"provider": preffered_provider[ai_task], "search": ["sales-conversation", "uid-s1" if ai_task=="summarization" else "uid-e1"]}))
        payload_f_json = payloads.json()
        payload_f_json = payload_f_json[0]
        if(preffered_provider[ai_task]=="watsonx"):
            payload_f_json["input"] = payload_f_json["input"] + text
        else:
            payload_f_json["prompt"] = payload_f_json["prompt"] + text
        payload_f_json["project_id"] = "xxxxx"
        payload_f_json = json.dumps(payload_f_json, indent=2)
        payloads_output.append(
            dbc.Tab([
                    dcc.Markdown(f'''```json
{payload_f_json}
                        '''
                    ),
                ],
                tab_id=f'payload-tab-{n}',
                label=ai_task, label_style={'borderRadius': 0}
            ),
        )
    return payloads_output


# Fetch examples for editing
def get_examples(examples):
    examples_ui = []
    for ai_task in filtered_ai_task:
        examples_ui.append(
                    dbc.Tab(
                        [
                        html.Div(id=f"{ai_task}-example-provider-div", 
                                 children=[
                                      dbc.Label(children=[html.B("Select provider")], style={"margin-top": "0.5rem"}),
                                      dcc.Dropdown(provider_by_tasks[ai_task], preffered_provider[ai_task], searchable=False,  clearable=False, id=f"{ai_task}-example-drpdown", style={"width": "8rem"})
                                    ], style={"padding-top":"1rem", "display":"flex", "flex-direction":"row", "gap": "1rem", "align-items": "center"}),
                        html.Br(),
                        html.Div(id=f"{ai_task}-example-text-div",
                                    children=[
                                                dbc.Label(children=[html.B("Edit examples")], id=f"{ai_task}-example-lable"),
                                                dbc.Textarea(id=f"{ai_task}-example", rows=8,className="carbon-input", value=examples[ai_task][preffered_provider[ai_task]])
                                            ]
                                        ),
                                    html.Div(children = [dbc.Button("Save", id=f"{ai_task}-save-example", color="primary", disabled=True, n_clicks=0, className="carbon-btn", style={"margin-top":"1rem"}),
                                    dbc.Button("Cancel", id=f"{ai_task}-cancel-example", color="danger",outline=True, n_clicks=0, className="carbon-btn", style={"margin-top":"1rem"}),
                        ], style={"display":"flex", "flex-direction": "row", "gap": "1rem"}),
                        dbc.Alert("", color="success", id=f"{ai_task}-save-example-msg", style={"margin-top": "1rem", "display": "none"})
                    ], 
                    tab_id=f'example-tab-{ai_task}', label=ai_task, label_style={'borderRadius': 0}, style={"background-color": "white", "padding-left": "1rem", "padding-right": "1rem"}))
    return examples_ui


def parse_output(res, type):
    parseoutput = []
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
        return dcc.Markdown(md(res))


# LLM API call
def llm_fn(provider, ai_task, api, text, type, examples):
    print("calling LLM", datetime.now())
    payload_json = {
        "provider": provider,
        "search": [ai_task, "sales-conversation", "uid-s1" if ai_task=="summarization" else "uid-e1"],
        "OPENAI_API_KEY": api,
        "input_text": text
        }
    try:
        HEADERS['Content-Type'] = 'application/json'
        response_llm = requests.post(EXECUTE_PROMPTS, headers=HEADERS, data=json.dumps(payload_json))
        response_llm_json = response_llm.json()
    except Exception as e:
        print("Error : ",e)
    try:
        return parse_output(response_llm_json['results'][0]['generated_text'] if provider=="watsonx" else response_llm_json['choices'][0]['text'], type)
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()),response_llm_json)
        return str(response_llm_json)


# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    State("provider-api-key-store", "data"),
    State('preffered-provider-store', 'data'),
    State("examples-store", "data"),
    prevent_initial_call=True
)
def generate_output_llm(n, text, api_key_store, preffered_provider, examples):
    if(n>0):
        # If Input is tampered
        if(text not in [sample_from_file]):
            time.sleep(0.5)
            return dbc.Alert(dcc.Markdown(configs_dict["error_msg_use_sample_text"]), color="danger")
            
        output = []
        ai_tasks = configs_dict['ai_tasks'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        types = configs_dict['generate_btn_output_type'].split(',')

        for ai_task, label, type in zip(ai_tasks, labels, types):
            try:
                output.append(html.Div([html.H5(label), llm_fn(preffered_provider[ai_task],ai_task, api_key_store[preffered_provider[ai_task]], text, type, examples[ai_task][preffered_provider[ai_task]])], className="output-div"))
            except Exception as e:
                print(ai_task, e)
                time.sleep(1)

        return output
    return []

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    prevent_initial_call=True
)
def generate_output_llm(n):
    if(n>0):
        return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'), State('preffered-provider-store', 'data'),
     State("examples-store", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, preffered_provider, examples):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, preffered_provider, examples)
        return not is_open,op
    return is_open, []

# Open/Close example modal
@app.callback(
    Output("example-modal", "is_open"),
    Output("example-modal-tb", "children"),
    [Input("example-button", "n_clicks")],
    [State("example-modal", "is_open"), State("examples-store", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, examples):
    if n1:
        op=[]
        if(not is_open):
            op=get_examples(examples)
        return not is_open,op
    return is_open, []

# Open/Close provider modal
@app.callback(
    Output("provider-modal", "is_open"),
    # Output("provider-modal-tb", "children"),
    [Input("provider-button", "n_clicks")],
    [State("provider-modal", "is_open"), State("provider-api-key-store", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, api_key_store):
    if n1:
        # if(not is_open):
            # op=get_providers(api_key_store)
        return not is_open #,op
    return is_open #, []

for ai_task in filtered_ai_task:
    # save provider selection & custom api key
    @app.callback(
            Output('preffered-provider-store', 'data', allow_duplicate=True),
            Output('provider-api-key-store', 'data', allow_duplicate=True),
            Output(f'{ai_task}-save-msg', 'style'),
            Input(f'{ai_task}-save-provider', 'n_clicks'),
            State(f'{ai_task}-api-key', 'value'),
            State('provider-api-key-store', 'data'),
            State(f'{ai_task}-provider-drpdown', 'value'),
            State('provider-modal-tb', 'active_tab'),
            State('preffered-provider-store', 'data'),
            prevent_initial_call=True
    )
    def save_provider(n, api, api_key_store, provider, active_tab, preffered_provider):
        if(n>0):
            api_key_store[provider] = api
            triggered_ai_task = active_tab.replace('provider-tab-','').strip()
            preffered_provider[triggered_ai_task] = provider
        return preffered_provider, api_key_store, {"margin-top": "1rem", "display": "block"}
    
    # show/hide api textbox
    @app.callback(
        Output(f'{ai_task}-api-key', 'value', allow_duplicate=True),
        Output(f'{ai_task}-api-div', 'style'),
        Output(f"{ai_task}-api-lable", "children"),
        Input(f'{ai_task}-provider-drpdown', 'value'),
        State('provider-api-key-store', 'data'),
        prevent_initial_call='initial_duplicate'
    )
    def show_api_textbox(provider, api_key_store):
        if(provider!="watsonx"):
            return api_key_store[provider], {"display": "block", "margin-top":"1rem"}, [html.B(f"{provider} api key")]
        return "", {"display": "none"}, [html.B(f"{provider} api key")]
    
    # remove saved success msg
    @app.callback(
        Output(f'{ai_task}-save-msg', 'style', allow_duplicate=True),
        Input(f'{ai_task}-api-key', 'value'),
        Input(f'{ai_task}-provider-drpdown', 'value'),
        Input('provider-modal-tb', 'active_tab'),
        Input("provider-modal", "is_open"),
        prevent_initial_call=True
    )
    def remove_saved_msg(n1, n2, active_tab, is_open):
        # if(n1>0):
        return {"display":"none"}

    # display example
    @app.callback(
        Output(f'{ai_task}-example', 'value'),
        Input(f'{ai_task}-example-drpdown', 'value'),
        Input('example-modal-tb', 'active_tab'),
        State('example-modal-tb', 'active_tab'),
        State("examples-store", "data")
    )
    def show_examples(provider, active_tab_in, active_tab, examples):
        triggered_ai_task = active_tab.replace("example-tab-", "").strip()
        # examples = requests.get(GET_EXAMPLES+f"/{provider}/{triggered_ai_task}", headers=HEADERS)
        return examples[triggered_ai_task][provider] # examples.text
    
    # save example. Use at will as this will update examples in framework.
    # @app.callback(
    #     Output("examples-store", "data", allow_duplicate=True),
    #     Output(f"{ai_task}-save-example-msg", "children"),
    #     Output(f"{ai_task}-save-example-msg", "style"),
    #     Output(f"{ai_task}-save-example-msg", "color"),
    #     Input(f'{ai_task}-save-example', 'n_clicks'),
    #     State(f'{ai_task}-example-drpdown', 'value'),
    #     State(f'{ai_task}-example', 'value'),
    #     State("examples-store", "data"),
    #     prevent_initial_call=True
    # )
    # def save_examples(n1, provider, new_example, examples):
    #     if(n1>0):
    #         triggered_ai_task = ctx.triggered_id.replace("-save-example", "").strip()
    #         # HEADERS['Content-Type'] = 'application/json'
    #         # resp = requests.post(UPDATE_EXAMPLE, headers=HEADERS, data=json.dumps({"provider": provider,"ai_task": triggered_ai_task, "text": new_example}))
    #         # resp = resp.text
    #         # if(resp=="Examples updated"):
    #         #     return [f"{ai_task} examples updated"], {"margin-top": "1rem", "display": "block"}, "success"
    #         # else:
    #         #     return [f"Please try again"], {"margin-top": "1rem", "display": "block"}, "danger"
    #         examples[triggered_ai_task][provider] = new_example
    #         return examples, [f"{ai_task} examples updated"], {"margin-top": "1rem", "display": "block"}, "success"
    #     return examples, [], {"margin-top": "1rem", "display": "none"}, "success"
        

    # remove example saved success msg
    @app.callback(
        Output(f'{ai_task}-save-example-msg', 'style', allow_duplicate=True),
        Input(f'{ai_task}-example', 'value'),
        Input(f'{ai_task}-example-drpdown', 'value'),
        Input('example-modal-tb', 'active_tab'),
        prevent_initial_call=True
    )
    def remove_saved_msg(n1, n2, active_tab):
        return {"display":"none"}

    # close provider modal
    @app.callback(
    Output("provider-modal", "is_open", allow_duplicate=True),
    Input(f"{ai_task}-cancel-provider", "n_clicks"),
    State("provider-modal", "is_open"),
    prevent_initial_call=True
    )
    def close_provider_modal(n1, is_open):
        if(n1>0):
            return not is_open
        return is_open
    
    # close example modal
    @app.callback(
        Output("example-modal", "is_open", allow_duplicate=True),
        Input(f"{ai_task}-cancel-example", "n_clicks"),
        State("example-modal", "is_open"),
        prevent_initial_call=True
    )
    def close_example_modal(n1, is_open):
        if(n1>0):
            return not is_open
        return is_open

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="False"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)