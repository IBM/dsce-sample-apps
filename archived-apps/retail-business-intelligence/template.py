from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import os, dash, pandas, requests, json, base64, io, time, random,re
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc, ctx, ALL
import pandas as pd
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
from sql_formatter.core import format_sql


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
API_KEY = os.getenv("WATSONX_API_KEY")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

PRESTO_SERVER = os.getenv("PRESTO_SERVER")
PRESTO_USER = os.getenv("PRESTO_USER")
PRESTO_AUTH = os.getenv("PRESTO_AUTH")
PRESTO_CATALOG = os.getenv("PRESTO_CATALOG") or ""
PRESTO_SCHEMA = os.getenv("PRESTO_SCHEMA") or ""

suggestions_list = ["Get the total revenue generated from each product above 500 in descending order of revenue", 
                    "List the name of customers who has bought items cost more than 200 with total amounts and customer id",
                    "Give me the list of products with sale more than 10 quantities"]
suggestions_options = []
for input_suggestion in suggestions_list:
    suggestions_options.append(html.Option(input_suggestion))


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

with open('payload/codegen-payload.json') as payload_f:
    payload=json.load(payload_f)
    sample_instruction = payload["input"]

with open('payload/codegen-payload-example.txt') as payload_f:
        all_examples=payload_f.read()

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("View schema", id="schema-button", n_clicks=0, class_name="dmi-class")
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


schema_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Schema diagram")),
        dbc.ModalBody([
            html.Img(src="assets/schema.png", style={"width": "-webkit-fill-available"})
        ]),
    ],
    id="schema-modal",
    size="xl",
    scrollable=True,
    is_open=False,
)

input_data_list = html.Datalist(suggestions_options, id="input-data-list")

user_input = dbc.InputGroup([
        dbc.Input(id="user-input",
                  value=configs_dict['sample_text'],
                  placeholder=configs_dict['input_placeholder_text'],
                  class_name="carbon-input",
                  list="input-data-list",
                  n_submit=0
                ),
            dbc.Button(id="search-button", class_name="search-btn", color="primary", outline=True, n_clicks=0, children=html.I(className="bi bi-search"))
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

buttonsPanel = dbc.Row([
                dbc.Col(generate_button),
            ], style=dict(display="none")) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    dbc.Col(generate_button, style={"textAlign": "-webkit-center"}),
                ], style=dict(display="none"))


all_logs = ["Prompting model to generate SQL for input question", "Generated SQL : ", "Data stores used for query: ", "Validating generated SQL", "Calling watsonx.data API with SQL statement using Presto query engine", "SQL statement execution started", "Received all the data chunks from watsonx.data", "Formatting the data to display result"]
displayed_logs = []
interval_list = [(1.5,2.5), (4,8), (1,2), (1,2), (1,2), (5,10), (1,2), (1,2)]
interval_number = 0
logs_pannel = html.Div(children=displayed_logs,id="logs-pannel")
llm_process_completed = False

collapse = html.Div(
    [
        dbc.Button(
            "Execution steps",
            id="collapse-button",
            className="carbon-btn",
            color="primary",
            outline=True,
            n_clicks=0
        ),
        html.Br(),
        dbc.Collapse(
            dbc.Card(dbc.CardBody(logs_pannel)),
            id="collapse",
            is_open=True,
        ),
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
                                html.H5(configs_dict['Input_title']),
                                html.Div(user_input),
                                buttonsPanel,
                                html.Br(),
                                html.Hr(),
                                html.Div([
                                        collapse,
                                        html.Br(),
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
                    dcc.Store(id="logs-store", data=displayed_logs),
                    dcc.Store(id="interval-number", data=interval_number),
                    dcc.Store(id="llm-process-completed", data=llm_process_completed),
                    dcc.Store(id="generated-sql", data=""),
                    dcc.Interval(
                            id='interval-component',
                            interval=2*1000,
                            n_intervals=0,
                            disabled=True
                        ),
                    navbar_main,
                    input_data_list,
                    html.Div(payload_modal),
                    html.Div(schema_modal),
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
def get_payloads(text, instruction, examples):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        
        examples = examples.split('Input:')[1:]
        for i in range(len(examples)):
            payload_f_json['data']['examples'].append({"input": str(examples[i].split('Output:')[0][1:-1]) if examples != [] else "", "output": examples[i].split('Output:')[1][1:] if examples != [] else ""})
        query = text.split('---')
        payload_f_json['data']['input'] = query[0]
        payload_f_json['data']['instruction'] = instruction
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
        return res
    if(type == 'label'):
        return dbc.Badge(res, color="#1192e8", style={'borderRadius': '12px','marginLeft':'8px','paddingLeft':'16px', 'paddingRight':'16px'})
    elif(type == 'key-value'):
        try:
            pairs = res.split(',')
            for pair in pairs:
                pair = pair.strip()
                if(pair!="" and ":" in pair and len(pair.split(":"))==2):
                    k, v = pair.split(':')
                    parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
        except:
            return res[1:]
        return html.Div(parseoutput, className="key-value-div-parent")
    elif(type == 'markdown'):
        return dcc.Markdown(md(html=res, code_language="sql"))


# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn


# Codegen API call - loop version
def codegen_fn(text, codegen_payload_json, type, instruction, examples, access_token):
    codegen_payload_json['project_id'] = WATSONX_PROJECT_ID
    codegen_payload_json['input'] = '{}\n\n{}\n\nInput:\n{}\nOutput:\n'.format(instruction, examples, text)
    print("calling LLM-Codegen")
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(codegen_payload_json))
    response_llm_json = response_llm.json()
    sql = response_llm_json['results'][0]['generated_text'].replace("Input:","")
    print("generated SQL: ", sql)
    return sql



# wx.data call to extract data from it
def wx_data_call(sql):
    auth_str = PRESTO_USER+":"+PRESTO_AUTH
    encoded_auth_str = base64.b64encode(auth_str.encode('utf-8'))
    auth_str = encoded_auth_str.decode('utf-8')
    headers = {
    "X-Presto-Catalog": PRESTO_CATALOG,
    "X-Presto-Schema": PRESTO_SCHEMA,
    "X-Presto-User": PRESTO_USER,
    "Authorization": f"Basic {auth_str}",
    "Content-Type": "text/plain; charset=utf-8"
    }

    print("SQL statement execution started")
    r = requests.post(PRESTO_SERVER, headers=headers, data=sql)
    results = r.json()
    column_names = []
    rows = []
    flg = 0
    err = None
    while True:
        stats = results.get('stats',None)
        try:
            state = stats['state']
            if(state in ["FINISHED"]):
                rows.extend(results.get('data', []))
                columns_dict = results.get('columns', [])
                column_names = [column.get('name') for column in columns_dict]
                break

            elif(state in ["FAILED"]):
                flg = 1
                err = results.get('error')
                break

            elif(state not in ["WAITING_FOR_PREREQUISITES", "QUEUED"]):
                rows.extend(results.get('data', []))

            headers = {"Authorization": f"Basic {auth_str}"}
            next_uri = results.get("nextUri")
            r = requests.get(next_uri, headers=headers)
            results = r.json()
            time.sleep(5)
       
        except Exception as e:
            print("Something went wrong: ", e)
            flg = 1
            break
    if(flg):
        return html.Pre("Error: "+str(err["message"]), style={"textWrap": "wrap"})
    output_table_list = []
    if(len(rows)!=0):
        for row in rows:
            output_table_list.append(
                            html.Tr([html.Td(data) for data in row]))
    
        table_body = [html.Tbody(output_table_list)]
        table_header = [html.Thead(html.Tr([html.Th(column) for column in column_names]))]
        table = dbc.Table(table_header + table_body, bordered=True)
    else:
        table = html.P("No data found")
    return html.Div([table], className="output-div")

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
    Output("generated-sql", "data"),
    Output("interval-component", "disabled", allow_duplicate=True),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    State('generate-output', 'children'),
    State("generated-sql", "data"),
    prevent_initial_call=True
)
def generate_output_llm(n, s, text, generated_output, generated_sql):
    if(n>0 or s>0):
        
        # Input is tampered
        if(text not in suggestions_list):
            if(text.strip()==""):
                time.sleep(0.5)
                return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger"), "", True
        
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        payload_file = payloads[0]
        types = configs_dict['generate_btn_output_type'].split(',')
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()

        for action, label, type in zip(actions, labels, types):
            with open('payload/{}.json'.format(payload_file)) as payload_f:
                payload_f_json = json.load(payload_f)
            generated_sql = codegen_fn(text, payload_f_json, type, sample_instruction, all_examples, access_token)   
            
            # if SQL is not generated
            if("select" not in generated_sql.strip().lower() or "from" not in generated_sql.strip().lower()):
                return generated_output, "Error while generating SQL", True
        
        return "", generated_sql, False
    return "", generated_sql, True


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
            op=get_payloads(text, sample_instruction, all_examples)
        return not is_open,op
    return is_open, []


# Open/Close schema modal
@app.callback(
    Output("schema-modal", "is_open"),
    [Input("schema-button", "n_clicks")],
    [State("schema-modal", "is_open")],
    prevent_initial_call=True
)
def toggle_schema_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open

# reset on new query
@app.callback(
    Output("logs-store", "data", allow_duplicate=True),
    Output("interval-number", "data", allow_duplicate=True),
    Output('interval-component', 'disabled'),
    Output('interval-component', 'interval', allow_duplicate=True),
    Output('generated-sql', 'data', allow_duplicate=True),
    Output("generate-output", "children", allow_duplicate=True),
    Output("collapse", "is_open", allow_duplicate=True),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    prevent_initial_call=True
)
def generate_output_llm_sp(n, s):
    if(n>0 or s>0):
        return [], 0, False, 1000, "", "", True


# Update logs based on intervals
@app.callback(
    Output('logs-store', 'data', allow_duplicate=True),
    Output('interval-component', 'disabled', allow_duplicate=True),
    Output('interval-component', 'interval', allow_duplicate=True),
    Output("interval-number", "data", allow_duplicate=True),
    Input('interval-component', 'n_intervals'),
    State("logs-store", "data"),
    State("interval-number", "data"),
    State("generated-sql", "data"),
    prevent_initial_call=True
)
def check_live_status(interval, displayed_logs, interval_number, generated_sql):
    if(interval_number>0):
        if(interval_number==2 and generated_sql!=""):
            displayed_logs[interval_number-1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[interval_number-1], dcc.Markdown(f'''~~~~sql 
{format_sql(generated_sql)}''')])
        
        elif(interval_number==3 and generated_sql!=""):
            statement = ""
            customer = r'\bpostgresql\.[^\s]+\.customer\b'
            product = r'\bpostgresql\.[^\s]+\.product\b'
            order_details = r'\bcos\.[^\s]+\.orderdetails\b'
            orders = r'\bcos\.[^\s]+\.orders\b'
            if(re.search(customer, generated_sql.lower())):
                statement = statement + "customer from postgresql"

            if(re.search(product, generated_sql.lower())):
                statement = statement + ", product from postgresql" if(statement!="") else "product from postgresql"

            if(re.search(order_details, generated_sql.lower())):
                statement = statement + ", orderdetails from cos" if(statement!="") else "orderdetails from cos"
            
            if(re.search(orders, generated_sql.lower())):
                statement = statement + ", orders from cos" if(statement!="") else "orders from cos"
            displayed_logs[interval_number-1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[interval_number-1], statement])
        else:
            displayed_logs[interval_number-1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[interval_number-1]])
    displayed_logs.append(html.Div([dbc.Spinner(color="primary", size="sm", spinner_style={"marginRight": "1rem"}), all_logs[interval_number]]))
    return displayed_logs, not len(displayed_logs)!=len(all_logs), random.uniform(interval_list[interval_number][0], interval_list[interval_number][1])*1000 ,interval_number+1


# Open/Close logs pannel
@app.callback(
    Output('logs-store', 'data', allow_duplicate=True),
    Output("collapse", "is_open"),
    Input("collapse-button", "n_clicks"),
    State("collapse", "is_open"),
    State("logs-pannel", "children"),
    prevent_initial_call=True
)
def toggle_collapse(n, is_open, displayed_logs):
    if n:
        return displayed_logs, not is_open
    return displayed_logs, is_open

# show updated logs
@app.callback(
    Output("logs-pannel", "children"),
    Input("logs-store", "data")
)
def update_logs(logs):
    return logs

# complete all logs after completion of query process
@app.callback(
    Output("logs-store", "data", allow_duplicate=True),
    Output("interval-component", "disabled", allow_duplicate=True),
    Input("llm-process-completed", "data"),
    State("logs-store", "data"),
    State("interval-component", "disabled"),
    State("generated-sql", "data"),
    prevent_initial_call=True
)
def update_logs(llm_process_completed, displayed_logs, interval_component, generated_sql):
    if(llm_process_completed=="Success"):
        displayed_logs[-1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), displayed_logs[-1]["props"]["children"][-1]])
        for i in range(len(displayed_logs), len(all_logs)):
            displayed_logs.append(html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[i]]))
        return displayed_logs, True
    else:
        # SQL not generated
        if(generated_sql==""):
            displayed_logs=[]
            for i in range(0,2):
                displayed_logs.append(html.Div([html.I(className="bi bi-x", style={"marginRight": "1rem"}), all_logs[i], f" {llm_process_completed}" if i==1 else ""]))
        else:
            # do not change if last log in SQL
            displayed_logs[-1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[len(displayed_logs)-1]]) if(len(displayed_logs)!=2) else displayed_logs[-1]
            
            # display statc logs
            for i in range(len(displayed_logs), 4):
                displayed_logs.append(html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[i]]))
            
            # put error at 4th index
            displayed_logs.append(html.Div([html.I(className="bi bi-x", style={"marginRight": "1rem"}), all_logs[4], f" {llm_process_completed}"]))
        return displayed_logs, True
            
        

# update sql in logs store
@app.callback(
    Output("logs-store", "data", allow_duplicate=True),
    Input("generated-sql", "data"),
    State("logs-store", "data"),
    prevent_initial_call=True
)
def display_sql(generated_sql, display_logs):
    if(generated_sql != ""):
        try:
            display_logs[1] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[1], dcc.Markdown(f'''~~~~sql 
{format_sql(generated_sql)}''') if("Error" not in generated_sql) else generated_sql])
    
            statement = ""
            customer = r'\bpostgresql\.[^\s]+\.customer\b'
            product = r'\bpostgresql\.[^\s]+\.product\b'
            order_details = r'\bcos\.[^\s]+\.orderdetails\b'
            orders = r'\bcos\.[^\s]+\.orders\b'
            if(re.search(customer, generated_sql.lower())):
                statement = statement + "customer from postgresql"

            if(re.search(product, generated_sql.lower())):
                statement = statement + ", product from postgresql" if(statement!="") else "product from postgresql"

            if(re.search(order_details, generated_sql.lower())):
                statement = statement + ", orderdetails from cos" if(statement!="") else "orderdetails from cos"
            
            if(re.search(orders, generated_sql.lower())):
                statement = statement + ", orders from cos" if(statement!="") else "orders from cos"
            display_logs[2] = html.Div([html.I(className="bi bi-check", style={"marginRight": "1rem"}), all_logs[2], statement])
        except Exception as e:
            print(e)
            pass
    return display_logs

# initiate watsonx.data call
@app.callback(
    Output("generate-output", "children", allow_duplicate=True),
    Output("llm-process-completed", "data", allow_duplicate=True),
    Output("collapse", "is_open", allow_duplicate=True),
    Input("generated-sql", "data"),
    State("generate-output", "children"),
    prevent_initial_call=True
)
def call_wx_data(generated_sql, generated_output):
    FLG=0
    op_table=""
    if("Error" not in generated_sql and generated_sql!=""):
        try:
            op_table = wx_data_call(generated_sql)
            if("Error: " in str(op_table)):
                print("In error: ", op_table)
                raise Exception("Error while fetching the data from watsonx.data")
        except Exception as e:
            print("In exception")
            FLG=1
            print(e)
            op_table = str(e)
            # op_table = "Error while fetching data from watsonx.data"
        return [html.Div([op_table], className="output-div")], "Success" if not FLG else " : Error while fetchig data from watsonx.data", False
    else:
        return generated_output, "Error while generating SQL", True
# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
