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
# from langdetect import detect
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
WATSONX_PROJECT_ID = os.getenv('WATSONX_PROJECT_ID')
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

# Read all sample transcript text from files
sample_from_file = {}
available_languages = []
directory = 'transcripts'
default_language = "english"
for filename in os.listdir(directory):
    if "-draft" not in filename:
        language = filename.split('.')[0]
        available_languages.append(language)
        with open(os.path.join(directory, filename)) as sample_text_f:
            sample_from_file[language] = sample_text_f.read()

def get_samples():
    data_for_samples = []
    for language in available_languages:
        data_for_samples.append(f"{language} sample text".capitalize())
    return data_for_samples

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], style={'color': 'white', 'textDecoration': 'none'})],
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
                     value=sample_from_file[default_language.lower()],
                     placeholder=configs_dict['input_placeholder_text'],
                     disabled=True,
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input"
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn", style={"overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"}
)

sample_text_dropdown = dcc.Dropdown(options=get_samples(), value=f"{default_language.capitalize()} sample text", searchable=False, clearable=False, maxHeight=175, optionHeight=32,
                                        id="language-dropdown", style={"width": "14rem", "borderTop": "none", "borderRight": "none", "borderLeft": "none", "borderRadius": "unset", "marginTop": "0.5rem"})



upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", id="upload-data-button", outline=True, color="primary", n_clicks=0, className="carbon-btn", style={"paddingTop":"0.5rem", "overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"})
    ],
    max_size=50000,
    accept=".txt",
    disabled=False
)

buttonsPanel = dbc.Row([
                dbc.Col(sample_text_dropdown),
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                   dbc.Col(sample_text_dropdown),dbc.Col(generate_button),
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
                                # upload_file_note,
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
                        # dbc.Col(className="col-1"),
                        dbc.Col(
                            children=[
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttonsPanel,
                                # upload_file_note,
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-6 border-end",
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
                            className="col-6", style={"maxHeight": "calc(100vh - 48px - 76px - 48px)", "overflowY": "auto"}
                        ),
                        # dbc.Col(className="col-1"),
                    ],
                    className="px-3 pb-5"
                )

app.layout = html.Div(children=[
                    navbar_main,
                    html.Div(payload_modal),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

# Fetch payloads for viewing
def get_payloads(text, selected_language):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-{}-view.json'.format(payload_file, selected_language.split(" ")[0].lower())) as payload_f:
            payload_f_json = json.load(payload_f)
        payload_f_json['data']['input'] = text
        payload_f_json = json.dumps(payload_f_json, indent=2, ensure_ascii=False)
        
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
        return res
    if(type == 'label'):
        return html.H5(dbc.Badge(res, color="#1192e8", style={'borderRadius': '12px','marginLeft':'8px','paddingLeft':'16px', 'paddingRight':'16px'}))
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
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# LLM API call
def llm_fn(text, payload_json, type, access_token, lang):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['input'] = payload_json['input'].replace("{{input_text}}",text)
    print("calling LLM", datetime.now())
    
    try:
        response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json, ensure_ascii=False).encode())
        response_llm_json = response_llm.json()
    except Exception as e:
        print("Error: ", e)
    try:
        return parse_output(response_llm_json['results'][0]['generated_text'].replace("Input:","").replace("\n","<br/>"), type)
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
    State('language-dropdown', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text, selected_language):
    if(n>0):
        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        types = configs_dict['generate_btn_output_type'].split(',')
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()
        
        for action, label, payload_file, type in zip(actions, labels, payloads, types):
            try:
                lang=selected_language.split(" ")[0].lower()
                with open('payload/{}-{}.json'.format(payload_file, lang)) as payload_f:
                    payload_f_json = json.load(payload_f)

                if(action == "llm"):
                    output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type, access_token, lang)], className="output-div"))
            except Exception as e:
                print(action, traceback.format_exc(e))
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
    [State("payload-modal", "is_open"), State('user-input', 'value'), State('language-dropdown', 'value')],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, selected_language):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, selected_language)
        return not is_open,op
    return is_open, []

# populate sample text in text box
@app.callback(
        Output("user-input", "value", allow_duplicate=True),
        Input("language-dropdown", "value"),
        prevent_initial_call=True
)
def populate_sample_text(language):
    if(language):
        return sample_from_file[language.split(" ")[0].lower()]
    return sample_from_file[default_language.lower()]


# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
