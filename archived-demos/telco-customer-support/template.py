import os, time, requests, json, base64, io, re
import dash
from dash import Input, Output, State, html, dcc
import dash_bootstrap_components as dbc
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
from rag import init, generate_answer

# instantiate config
configs = Properties()
# load properties into configs from app-config.properties
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
sample_from_file = ""
with open('sample_transcript.txt', 'r') as sample_text_f:
    sample_from_file = sample_text_f.read()



# init the rag module for chunking pdf data into vectors
init()

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(configs_dict['navbartitle'],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("View source document", id="source-doc-button", n_clicks=0, class_name="dmi-class")
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

source_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Source")),
        dbc.ModalBody([
            html.Div(id="source-modal-div")
        ]),
    ],
    id="source-modal",
    size="xl",
    scrollable=True,
    is_open=False,
)

user_input_transcript = dbc.InputGroup([
        dbc.Textarea(id="user-input",
                     value=sample_from_file,
                     disabled= True,
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input"
                     ),
    ],
    className="mb-3",
)

qna_user_input = dbc.InputGroup(
    [
        dbc.Select(
        id="qna-user-input",
        options=[
            {
                "label": "How can I visualize network traffic on a specific gateway ?",
                "value": "How can I visualize network traffic on a specific gateway ?"
            },
            {
                "label": "Give a detail set of steps to deploy a list of gateways automatically on AWS cloud.",
                "value": "Give a detail set of steps to deploy a list of gateways automatically on AWS cloud."
            },
            {
                "label": "How do I know when a new gateway version is available from IBM ? How do I apply the updates ?",
                "value": "How do I know when a new gateway version is available from IBM ? How do I apply the updates ?"
            },
            {
                "label": "Give the details of how a Hybrid Cloud Mesh discover automatically the cluster namespaces and applications.",
                "value": "Give the details of how a Hybrid Cloud Mesh discover automatically the cluster namespaces and applications."
            },
            {
                "label": "How can I enable Hybrid Cloud Mesh (Mesh) to enable connections between specific applications and services ?",
                "value": "How can I enable Hybrid Cloud Mesh (Mesh) to enable connections between specific applications and services ?"
            }
        ],
            placeholder="Select a question...", class_name="carbon-select"
        ),
        dbc.Button(id="qna-search-button", class_name="search-btn", color="primary", outline=True, n_clicks=0, children=html.I(className="bi bi-search"))
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn"
)

upload_file_note = dbc.Row(dbc.Col(
                            html.Div(
                                children=[html.I(className="bi bi-info-circle"),html.P("Allowed file types: .txt & File size limit to upload: 50Kb", style={"color": "#525252", "fontSize": "0.8rem","fontWeight": 400,"letterSpacing": 0,"paddingLeft":"0.5rem", "paddingTop":"3px"})],
                            style={"display":"flex"}),
                    )
                )

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
    ],
    max_size=50000,
    accept=".txt",
    disabled=False
)

buttonsPanel = dbc.Row([
                # dbc.Col(sample_text_button),
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    # dbc.Col(sample_text_button),
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
                                html.Div(user_input_transcript),
                                dcc.Download(id="source-document"),
                                buttonsPanel,
                                upload_file_note if configs_dict['show_upload'] in ["true", "True"] else None,
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
                        dbc.Col(
                            children=[
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input_transcript),
                                dcc.Download(id="source-document"),
                                buttonsPanel,
                                upload_file_note if configs_dict['show_upload'] in ["true", "True"] else None,
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
                                    style={'padding': '1rem'}
                                ),
                            ],
                            className="col-6"
                        ),
                    ],
                    className="px-3 pb-5"
                )

qna_laylout = dbc.Row(
                    [
                        dbc.Col(className="col-2"),
                        dbc.Col(
                            children=[
                                html.Br(),
                                html.H5(configs_dict['qna_input_title']),
                                html.Div(qna_user_input),
                                html.Br(),
                                html.Hr(),
                                html.Div([
                                        # html.H5(configs.get('Output_title')),
                                        html.Div(children=[html.P(configs_dict['qna_helper_text'], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='qna-generate-output')
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

home_tabs = dbc.Tabs(children=[
    dbc.Tab(horizontal_layout, label="Transcript summarization", tab_id="transcript-summarization-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'}),
    dbc.Tab(qna_laylout, label="Q&A", tab_id="q-and-a-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'})
], id="homepage-tabs", active_tab="transcript-summarization-tab")

app.layout = html.Div(children=[
                    navbar_main,
                    html.Div(payload_modal),
                    html.Div(source_modal),
                    home_tabs,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

# Fetch payloads for viewing - View payload
def get_payloads(text, question):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    labels.append("RAG")
    payloads.append("rag-payload")
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        payload_f_json['data']['input'] = text if label!="RAG" else question
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

def parse_output(res, type):
    parseoutput = []
    if(type == 'text'):
        return dcc.Markdown(res)
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
            res
    elif(type == 'markdown'):
        return dcc.Markdown(md(res))

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# Invoke LLM API
def llm_fn(text, payload_json, type, access_token):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['input'] = payload_json['input']+text+"\n\nOutput:\n"
    print("calling LLM", datetime.now())
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()

    try:
        return parse_output(response_llm_json['results'][0]['generated_text'], type)
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

# To format llm generated response
def format_answer(answer):
    splitted_answer = re.split(r'(\d+\.)', answer)
    splitted_answer = [item.strip() for item in splitted_answer if item.strip()]

    # Prepend each numbered item with \n
    for i in range(len(splitted_answer)):
        if(re.match(r'(\d+\.)', splitted_answer[i])):
            splitted_answer[i] = f"<br/>{splitted_answer[i]}"

    formatted_answer = "".join(splitted_answer)
    return formatted_answer

# LLM Call - on click of 'Get summary'
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text):
    if(n>0):        
        # Input is tampered
        if(text not in [sample_from_file]):
            if(text.strip()==""):
                time.sleep(0.5)
                return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger")
            
            time.sleep(0.5)
            return dbc.Alert(dcc.Markdown("Please use sample text only"), color="danger")
           
        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        types = configs_dict['generate_btn_output_type'].split(',')
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()
        
        for action, label, payload_file, type in zip(actions, labels, payloads, types):
            try:
                with open('payload/{}.json'.format(payload_file)) as payload_f:
                    payload_f_json = json.load(payload_f)

                if(action == "llm"):
                    output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type, access_token)], className="output-div"))
            except Exception as e:
                print(action, e)
                time.sleep(1)
        return output
    return []


# RAG call - on click of search icon
@app.callback(
    Output('qna-generate-output', 'children'),
    Output('source-modal-div', 'children'),
    Input('qna-search-button', 'n_clicks'),
    State('qna-user-input', 'value'),
    State('source-modal-div', 'children'),
    prevent_initial_call=True
)
def get_answer(nc, question, source_content):
    if(nc>0):
        if(question==None):
                time.sleep(0.5)
                return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger"), [source_content]
        resp = generate_answer(question)
        if(resp=="please call refresh api or restart server"):
            return html.Div(resp), [source_content]
        resp["answer"] = format_answer(resp['answer'])
        return [html.Div([html.H5("Answer"), dcc.Markdown(resp['answer'], dangerously_allow_html=True), dbc.Button("View source", id="view-source-link", n_clicks=0, class_name='btn-link')], className="output-div")], dcc.Markdown(resp['source_document'], dangerously_allow_html=True)

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    prevent_initial_call=True
)
def generate_output_llm(n):
    if(n>0):
        return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# For qna loading spinner
@app.callback(
    Output('qna-generate-output', 'children', allow_duplicate=True),
    Input('qna-search-button', 'n_clicks'),
    prevent_initial_call=True
)
def generate_output_llm(nc):
    if(nc>0):
        return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'), State('qna-user-input', 'value')],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, question):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, question)
        return not is_open,op
    return is_open, []

# Open/Close view source modal
@app.callback(
        Output('source-modal', 'is_open'),
        Input('view-source-link', 'n_clicks'),
        State('source-modal', 'is_open')
    )
def show_source_modal(n, is_open):
    if(n>0):
        return not is_open
    return is_open


# download sample contract file
@app.callback(
    Output("source-document", "data"),
    Input("source-doc-button", "n_clicks"),
    prevent_initial_call=True,
)
def download_file(n_clicks):
    return dcc.send_file("data/hybrid-cloud-mesh-documentation.pdf")

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="False"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
