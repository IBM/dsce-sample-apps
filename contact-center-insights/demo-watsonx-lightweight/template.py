import os, time
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
import requests
import json
import base64
import io
import traceback
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime

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
CPD_USERNAME = os.getenv("CPD_USERNAME")
CPD_PASSWORD = os.getenv("CPD_PASSWORD")
HEADERS = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }


# Read Sample text from file
sample_from_file = ""
with open('transcript.txt', 'r') as sample_text_f:
    sample_from_file = sample_text_f.read()


color_code = ["#6929c4", "#009d9a"]
# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
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
                     value="",
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input"
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn", style={"overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"}
)

sample_text_button = dbc.Button(
    "Sample text", id="sample-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn", style={"overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"}
)

upload_file_note = dbc.Row(dbc.Col(
                            html.Div(
                                children=[html.I(className="bi bi-info-circle"),html.P("Allowed file types: .txt & File size limit to upload: 50Kb", style={"color": "#525252", "fontSize": "0.8rem","fontWeight": 400,"letterSpacing": 0,"paddingLeft":"0.5rem", "paddingTop":"3px"})],
                            style={"display":"flex"}),
                    )
                )

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", id="upload-data-button", outline=True, color="primary", n_clicks=0, className="carbon-btn", style={"paddingTop":"0.5rem", "overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"})
    ],
    max_size=50000,
    accept=".txt",
    disabled=False
)

buttonsPanel = dbc.Row([
                dbc.Col(sample_text_button),
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                   dbc.Col(sample_text_button),dbc.Col(generate_button),
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
                                upload_file_note,
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
                                upload_file_note,
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-5 border-end",
                            style={'padding': '1rem'}
                        ),
                        dbc.Col(
                            children=[
                                html.Div([
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

# Fetch payloads for viewing
def get_payloads(text):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        payload_f_json['data']['input'] = text
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

def parse_output(res, type, index):
    parseoutput = []
    if(type == 'text'):
        return res
    if(type == 'label'):
        return html.H5(dbc.Badge(res, color=color_code[index%2], style={'borderRadius': '12px','marginLeft':'8px','paddingLeft':'16px', 'paddingRight':'16px', 'textWrap':'wrap'}))
    elif(type == 'key-value'):
        try:
            res = res.replace("Input:","")
            pairs = res.split(';')
            for pair in pairs:
                if(pair.strip()!="" and ":" in pair and len(pair.split(":"))==2):
                    k, v = pair.split(':')
                    parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
            return html.Div(parseoutput, className="key-value-div-parent")
        except:
            return res
    elif(type == 'markdown'):
        return dcc.Markdown(md(res))

# Get IBM access token and return headers
def get_header_with_access_tkn(cpd_api):
    headers_with_access_tkn = HEADERS.copy()
    encoded_api = base64.b64encode(f'{CPD_USERNAME}:{cpd_api}'.encode('utf-8'))
    headers_with_access_tkn['Authorization'] = 'ZenApiKey {}'.format(encoded_api.decode("ascii"))
    return headers_with_access_tkn

def generate_cpd_token():
    req_url = SERVER_URL+'/icp4d-api/v1/authorize'
    data = {
        'username': CPD_USERNAME,
        'password': CPD_PASSWORD
    }
    token = requests.post(req_url, headers={"Content-Type": "application/json"}, data=json.dumps(data))
    token_json = token.json()
    return token_json['token']

def generate_cpd_api(token):
    req_url = SERVER_URL+'/usermgmt/v1/user/apiKey'
    HEADERS = {
        "Authorization": f"Bearer {token}"
    }
    api = requests.get(req_url, headers=HEADERS)
    api_json = api.json()
    return api_json['apiKey']

# LLM API call
def llm_fn(text, payload_json, type, index):
    try:
        payload_json['input'] = payload_json['input']+text+"\n\nOutput:\n\n"
        print("calling LLM", datetime.now())
    except Exception as e:
        print("error: ", e)
    try:
        token = generate_cpd_token()
        cpd_api = generate_cpd_api(token)
    except Exception as e:
        print("Error while generating cpd token: ", e)
    response_llm = requests.post(SERVER_URL+'/ml/v1/text/generation?version=2023-05-29', headers=get_header_with_access_tkn(cpd_api), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()
    try:
        return parse_output(response_llm_json['results'][0]['generated_text'], type, index)
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

# For Upload Data
if configs_dict['show_upload'] in ["true", "True"]:
    @app.callback(Output('user-input', 'value'),
                Output('generate-output', 'children', allow_duplicate=True),
                Input('upload-data', 'contents'),
                State('upload-data', 'filename'),
                State('upload-data', 'last_modified'),
                State('generate-output', 'children'),
                State('user-input', 'value'),
                prevent_initial_call=True)
    def uploadData(list_of_contents, list_of_names, list_of_dates, generated_output, current_input):
        if list_of_contents is not None:
            file_type = list_of_names.split('.')[1]
            if(file_type!="txt"):
                return current_input, dbc.Alert("Only .txt files are allowed and file size should not exceed 50Kb", color="danger")
            
            return parse_contents(list_of_contents, list_of_names, list_of_dates), html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})


# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text):
    if(n>0):
        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        types = configs_dict['generate_btn_output_type'].split(',')
        
        for action, label, payload_file, type, i in zip(actions, labels, payloads, types, range(len(types))):
            try:
                with open('payload/{}.json'.format(payload_file)) as payload_f:
                    payload_f_json = json.load(payload_f)

                if(action == "llm"):
                    output.append(html.Div([html.H5(label, style={'marginBottom': '0rem', 'fontWeight':'bold'}), html.Hr(style={'marginTop':'0.4rem'}), llm_fn(text, payload_f_json, type, i)], className="output-div"))
            except Exception as e:
                print(action, traceback.format_exc(e))
                time.sleep(1)
        output = html.Div([html.Div([output[0], output[1]], style={"display": "flex", "flexDirection": "row", "justifyContent": "space-between", "marginBottom": "1.5rem"}), output[2], output[3]], style={"margin":"1rem"})
        return html.Div(output, style={'border': '1px solid grey', 'padding': '1rem', 'border-radius': '1rem'})
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
    [State("payload-modal", "is_open"), State('user-input', 'value')],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text)
        return not is_open,op
    return is_open, []

# populate sample text in text box
@app.callback(
        Output("user-input", "value", allow_duplicate=True),
        Input("sample-text-button", "n_clicks"),
        prevent_initial_call=True
)
def populate_sample_text(n_clicks):
    if(n_clicks>0):
        return sample_from_file if len(sample_from_file)>0 else configs_dict['sample_text']


# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8052")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
