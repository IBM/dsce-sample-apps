import os, time, dash, json, base64, requests
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
from jproperties import Properties
from markdownify import markdownify as md


SERVER_URL = os.getenv("SERVER_URL")
API_KEY = os.getenv("API_KEY")
MODEL_ID = os.getenv("MODEL_ID")

# instantiate config
configs = Properties()
# load properties into configs
with open('app-config.properties', 'rb') as config_file:
    configs.load(config_file)


sample_text = ""

with open('sample-prompt.txt', 'r') as prompt:
    sample_text = prompt.read()

with open('payload/salesforce-chat-completions.json') as payload_f:
    chat_completions_payload = json.load(payload_f)

with open('payload/salesforce-completions.json') as payload_f:
    completions_payload = json.load(payload_f)

# read into dictionary
configs_dict = {}
items_view = configs.items()
for item in items_view:
    configs_dict[item[0]] = item[1].data


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
server = app.server
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            # dbc.DropdownMenuItem("Edit instruction/example", id="example-button", n_clicks=0, class_name="dmi-class")
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

user_input = dbc.InputGroup([
        dbc.Textarea(id="user-input",
                     value=sample_text,                  
                     rows=configs_dict['input_rows'],
                     class_name="carbon-input",
                     placeholder='Enter your prompt here...',
                     
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn"
)

sample_text_button = dbc.Button(
    "Use sample input", id="sample-1-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

buttonsPanel = dbc.Row([
                dbc.Col(generate_button, style={'max-width': 'fit-content'}),
                dbc.Col(sample_text_button, style={'max-width': 'fit-content'}),
            ])

footer = html.Footer(
    dbc.Row([
        dbc.Col(children=[dcc.Markdown(configs_dict['footer_text'])],className="p-3 pb-0")]),
    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
    className="bg-dark position-fixed bottom-0"
)


form =  html.Div(
                 children=[
                                html.H4("Enter details of large language model to connect to."),
                                html.H5("Endpoint information"),
                                dbc.Label("Name", html_for="name"),
                                dbc.Input(type="text", id="name", value='IBM Granite connection',disabled=True, placeholder="Enter an endpoint name..."),
                                html.Br(),
                                dbc.Label("URL", html_for="connection-url"),
                                dbc.Input(type="text", id="connection-url", value=SERVER_URL,disabled=True, placeholder="https://example.com"),
                                html.Br(),
                                dbc.Label("Authentication", html_for="auth-type"),
                                 dcc.Dropdown(
                                    ['Key Based'],
                                    'Key Based',
                                    searchable=False,
                                    clearable=False,
                                    disabled=True,
                                    id="auth-type"
                                ),
                                html.Br(),
                                dbc.Label("Auth Header", html_for="auth-header"),
                                dbc.Input(type="text", value="X-IBM-API-KEY",disabled=True, id="auth-header"),
                                html.Br(),
                                dbc.Label("Key", html_for="key"),
                                dbc.Input(type="password",value="******", disabled=True, id="key"),
                                html.Br(),
                                html.H5("Model information"),
                                dbc.Label("Model Name/ID (Optional)", html_for="model"),
                                dbc.Input(type="text", id="model", value=MODEL_ID, disabled=True),
                                html.Br(),
                                dbc.Button(
                                        "Connect", id="connect-button", color="primary", n_clicks=0, className="carbon-btn"
                                    ),
                                dbc.Toast(
                                    [html.P("Connection successful!", className="mb-0")],
                                    id="auto-toast",
                                    header="Connection status",
                                    icon="success",
                                    duration=4000,
                                    is_open=False,
                                    style={"position": "fixed", "top": 66, "right": 10, "width": 350}
                                ),                       
                            ],
                className="col-8"
                ),

form_tab = dbc.Row(
                    [
                        dbc.Col(className="col-3"),
                        dbc.Col(
                            form,
                            className="col-6",
                            style={'padding': '1rem'}
                        ),
                       
                        dbc.Col(className="col-3"),
                    ],
                    className="px-3 pb-5"
                )

interactive_ip_op = dbc.Row(
                    [
                        dbc.Col(className="col-3"),
                        dbc.Col(
                            children=[
                                html.P(['Test the connection by prompting ', html.A(' IBM Granite', href='https://www.ibm.com/granite', target='_blank'), ' on watsonx.ai from Salesforce\'s ', html.A('LLM Open Connector', href="https://github.com/salesforce/einstein-platform?tab=readme-ov-file#llm-open-connector", target='_blank'), ' specification.'], style={'font-size': 'large'}),
                                html.Div([
                                html.Div(user_input),
                                html.Div(children=[
                                     dbc.Label("Endpoint to test:"),
                                     dbc.RadioItems(
                                            options=[
                                                {"label": "/chat/completions", "value": '/chat/completions'},
                                                {"label": "/completions", "value": '/completions'},
                                            ],
                                            value='/chat/completions',
                                            id="endpoint-input",
                                        ),
                                ]),
                                html.Br(),
                                buttonsPanel,
                                ], className='input_form'),
                                html.Br(),
                                html.Br(),
                                 html.Div([
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output')
                                    ],
                                    style={'padding': '1rem 2rem'},
                                    className='output_area'
                                ),
                                html.Br(),
                            ],
                            className="col-6",
                            style={'padding': '1rem'}
                        ),
                        dbc.Col(className="col-3"),
                    ],
                    className="px-3 pb-5"
                )


home_tabs = dbc.Tabs(children=[
    dbc.Tab(form_tab, label="Connect to watsonx.ai model", tab_id="form-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'}),
    dbc.Tab(interactive_ip_op, label="Inference watsonx.ai model", tab_id="intercative-ipop-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'})
], id="homepage-tabs", active_tab="form-tab")

app.layout = html.Div(children=[
                    navbar_main,
                    html.Div(payload_modal),
                    home_tabs,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

# Fetch payloads for viewing
def get_payloads(text):
    payloads_output=[]
    payloads = [chat_completions_payload, completions_payload]
    labels = ["Chat Completions", "Completions"]
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        if(n==0):
            payload_file['messages'][0]['content'] = text
        else:
            payload_file['prompt'] = text
        payload_file['model'] = MODEL_ID
        payload_f_json = json.dumps(payload_file, indent=4)
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

def parse_output(res, type):
    parseoutput = []
    if(type == 'text'):
        res = res.replace("Output:","")
        res = res.replace("END","")
        res = res.replace("Input:","")
        return dcc.Markdown(res)
    elif(type == 'label'):
        return html.H5(dbc.Badge(res, color="#1192e8", style={'borderRadius': '12px','marginLeft':'8px','paddingLeft':'16px', 'paddingRight':'16px'}))
    elif(type == 'key-value'):
        allowed_entities = ["person", "organization", "location", "money", "date"]
        fetched_entites_key = []
        res = res.replace("Named Entities:","")
        try:
            pairs = res.split(',')
            cnt=1
            for pair in pairs:
                pair = pair.strip()
                if(pair!="" and ":" in pair and len(pair.split(":"))==2):
                    k, v = pair.split(':')
                    key_to_append = " ".join(k.strip().lower().split(" ")[1:])
                    if(v.strip().lower() in allowed_entities and key_to_append not in fetched_entites_key and cnt<=10):
                        fetched_entites_key.append(key_to_append)
                        parseoutput.append(html.Div([html.B(str(cnt)+'. '+" ".join(k.split(" ")[1:])+':'), v], className="key-value-div"))
                        cnt+=1
            return html.Div(parseoutput, className="key-value-div-parent")
        except:
            return res
    elif(type == 'markdown'):
        return dcc.Markdown(md(res))
    else:
        return res

# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    State('endpoint-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text, endpoint):
    if(n>0):
        output = []
        headers={
                'X-IBM-API-KEY': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        body=None
        if endpoint=='/chat/completions':
            chat_completions_payload['messages'][0]['content'] = text
            body = chat_completions_payload.copy()
        else:
            completions_payload['prompt'] = text
            body = completions_payload.copy()
        body['model']=MODEL_ID
        try:  
            res = requests.post(SERVER_URL+endpoint, headers=headers, data=json.dumps(body))
            res_json = res.json()
            output.append(html.Pre(json.dumps(res_json, indent=4), className="output-div"))
        except Exception as e:
            print("Error: ", e)
            output.append(html.Div(e, className="output-div"))
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
    [State("payload-modal", "is_open"),
     State('user-input', 'value')],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text or "")
        return not is_open,op
    return is_open, []

# populate sample text 1 in text box
@app.callback(
    Output("user-input", "value", allow_duplicate=True),
    Input("sample-1-text-button", "n_clicks"),
    prevent_initial_call=True
)
def populate_sample_jobreq1(n_clicks):
    if(n_clicks>0):
        return sample_text if len(sample_text)>0 else configs_dict['sample_text']         

# open connection toast
@app.callback(
    Output("auto-toast", "is_open"),
    Input('connect-button', 'n_clicks'),
    State("auto-toast", "is_open")
)
def open_connection_toas(n, is_open):
    if(n):
        return True
    return is_open

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
