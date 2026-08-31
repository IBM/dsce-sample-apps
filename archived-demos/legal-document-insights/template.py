import os, time
from util import CustomThread
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
import requests
import json
import base64
import io
from dotenv import load_dotenv
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime

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

# Read Sample text from file
sample_from_file_1 = ""
with open('guidelines.txt', 'r') as sample_text_f:
    sample_from_file_1 = sample_text_f.read()

sample_from_file_2 = ""
with open('legal-contract.txt', 'r') as sample_text_f:
    sample_from_file_2 = sample_text_f.read()

# Load payloads
g_payload_files = configs_dict['generate_btn_payload_files'].split(',')
f_json = open('./payload/{}.json'.format(g_payload_files[0]))
payload_f_json_extract_clause = json.load(f_json)
f_json = open('./payload/{}.json'.format(g_payload_files[1]))
payload_f_json_classification = json.load(f_json)
f_json = open('./payload/{}.json'.format(g_payload_files[2]))
payload_f_json_review_clause = json.load(f_json)

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP,
                                      'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'],
                suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
            style={'fontSize': '0.875rem', 'fontWeight': '600'},
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
    class_name="bg-dark"
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
                 disabled=True,
                 placeholder=configs_dict['input_placeholder_text'],
                 rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict[
                     'input_v_rows'],
                 class_name="carbon-input"
                 ),
],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn"
)

sample_pdf_1 = dbc.Button(
    "View Guidelines Doc", id="sample-1-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

sample_pdf_2 = dbc.Button(
    "View Legal Contract", id="sample-2-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

sample_1_file_download = dbc.Row(dbc.Col(
    html.Div(
        children=[dbc.Button("Download contract pdf", id="download-sample-pdf-1", n_clicks=0,
                             style={"fontSize": "0.8rem", "fontWeight": 400, "letterSpacing": 0,
                                    "paddingLeft": "0.5rem", "paddingTop": "3px"},
                             className="btn-link"),
                  ],
        style={"display": "flex"}),
)
)

sample_2_file_download = dbc.Row(dbc.Col(
    html.Div(
        children=[dbc.Button("Download guidance pdf", id="download-sample-pdf-2", n_clicks=0,
                             style={"fontSize": "0.8rem", "fontWeight": 400, "letterSpacing": 0,
                                    "paddingLeft": "0.5rem", "paddingTop": "3px"},
                             className="btn-link"),
                  ],
        style={"display": "flex"}),
)
)

buttonsPanel = dbc.Row([
    dbc.Col(sample_pdf_1),
    dbc.Col(sample_pdf_2),
    # dbc.Col(upload_button),
    dbc.Col(generate_button),
]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
    dbc.Col(sample_pdf_1), dbc.Col(sample_pdf_2), dbc.Col(generate_button),
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
                dcc.Download(id="sample-contract"),
                sample_1_file_download,
                sample_2_file_download,
                html.Br(),
                html.Hr(),
                html.Div([
                    # html.H5(configs.get('Output_title')),
                    html.Div(children=[html.P(configs_dict["helper_text"],
                                              style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],
                             id='generate-output')
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
        dbc.Col(
            children=[
                html.H5(configs_dict['Input_title']),
                html.Div(user_input),
                buttonsPanel,
                dcc.Download(id="sample-contract"),
                sample_1_file_download,
                sample_2_file_download,
                html.Br(),
                html.Br(),
            ],
            className="col-6 border-end",
            style={'padding': '1rem'}
        ),
        dbc.Col(
            children=[
                html.Div([
                    html.Div(children=[html.P(configs_dict["helper_text"],
                                              style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],
                             id='generate-output')
                ],
                    style={'padding': '1rem 1rem'}
                ),
            ],
            className="col-6"
        ),
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
        # payload_f_json['inputs'] = [text]
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

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn


# LLM API call
def llm_fn(payload_json, access_token):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    print("calling LLM", datetime.now())
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()
    try:
        print("exit calling LLM", datetime.now())
        return response_llm_json['results'][0]['generated_text']
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()), response_llm_json)
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
    @app.callback(Output('sample-instruction', 'value'),
                  Input('upload-data', 'contents'),
                  State('upload-data', 'filename'),
                  State('upload-data', 'last_modified'),
                  prevent_initial_call=True)
    def uploadData(list_of_contents, list_of_names, list_of_dates):
        if list_of_contents is not None:
            return parse_contents(list_of_contents, list_of_names, list_of_dates)


def format_extract_clause_op(answer):
    print("formatting extract clause op...")
    # answer = answer.split('\n\n')[0]
    answer = answer.replace("Out:", "")
    answer = answer.replace("output:", "")
    answer = answer.replace('"', '')
    return answer.strip()

def format_classification_op(answer):
    print("formatting classification op...")
    answer=answer.strip("\n")
    return answer.strip()

def format_review_clause_op(answer):
    print("formatting review clause op...")
    return answer.strip()

# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    # State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n):
    if (n > 0):
        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')

        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()
        for action in actions:
            try:
                if action == "llm":
                    t1 = CustomThread(target=llm_fn, args=(payload_f_json_extract_clause, access_token))
                    t1.start()
                    t2 = CustomThread(target=llm_fn, args=(payload_f_json_classification, access_token))
                    t2.start()
                    t3 = CustomThread(target=llm_fn, args=(payload_f_json_review_clause, access_token))
                    t3.start()
                    t1.join()
                    t2.join()
                    t3.join()
                    result_from_call_1 = format_extract_clause_op(t1.value1)
                    result_from_call_2 = format_classification_op(t2.value1)
                    result_from_call_3 = format_review_clause_op(t3.value1)

                    output.append(html.Div([html.H5(labels[0]), dcc.Markdown(result_from_call_1,
                                                                             style={"overflow-x": "scroll",
                                                                                    "white-space": "pre"})],
                                           className="output-div"))
                    output.append(html.Div([html.H5(labels[1]), dcc.Markdown(result_from_call_2,
                                                                             style={"overflow-x": "scroll",
                                                                                    "white-space": "pre"})],
                                           className="output-div"))
                    output.append(html.Div([html.H5(labels[2]), dcc.Markdown(result_from_call_3,
                                                                             style={"overflow-x": "scroll",
                                                                                    "white-space": "pre"})],
                                           className="output-div"))
            except Exception as e:
                print(e)
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
    if (n > 0):
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
        op = []
        if (not is_open):
            op = get_payloads(text or "")
        return not is_open, op
    return is_open, []

# populate sample text 1 in text box
@app.callback(
    Output("user-input", "value", allow_duplicate=True),
    Input("sample-1-text-button", "n_clicks"),
    prevent_initial_call=True
)
def populate_sample_text(n_clicks):
    if (n_clicks > 0):
        return sample_from_file_1

# populate sample text 2 in text box
@app.callback(
    Output("user-input", "value", allow_duplicate=True),
    Input("sample-2-text-button", "n_clicks"),
    prevent_initial_call=True
)
def populate_sample_text(n_clicks):
    if (n_clicks > 0):
        return sample_from_file_2

# download sample contract file
@app.callback(
    Output("sample-contract", "data"),
    Input("download-sample-pdf-1", "n_clicks"),
    prevent_initial_call=True,
)
def download_file(n_clicks):
    return dcc.send_file("data/contract.pdf")

# download sample contract 2 file
@app.callback(
    Output("sample-contract", "data", allow_duplicate=True),
    Input("download-sample-pdf-2", "n_clicks"),
    prevent_initial_call=True,
)
def download_file(n_clicks):
    return dcc.send_file("data/guidance.pdf")

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)