from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import os, dash, requests, json, base64, io, time
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc, ctx, ALL
import pandas as pd
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
from sql_formatter.core import format_sql
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
API_KEY = os.getenv("WATSONX_API_KEY")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

suggestions_list = ["what is the Total fd investment for gold customers with more than 1000 loyalty points and who live in New York", 
                    "what is the Total investment amount group by type of investment for gold customers who live in New York who have at least 10000 in their savings account",
                    "find first and last names with customer id of all customer who have a basic debit card and have savings account balance more than 100000 and have a gold credit card",
                    "prepare a list of first name, last name and address of all customers that have savings bank balance more than 10000 and FD of at least 100000 and no credit card defaults on their supreme card and they do not have other credit card types"
                ]
suggestions_options = []
for input_suggestion in suggestions_list:
    suggestions_options.append(html.Option(input_suggestion))


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

main_counter = 0

with open('payload/codegen-payload.json') as payload_f:
    payload=json.load(payload_f)
    sample_instruction = payload["input"]

with open('payload/codegen-payload-example.txt') as payload_f:
        all_examples=payload_f.read()

inmemory_example = all_examples
given_example = all_examples
actual_instruction = sample_instruction

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("Edit instruction/example", id="example-button", n_clicks=0, class_name="dmi-class")
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

example_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Edit instruction and examples")),
        dbc.ModalBody([
            dbc.Tabs(id="example-modal-tb", active_tab="example-tab-0")
        ]),
    ],
    id="example-modal",
    fullscreen=True,
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

sample_text_button = dbc.Button(
                                "Sample instruction", id="sample-text-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
        )


buttonsPanel = dbc.Row([
                dbc.Col(generate_button),
            ], style=dict(display="none")) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    dbc.Col(generate_button, style={"textAlign": "-webkit-center"}),
                ], style=dict(display="none"))

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
                                html.Span(["Click ", html.Img(src="/assets/settings.svg", height="16px", width="16px"),"  to edit the default instructions and examples."], style={"color": "#525252", "font-size": "12px", "padding-left": "1rem"}),
                                buttonsPanel,
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
                    dcc.Store(id="counter", data=main_counter),
                    dcc.Store(id="examples", data=all_examples),
                    dcc.Store(id="inmemory", data=inmemory_example),
                    dcc.Store(id="inmemory-instruction", data=sample_instruction),
                    navbar_main,
                    input_data_list,
                    html.Div(payload_modal),
                    html.Div(example_modal),
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

# Fetch examples for viewing & editing
def get_payloads_example(counter, all_examples, instruction):
    example_payloads_output = []
    labels = ["Instruction", "Examples"]
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    payload_file = payloads[0]
    
    for label, n in zip(labels, range(len(labels))):
        examples = all_examples.split('Input:')[1:]
        children_of_table = []
        for i in range(len(examples)):
            counter+=1 # counter will be used to give id to remove button
            children_of_table.append(dbc.Row([
                                                dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(payload_file), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),
                                                dbc.Col(dbc.Textarea(value=str(examples[i].split('Output:')[0][1:-1]) if examples != [] else "", rows=4, class_name='carbon-input')),
                                                dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:] if examples != [] else "", rows=4, class_name='carbon-input'))
                                            ], style={'paddingTop':'10px'}))
        
        upload_button = dcc.Upload(id="upload-data", className="upload-data",
        children=[
            dbc.Button("Upload File", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
        ],
        max_size=50000,
        accept=".txt",
    )
        
        upload_file_note = dbc.Row(dbc.Col(
                            html.Div(
                                children=[html.I(className="bi bi-info-circle"),dcc.Markdown("Allowed file types: .txt & File size limit to upload: 50Kb", style={"color": "#525252", "fontSize": "0.8rem","fontWeight": 400,"letterSpacing": 0,"paddingLeft":"0.5rem", "paddingTop":"3px"})],
                            style={"display":"flex"}),
                    )
                )
        
        instrction_structure = dbc.Row([
                dbc.Col(children=[dbc.Row(dbc.Textarea(id='sample-instruction', value=instruction, rows=18, class_name='carbon-input', style={"margin":"1rem 4rem 0 0", "resize":"auto"})),
                                  dbc.Row(children=[dbc.Col(sample_text_button), dbc.Col(upload_button)], style={"width":"fit-content"}),
                                  dbc.Row(upload_file_note, style={"paddingTop": "1rem"})
                ])
            ],
            style={"margin":"0 0.5rem 0 1rem"}
            )

        if(label=="Instruction"):
            example_payloads_output.append(
            dbc.Tab([
                        html.Div(children=instrction_structure, id='instruction-tuning')
                    ],
                    tab_id=f'example-tab-{n}',
                    label=label, label_style={'borderRadius': 0},
                    style={'backgroundColor':'white'}
            ),

        )
        else:
            example_payloads_output.append(
            dbc.Tab([
                        dbc.Row([dbc.Col(html.Div("Input"),style={'backgroundColor':'#f4f4f4'}),dbc.Col(html.Div("Output"), style={'backgroundColor':'#f4f4f4', 'marginLeft':'1.6%'})], style={'margin':'0rem 0rem 1rem 8.4%', 'fontWeight':'bold', 'textAlign':'center'}),
                        html.Div(children=children_of_table, id='example-table-{}'.format(payload_file)
                                                ),
                        
                        html.Div(children=[
                                            dbc.Button('Add example', id='add-row-button-{}'.format(payload_file), n_clicks=0, className="carbon-btn" ,outline=True, color="primary"),
                                            dcc.Upload(id="upload-example-{}".format(payload_file), className="upload-data",
                                                                    children=[
                                                                        dbc.Button("Upload examples", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
                                                                    ], style={"display":"contents"},
                                                                    max_size=50000,
                                                                    accept=".txt"
                                                                ),
                                            dcc.Download(id="export-text"),
                                            dbc.Button("Export examples", id="btn-export-example-{}".format(payload_file), outline=True, n_clicks=0, className="carbon-btn", color="primary"),
                                            dbc.Button('Save examples', id='save-example-{}'.format(payload_file), n_clicks=0, className="carbon-btn", color="primary"),
                                            dbc.Button('Undo changes', id='undo-last-{}'.format(payload_file), outline=True, n_clicks=0, className="carbon-btn", color="primary"),
                                    ], 
                        style={'backgroundColor':'white', 'padding':'2rem 0 0 8.3%','display':'flex','flexDirection':'row','gap':'1rem'}),
                        dbc.Row(upload_file_note, style={"paddingLeft":"8.3%", "paddingTop": "1rem"}),
                        html.Div(children=[
                                            html.P("Help", style={"color": "#525252", "fontWeight": 400}),
                                            dcc.Markdown(configs_dict['add_example'], className="btn-info"),
                                            dcc.Markdown(configs_dict['upload_examples'], className="btn-info"),
                                            dcc.Markdown(configs_dict['export_examples'], className="btn-info"),
                                            dcc.Markdown(configs_dict['save_examples'], className="btn-info-save"),
                                            dcc.Markdown(configs_dict['undo_changes'], className="btn-info")
                                ], style={"padding":"3rem 0 0 9.3rem"})
                        
                    ],
                    tab_id=f'example-tab-{n}',
                    label=label, label_style={'borderRadius': 0},
                    style={'backgroundColor':'white'}
            ),

        )
   
    return example_payloads_output, counter


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

# LLM API call
def llm_fn(text, payload_json, type, instruction, examples, access_token):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['data']['input'] = text
    payload_json['input'] = '{}\n\n{}\n\nInput:\n{}\nOutput:\n'.format(instruction, examples, text)
    print("calling LLM-Summary")
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()
    try:
        return parse_output(response_llm_json['results'][0]['generated_text'], type)
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()), response_llm_json)
        return "Error occured. Status code: {}. Please try again.".format(response_llm_json['status_code'])


# Codegen API call - loop version
def codegen_fn(text, codegen_payload_json, type, instruction, examples, access_token):
    query = text.split('---')
    answer = ""
    for q in query:
        codegen_payload_json['project_id'] = WATSONX_PROJECT_ID
        codegen_payload_json['input'] = '{}\n\n{}\n\nInput:\n{}\nOutput:\n'.format(instruction, examples, q)
        print("calling LLM-Codegen")
        response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(codegen_payload_json))
        response_llm_json = response_llm.json()
        sql = response_llm_json['results'][0]['generated_text'].replace("Input:","")
        answer = answer + sql + "---\n"

    answer = "<pre>" + format_sql(answer) + "</pre>"    
    return parse_output(answer, type)

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
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    State("inmemory","data"),
    State("inmemory-instruction","data"),
    prevent_initial_call=True
)
def generate_output_llm(n, s, text, examples, instruction):
    if(n>0 or s>0):
        if(text.strip()==""):
            time.sleep(0.5)
            return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger")

        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')
        payloads = configs_dict['generate_btn_payload_files'].split(',')
        payload_file = payloads[0]
        types = configs_dict['generate_btn_output_type'].split(',')
        authenticator = IAMAuthenticator(API_KEY)
        access_token = authenticator.token_manager.get_token()

        for action, label, type in zip(actions, labels, types):
            try:
                with open('payload/{}.json'.format(payload_file)) as payload_f:
                    payload_f_json = json.load(payload_f)
                if(action == "llm"):
                    output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type, instruction, examples, access_token)], className="output-div"))
                elif(action == "codegen"):
                    output.append(html.Div([html.H5(label), codegen_fn(text, payload_f_json, type, instruction, examples, access_token)], className="output-div"))
            except Exception as e:
                print(action, e)
        return output
    return []

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    prevent_initial_call=True
)
def generate_output_llm_sp(n, s):
    if(n>0 or s>0):
        return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'),
     State('inmemory-instruction', 'data'), State("inmemory", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, instruction, examples):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, instruction, examples)
        return not is_open,op
    return is_open, []

# Open/Close example modal
@app.callback(
    Output("example-modal", "is_open"),
    Output("example-modal-tb", "children"),
    Output("counter", "data"),
    [Input("example-button", "n_clicks")],
    [State("example-modal", "is_open")],
    State('counter','data'),
    State("inmemory", "data"),
    State("inmemory-instruction", "data"),
    prevent_initial_call=True
)
def toggle_example_modal(n1, is_open, counter, examples, instruction):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads_example(counter, examples, instruction)
            return not is_open,op[0], op[1]
    return is_open, [], counter

# populate sample instruction
@app.callback(
        Output("sample-instruction", "value", allow_duplicate=True),
        Input("sample-text-button", "n_clicks"),
        prevent_initial_call=True
)
def populate_sample_text(n_clicks):
    if(n_clicks>0):
        return sample_instruction


# update data to inmemory store
@app.callback(
    Output('inmemory', 'data',allow_duplicate=True),
    Output('inmemory-instruction', 'data',allow_duplicate=True),
    Input('example-modal-tb', 'active_tab'),
    Input('example-modal', 'is_open'),
    State('example-table-codegen-payload', 'children'),
    State('sample-instruction', 'value'),
    State('example-modal-tb', 'active_tab'),
    State("inmemory", "data"),
    prevent_initial_call=True
)
def display_output_inmemory(active_tab, is_open, codegen_payload, instruction, current_tab,inmemory_examples):
    tabs = ['codegen-payload']
    file_name = [codegen_payload]

    for rows,tab in zip(file_name, tabs):
        example=""
        # add updated input & output 
        for i in range(len(rows)):
            example = "{}Input:\n{}".format(example,rows[i]['props']['children'][1]['props']['children']['props']['value'])
            example = "{}\nOutput:\n{}\n\n\n".format(example,rows[i]['props']['children'][2]['props']['children']['props']['value'].strip())
        inmemory_examples = example
    return inmemory_examples, instruction



payloads = configs_dict['generate_btn_payload_files'].split(',')


for payloadFile in payloads:
    # add rows
    @app.callback(
        Output('example-table-{}'.format(payloadFile), 'children', allow_duplicate=True),
        Output('counter','data', allow_duplicate=True),
        Input('add-row-button-{}'.format(payloadFile), 'n_clicks'),
        State('example-table-{}'.format(payloadFile), 'children'),
        State('counter','data'),
        prevent_initial_call=True)
    def add_row(n_clicks, child, counter):
        if n_clicks > 0:
            counter=counter+1
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[3:]))
            child.append(dbc.Row([dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(file_name), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),dbc.Col(dbc.Textarea(value="", rows=4, class_name='carbon-input')), dbc.Col(dbc.Textarea(value="", rows=4, class_name='carbon-input', style={'paddingTop':'10px'}))],style={'paddingTop':'10px'} ))
        return child, counter
    
    # remove rows
    @app.callback(Output('example-table-{}'.format(payloadFile), 'children', allow_duplicate=True),
                Input({'type':'delete-button-{}'.format(payloadFile), 'index':ALL}, 'n_clicks'),
                State('example-table-{}'.format(payloadFile), 'children'),
                prevent_initial_call=True)    
    def remove_row(n_clicks, child):
        if any(x != 0 for x in n_clicks):
            triggered_button_index = ctx.triggered_id.index
            cnt=0
            for i in child:
                btn_index = i['props']['children'][0]['props']['children']['props']['id']['index'] 
                if(btn_index==triggered_button_index):
                    break
                cnt+=1
            if(n_clicks[cnt]>0):
                try:
                    del child[cnt]
                except Exception as e:
                    print("Exception : ",e)
            return child
        return child
    
    # update data in store
    @app.callback(
        Output('examples', 'data',allow_duplicate=True),
        Output('inmemory', 'data',allow_duplicate=True),
        Input('save-example-{}'.format(payloadFile),'n_clicks'),
        State('example-table-{}'.format(payloadFile), 'children'),
        State("examples", "data"),
        State("inmemory", "data"),
        State("example-modal", "is_open"),
        prevent_initial_call=True)
    def display_output(n_clicks, rows, all_examples, inmemory, is_open):

        if(n_clicks>0):
            # getting file name from id
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[2:]))
            example=[]
            # add updated input & output 
            for i in range(len(rows)):
                example = "{}Input:\n{}".format(example,rows[i]['props']['children'][1]['props']['children']['props']['value'])
                example = "{}\nOutput:\n{}\n\n\n".format(example,rows[i]['props']['children'][2]['props']['children']['props']['value'].strip())
        
            all_examples = example
            inmemory = example
            return all_examples, inmemory
        return all_examples, inmemory

    # restore the examples
    @app.callback(
        Output('example-table-{}'.format(payloadFile), 'children', allow_duplicate=True),    
        Output('inmemory', 'data',allow_duplicate=True),
        Output('counter', 'data', allow_duplicate=True),
        Input('undo-last-{}'.format(payloadFile),'n_clicks'),
        State("examples", "data"),
        State('inmemory', 'data'),
        State('counter', 'data'),
        State('example-table-{}'.format(payloadFile), 'children'),
        prevent_initial_call=True)
    def display_output_inmemory(n_clicks, all_examples, inmemory_examples, counter, child):

        if(n_clicks>0):
            # getting file name from id
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[2:]))
            examples = all_examples
            examples = examples.split('Input:')[1:]
            new_child=[]
            for i in range(len(examples)):
                counter=counter+1
                new_child.append(dbc.Row([dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(file_name), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[0][1:-1], rows=4, class_name='carbon-input')), dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:], rows=4, class_name='carbon-input'))], style={'paddingTop':'10px'}))
            inmemory_examples = all_examples
            return new_child, inmemory_examples, counter
        return child, inmemory_examples, counter

    # For Upload Examples
    @app.callback(
                Output('example-table-{}'.format(payloadFile), 'children', allow_duplicate=True),
                Output('counter','data', allow_duplicate=True),
                Input('upload-example-{}'.format(payloadFile), 'contents'),
                State('upload-example-{}'.format(payloadFile), 'filename'),
                State('upload-example-{}'.format(payloadFile), 'last_modified'),
                State('example-table-{}'.format(payloadFile), 'children'),
                State('counter','data'),
                prevent_initial_call=True)
    def uploadExampleData(list_of_contents, list_of_names, list_of_dates, child, counter):
        if list_of_contents is not None:
            content = parse_contents(list_of_contents, list_of_names, list_of_dates)
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[2:]))

            examples = content.split('Input:')[1:]
            for i in range(len(examples)):
                counter=counter+1
                child.append(dbc.Row([dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(file_name), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[0][1:-1], rows=4, class_name='carbon-input')), dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:], rows=4, class_name='carbon-input'))], style={'paddingTop':'10px'}))
        return child, counter

    # Downlaod examples
    @app.callback(  Output("export-text", "data", allow_duplicate=True),
                Input("btn-export-example-{}".format(payloadFile), "n_clicks"),
                State('example-table-{}'.format(payloadFile), 'children'),
                prevent_initial_call=True,
    )
    def export_examples(n_clicks, rows):
        if n_clicks>0:
            # getting file name from id
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[2:]))
            example=""
            if(len(rows)==0):
                example="Input:\n<your input>\nOutput:\n<your output>\n\nInput:\n<your input>\nOutput:\n<your output>"
            else:
                # add updated input & output 
                for i in range(len(rows)):
                    example = "{}Input:\n{}".format(example,rows[i]['props']['children'][1]['props']['children']['props']['value'] if rows[i]['props']['children'][1]['props']['children']['props']['value']!="" else None)
                    example = "{}\nOutput:\n{}\n\n".format(example,rows[i]['props']['children'][2]['props']['children']['props']['value'] if rows[i]['props']['children'][2]['props']['children']['props']['value']!="" else None)
        
            return dict(content=example, filename="{}-example.txt".format(file_name))



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
