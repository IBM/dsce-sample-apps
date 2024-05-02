import os, time
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc, ALL, ctx
import requests
import json
import base64
import io
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
from flask import request
import mysql.connector
from mysql.connector import Error
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


# For WA
WAINTEGRATIONID = os.getenv("WAINTEGRATIONID")
WAREGION = os.getenv("WAREGION")
WASERVICEINSTANCEID = os.getenv("WASERVICEINSTANCEID")

# For MySQL Connection
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Read Sample text from file
sample_jobreq1 = ""
with open('jobreq1.txt', 'r') as sample_text_f:
    sample_jobreq1 = sample_text_f.read()

sample_jobreq2 = ""
with open('jobreq2.txt', 'r') as sample_text_f:
    sample_jobreq2 = sample_text_f.read()

with open('payload/jobreq-payload-example.txt') as jobreq_f:
    jobreq_example=jobreq_f.read()


# Data file
data_f_json = []
with open('data.json') as data_f:
    data_f_json = json.load(data_f)

resume_store = dict(resumes=data_f_json)

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
server = app.server
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
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
                     value="",
                     disabled=True,
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     class_name="carbon-input"
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn"
)

sample_pdf_1 = dbc.Button(
    "Use sample input 1", id="sample-1-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

sample_pdf_2 = dbc.Button(
    "Use sample input 2", id="sample-2-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
    ],
    max_size=50000,
    accept=".pdf",
    disabled=False
)

buttonsPanel = dbc.Row([
                dbc.Col(sample_pdf_1),
                dbc.Col(sample_pdf_2),
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    dbc.Col(sample_pdf_1),dbc.Col(sample_pdf_2),dbc.Col(generate_button),
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
                                html.Br(),
                                html.Hr(),
                                html.Div([
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

pdfLGI = []
for index, p in enumerate(data_f_json):
    pdfLGI.append(
            dbc.ListGroupItem(
                [
                    html.H6(p['name'], className="card-title"),
                ], 
                id={"type": "resume", "index": index},
                n_clicks=0, action=True,
                color="secondary",
                class_name="d-flex align-items-center",
                style={'height': '2.5rem'}
            )
        )

horizontal_layout = dbc.Row(
                    [
                        
                        dbc.Col(
                            children=[
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttonsPanel,
                                dcc.Download(id="sample-contract"),
                                html.Br(),
                                html.Br(),
                            ],
                            className="col-6 border-end",
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


resume_search = dbc.Row(
                    [
                        dbc.Col(children=[
                                html.Div(
                                    html.H5("Resumes"),
                                        style={'border': 'none', 'backgroundColor': '#e0e0e0', 'fontSize': '0.875rem', 'fontWeight': '600', 'padding': '1rem 1rem 1.5rem 1rem'},
                                    ),
                                html.Div(dbc.ListGroup(pdfLGI, flush=True), style={'overflow': 'scroll', 'maxHeight': '76vh'})
                            ],
                            className="col-2 pt-4"
                        ),
                        dbc.Col(
                            children=[
                                html.Div(id="embed-div"),
                            ],
                            className="col-5 border-end",
                            style={'padding': '1rem'}
                        ),
                        dbc.Col(
                            children=[
                                html.Div([
                                        html.Div(children=[html.P(configs_dict["helper_text"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"})],id='generate-output-resumesearch')
                                    ],
                                    style={'padding': '1rem 3rem'}
                                ),
                            ],
                            className="col-5"
                        ),
                    ],
                    className="px-3 pb-5"
                )

hidden_elements = html.Div([
    dbc.Input(id="wa-integration-id", type="hidden", disabled=True, value=WAINTEGRATIONID),
    dbc.Input(id="wa-region", type="hidden", disabled=True, value=WAREGION),
    dbc.Input(id="wa-service-instance-id", type="hidden", disabled=True, value=WASERVICEINSTANCEID),
], className='d-none')

home_tabs = dbc.Tabs(children=[
    dbc.Tab(horizontal_layout, label="Job requisition", tab_id="job-req-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'}),
    dbc.Tab(resume_search, label="Resume search", tab_id="resume-search-tab", label_style={'borderRadius': 0}, style={'backgroundColor':'white'})
], id="homepage-tabs", active_tab="job-req-tab")

app.layout = html.Div(children=[
                    dcc.Store(id="resume-store", data=resume_store),
                    navbar_main,
                    hidden_elements,
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

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# LLM API call
def llm_fn(text, payload_json, type, access_token, label):
    text = text or ""
    payload_json['project_id'] = WATSONX_PROJECT_ID
    if(label=="Job description"):
        payload_json['input'] = jobreq_example + text + "\nOutput:\n"
    else:
        payload_json['input'] = payload_json['input']+text+"\n\nOutput:\n"
    print("calling LLM",datetime.now())
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
    @app.callback(Output('sample-instruction', 'value'),
                Input('upload-data', 'contents'),
                State('upload-data', 'filename'),
                State('upload-data', 'last_modified'),
                prevent_initial_call=True)
    def uploadData(list_of_contents, list_of_names, list_of_dates):
        if list_of_contents is not None:
            return parse_contents(list_of_contents, list_of_names, list_of_dates)


# LLM Call
@app.callback(
    Output('generate-output', 'children'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text):
    if(n>0):
        if(text.strip()==""):
            time.sleep(0.5)
            return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger")

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
                    output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type, access_token, label)], className="output-div"))
            except:
                print(action, "Error")
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

# For loading actual output in resumesearch tab
@app.callback(
    Output('generate-output-resumesearch', 'children', allow_duplicate=True),
    Input({"type": "resume", "index": ALL}, "n_clicks"),
    State("resume-store", "data"),
    prevent_initial_call='initial_duplicate'
)
def generate_output_llm(n, data):
    try:
        selectedindex = ctx.triggered_id.index
    except:
        selectedindex = 0

    resume = data['resumes'][selectedindex]

    time.sleep(2)
    output = []
    with open('data/{}-ext.txt'.format(resume['id'])) as resume_ext_txt_f:
        resume_ext_txt= resume_ext_txt_f.read()
    resume_ext_txt = resume_ext_txt.replace("RESUME_END", "")

    with open('data/{}-sum.txt'.format(resume['id'])) as resume_sum_txt_f:
        resume_sum_txt=resume_sum_txt_f.read()
    output.append(html.Div([html.H5("Summary"), parse_output(res=resume_sum_txt, type="text")], className="output-div"))
    
    parseoutput = []
    pairs = resume_ext_txt.split('\n')
    for pair in pairs:
        if(pair.strip()!="" and ":" in pair):
            k, v = pair.split(':')
            parseoutput.append(html.Div([html.B(k), f': {v}'], className="key-value-div"))
        else:
            parseoutput.append(html.Br())
    
    output.append(html.Div([html.H5("Extraction"), html.Div(parseoutput, className="key-value-div-parent")], className="output-div"))

    return output

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
        return sample_jobreq1 if len(sample_jobreq1)>0 else configs_dict['sample_text']

# populate sample text 2 in text box
@app.callback(
    Output("user-input", "value", allow_duplicate=True),
    Input("sample-2-text-button", "n_clicks"),
    prevent_initial_call=True
)
def populate_sample_jobreq2(n_clicks):
    if(n_clicks>0):
        return sample_jobreq2 if len(sample_jobreq2)>0 else configs_dict['sample_text']


# User selects a resume from list
@app.callback(
    [
     Output("resume-store", "data"),
     Output({"type": "resume", "index": ALL}, "active"),
     Output("embed-div", "children"),
     Output("generate-output-resumesearch", "children")
     ],
    Input({"type": "resume", "index": ALL}, "n_clicks"),
    State("resume-store", "data")
)
def display_output(n_clicks, data):
    try:
        selectedindex = ctx.triggered_id.index
    except:
        selectedindex = 0

    active = []
    for i, d in enumerate(data['resumes']):
        active.append(i == selectedindex)

    data['selected_index'] = selectedindex
    resume = data['resumes'][selectedindex]
    embedhtml = html.Embed(src="{}.pdf".format(resume["path"]), id='embed-viewer', type='application/pdf', height="650", width="100%")
    htmlhyperlink = html.A("View generated HTML", href="{}.html".format(resume["path"]), target="_blank")

    return data, active, [htmlhyperlink, embedhtml], [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Get database connection
def getDBConnection():
    try:
        print('getting db connection')
        cnx = mysql.connector.connect(pool_size=10, user=DB_USER, password=base64.b64decode(DB_PASS).decode("utf-8"), database=DB_NAME,
            host=DB_HOST, port=DB_PORT)
        print('db connection successful.')
        return cnx
    except mysql.connector.Error as err:
        print(err)
        cnx.close()

def executeSQLQuery(query):
    stopwords = [ "create", "drop", "alter", "truncate", "comment", "rename", "insert", "update", "delete", "lock",
        "call", "explain plan", "grant", "revoke", "commit", "rollback", "savepoint", "function", "procedure", "trigger"
    ]
    for stopword in stopwords:
        query = query.replace(stopword, "")
    query = query.replace(";", "")
    print('query to execute:', query)
    cnx = getDBConnection()
    try:
        cursor = cnx.cursor(dictionary=True)
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        cnx.close()
        return rows
    except mysql.connector.Error as err:
        print("Error while executing query. Error:", err)
        return "Unable to get answer, please retry with another query."
            

# Load qna payload & prompt
with open('payload/qna-payload.json') as qna_payload_f:
    qna_payload_json = json.load(qna_payload_f)
with open('payload/qna-payload-example.txt') as qna_payload_exm_f:
    qna_payload_exm_txt = qna_payload_exm_f.read()

@server.route('/gensql', methods=['POST'])
def gen_sql():
    print("question body--> ", request.json)
    question = request.json['question']

    # LLM Call
    authenticator = IAMAuthenticator(API_KEY)
    access_token = authenticator.token_manager.get_token()    
    qna_payload_json['input'] = qna_payload_exm_txt
    llm_result = llm_fn(question, qna_payload_json, 'raw', access_token, 'qna')
    print("llm_result: ", llm_result)

    # Execute query
    query_result = executeSQLQuery(llm_result)

    htmltable = ""
    if (type(query_result) == list and len(query_result) > 0):
        htmltable = "<table>"
        headers = query_result[0].keys()
        htmlheadtr = "<tr>"
        for heading in headers:
            htmlheadtr += "<td style='border: 1px solid black; padding:0.3rem; text-align: center;'><strong>{}</strong></td>".format(heading)
        htmlheadtr += "</tr>"

        htmltable += "{}".format(htmlheadtr)

        for row in query_result:
            v = row.values()
            htmltr = "<tr>"
            for i in v:
                htmltd = "<td style='border: 1px solid black; padding:0.3rem; text-align: center;'>{}</td>".format(i)
                htmltr += htmltd
            htmltr += "</tr>"
            htmltable += htmltr
        htmltable += "</table><br/>"
    elif (type(llm_result) == str and len(query_result) > 0):
        htmltable = query_result
    else:
        htmltable = "No results found"

    print("gensql completed")
    return dict(type="custom element", data=htmltable, sql=llm_result)

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8000")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
