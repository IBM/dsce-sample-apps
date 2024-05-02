import os, time
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
import requests
import json
from jproperties import Properties
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

#For LLM call
SERVER_URL = os.getenv('SERVER_URL')
WATSONX_PROJECT_ID = os.getenv('WATSONX_PROJECT_ID')
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }
# Load payload file
with open('payload/q_and_a-payload.json') as q_and_a_payload:
  q_and_a_payload_json = json.load(q_and_a_payload)


# List of files under document folder
document_files = os.scandir('documents/')
documents = []
for i in document_files:
    documents.append(i.name)

# Read Sample text from file
sample_from_file=""

suggestions_list = ["What the nearest hospital in zip code 77001 in AllBright Insurance Company?",
                    "What is the full address with city of the hospital in zip code 77001 in AllBright Insurance Company?",
                    "What is the claims process with the AllBright Insurance Company?",
                    "What are the benefits of the policy with AllBright Insurance Company?",
                    "Is a dental plan covered in policy with AllBright Insurance Company?",
                    "Why is plastic surgery not included in plan with AllBright Insurance Company?"
                    ]
suggestions_options = []
for input_suggestion in suggestions_list:
    suggestions_options.append(html.Option(input_suggestion))

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(configs_dict['navbartitle'],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("View source document", id="view-doc-button", n_clicks=0, class_name="dmi-class"),
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

view_doc_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Document")),
        dbc.ModalBody([
            html.Pre(id="view-doc-modal-content")
        ]),
    ],
    id="view-doc-modal",
    size="xl",
    # fullscreen=True,
    scrollable=True,
    is_open=False,
)

input_data_list = html.Datalist(suggestions_options, id="input-data-list")

user_input = dbc.InputGroup(
    [
        dbc.Input(id="user-input",
                  value=sample_from_file if len(sample_from_file)>0 else configs_dict['sample_text'],
                  placeholder=configs_dict['input_placeholder_text'],
                  class_name="carbon-input",
                  list="input-data-list"
                  ),
        dbc.Button(id="search-button", class_name="search-btn", color="primary", outline=True, children=html.I(className="bi bi-search"))
    ],
    className="mb-3",
)

right_side_panel = html.Div(
    [
        dbc.Button(configs_dict['select_doc_btn_text'], id="open-right-panel", className="carbon-btn", outline=True, color="primary", n_clicks=0),
        dbc.Offcanvas([
            html.Div(className='right-panel-header'),
            dbc.RadioItems(
                documents, documents[0],
                id="right-panel-radio",
                className="radio-items",
            )],
            id="right-panel",
            placement="end",
            is_open=False,
            title=configs_dict['select_doc_btn_text']
        ),
    ],
    className="upload-data"
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

buttonsPanel = dbc.Row([
                dbc.Col(right_side_panel,),
                dbc.Col(generate_button),
            ], style=dict(display="none")) if configs_dict['show_select_doc_btn'] in ["true", "True"] else dbc.Row([
                    dbc.Col(generate_button, className="text-center"),
                ], style=dict(display="none"))

footer = html.Footer(
    dbc.Row([
        dbc.Col(children=[dcc.Markdown(configs_dict['footer_text'])],className="p-3 pb-0")]),
    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
    className="bg-dark position-fixed bottom-0"
)

footer_imp_links = html.Div(children=[
    dbc.Button("View payload", id="payload-button-f", n_clicks=0, outline=True, class_name="carbon-link"),
    dbc.Button("View source document", id="view-doc-button-f", n_clicks=0, outline=True, class_name="carbon-link"),
], className="d-none")

vertical_layout = dbc.Row(
                    [
                        dbc.Col(className="col-2"),
                        dbc.Col(
                            children=[
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                html.Span(["Click ", html.Img(src="/assets/settings.svg", height="16px", width="16px")," to view the source document, then ask a contextual question in the above field."], style={"color": "#525252", "font-size": "12px", "padding-left": "1rem"}),
                                buttonsPanel,
                                html.Br(),
                                html.Hr(),
                                html.Div([
                                        html.H5(configs.get('Output_title')),
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output')
                                    ],
                                    style={'padding': '1rem 1rem'}
                                ),
                                # html.Hr(),
                                footer_imp_links
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
                                        html.H5(configs.get('Output_title')),
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
                    input_data_list,
                    html.Div(children=[payload_modal, view_doc_modal]),
                    html.Br(),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

# construct input for Q&A call
def construct_input(text,file_content):
    #return f"{configs_dict['rag_prompt']}\n{text}\n\n{file_content}"
    return f"{configs_dict['rag_prompt']}\n{text}\n\n{file_content}\n\n"

# Fetch payloads for viewing
def get_payloads(text, doc_name):
    payloads_output = []
    labels = ["Q&A"]
    payloads = ["q_and_a-payload"]
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        file_content = open('documents/{}'.format(doc_name), 'r')
        payload_f_json['data']['input'] = f"{text}\n\n{file_content.read()}\n\n"
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

# Q&A API call
def q_and_a_fn(text, file_content, access_token):
    q_and_a_payload_json['project_id'] = WATSONX_PROJECT_ID
    q_and_a_payload_json['input'] = construct_input(text,file_content)

    print("calling LLM-Q&A", datetime.now())
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(q_and_a_payload_json))
    response_llm_json = response_llm.json()

    try:
        return response_llm_json['results'][0]['generated_text']
    except Exception as e:
        print("{} Error from LLM-Q&A -->".format(datetime.now()),response_llm_json)
        return "Error occured. Status code: {}. Please try again.".format(response_llm_json['status_code'])

# open right-panel
@app.callback(
    Output("right-panel", "is_open"),
    Input("open-right-panel", "n_clicks"),
    [State("right-panel", "is_open")],
)
def toggle_right_side_panel(n1, is_open):
    if n1:
        return not is_open
    return is_open

# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    # Input('generate-button', 'n_clicks'),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    State('right-panel-radio', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, submit, text, doc_name):
    allowed_inputs = [sample_from_file, configs_dict['sample_text']] + suggestions_list
    if(eval(configs_dict['app_locked']) and text not in allowed_inputs):
        time.sleep(0.5)
        return dbc.Alert("Input tampered: Please try with the sample input only", color="danger")

    authenticator = IAMAuthenticator(API_KEY)
    access_token = authenticator.token_manager.get_token()

    file_content = open('documents/{}'.format(doc_name), 'r')
    time.sleep(1)
    return html.Div([q_and_a_fn(text, file_content.read(), access_token)], className="output-div")

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    # Input('generate-button', 'n_clicks'),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, submit, text):
    return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks"), Input("payload-button-f", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'), State('right-panel-radio', 'value')],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, n2, is_open, text, doc_name):
    if n1 or n2:
        op=[]
        if(not is_open):
            op=get_payloads(text, doc_name)
        return not is_open,op
    return is_open, []

# Open/Close view document modal
@app.callback(
    Output("view-doc-modal", "is_open"),
    Output("view-doc-modal-content", "children"),
    [Input("view-doc-button", "n_clicks"), Input("view-doc-button-f", "n_clicks"),],
    [State("view-doc-modal", "is_open"), State('right-panel-radio', 'value')],
    prevent_initial_call=True
)
def toggle_viewdoc_modal(n1, n2, is_open, doc_name):
    if n1 or n2:
        if(not is_open):
            file_content = open('documents/{}'.format(doc_name), 'r')
        return not is_open,file_content.readlines()
    return is_open, []

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
