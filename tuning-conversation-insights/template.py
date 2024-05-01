from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import os
import dash
import dash_bootstrap_components as dbc
from dash import Dash, dash_table, Input, Output, State, html, dcc, callback, ctx, ALL
import pandas as pd
import requests
import json
import base64
import io, time
from jproperties import Properties
from markdownify import markdownify as md
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

# ---- UI code ----

main_counter = 0

# read all the payload files
payloads = configs_dict['generate_btn_payload_files'].split(',')
payload_dict = dict()
for i in payloads:
    with open('payload/{}.json'.format(i)) as payload_f:
        payload_f_json = json.load(payload_f)
    payload_dict[i]=payload_f_json

examples_dict = dict()
for i in payloads:
    with open('payload/{}-example.txt'.format(i)) as payload_f:
        examples_dict[i]=payload_f.read()

inmemory_example = examples_dict.copy()

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'],suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(configs_dict['navbartitle'],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("Edit example", id="example-button", n_clicks=0, class_name="dmi-class"),
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
        dbc.ModalHeader(dbc.ModalTitle("Edit examples")),
        dbc.ModalBody([
            dbc.Tabs(id="example-modal-tb", active_tab="example-tab-0")
        ]),
    ],
    id="example-modal",
    fullscreen=True,
    scrollable=True,
    is_open=False,
)

user_input = dbc.InputGroup([
        dbc.Textarea(id="user-input", 
                     value=configs_dict['sample_text'],
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     className="carbon-input"
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", color="primary", n_clicks=0, className="carbon-btn",style={"overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"}
)

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", outline=True, color="primary", n_clicks=0, className="carbon-btn", style={"overflow": "hidden","whiteSpace": "nowrap","display": "block","textOverflow": "ellipsis"}),
    ]
)

buttonsPanel = dbc.Row([
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    dbc.Col(generate_button, className="text-center"),
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
                    className="px-3 pb-5 me-0"
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
                    className="px-3 pb-5 me-0"
                )

app.layout = html.Div(children=[
                    dcc.Store(id="counter", data=main_counter),
                    dcc.Store(id="payloads", data=payload_dict),
                    dcc.Store(id="examples", data=examples_dict),
                    dcc.Store(id="inmemory", data=inmemory_example),
                    navbar_main,
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
def get_payloads(text, all_payloads, all_examples):
    payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        with open('payload/{}-view.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)

        examples = all_examples[payload_file]
        examples = examples.split('Input:')[1:]

        for i in range(len(examples)):
            payload_f_json['data']['examples'].append({"input": str(examples[i].split('Output:')[0][1:-1]) if examples != [] else "", "output": examples[i].split('Output:')[1][1:] if examples != [] else ""})
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

# Fetch examples for viewing & editing
def get_payloads_example(counter, all_examples):
    example_payloads_output = []
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    
    for label, payload_file, n in zip(labels, payloads, range(len(payloads))):
        examples = all_examples[payload_file]
        examples = examples.split('Input:')[1:]   
        children_of_table = []
        for i in range(len(examples)):
            counter+=1 # counter will be used to give id to remove button
            children_of_table.append(dbc.Row([
                                                dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(payload_file), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),
                                                dbc.Col(dbc.Textarea(value=str(examples[i].split('Output:')[0][1:-1]) if examples != [] else "", rows=4, class_name='carbon-input')),
                                                dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:] if examples != [] else "", rows=4, class_name='carbon-input'))
                                            ], style={'paddingTop':'10px'}))

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
                                                                    ], style={"display":"contents"}
                                                                ),
                                            dcc.Download(id="export-text"),
                                            dbc.Button("Export examples", id="btn-export-example-{}".format(payload_file), outline=True, n_clicks=0, className="carbon-btn", color="primary"),
                                            dbc.Button('Save examples', id='save-example-{}'.format(payload_file), n_clicks=0, className="carbon-btn", color="primary"),
                                            dbc.Button('Undo changes', id='undo-last-{}'.format(payload_file), outline=True, n_clicks=0, className="carbon-btn", color="primary")
                                    ], 
                        style={'backgroundColor':'white', 'padding':'2rem 0 0 9.3rem','display':'flex','flexDirection':'row','gap':'1rem'}),

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


# Parsing output as per type
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
                if(pair.strip()!="" and len(pair.split(":"))>1):
                    k, v = pair.split(':')
                    parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
        except:
            return res[1:]
        return html.Div(parseoutput, className="key-value-div-parent")
    elif(type == 'markdown'):
        return dcc.Markdown(md(res))

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# LLM API call
def llm_fn(text, payload_json, type, examples, access_token):
    payload_json['project_id'] = WATSONX_PROJECT_ID
    payload_json['input'] = '{}{}\n\nInput:\n{}\nOutput:\n'.format(payload_json['input'], examples, text)
    print("calling LLM")
    response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_json))
    response_llm_json = response_llm.json()
    try:
        return parse_output(response_llm_json['results'][0]['generated_text'], type)
    except Exception as e:
        return json.dumps(response_llm_json)

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
    @app.callback(Output('user-input', 'value',allow_duplicate=True),
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
    State("payloads", "data"),
    State("inmemory","data"),
    prevent_initial_call=True
)
def generate_output_llm(n, text, all_payloads, all_examples):
    output = []
    actions = configs_dict['generate_btn_actions'].split(',')
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    types = configs_dict['generate_btn_output_types'].split(',')
    authenticator = IAMAuthenticator(API_KEY)
    access_token = authenticator.token_manager.get_token()
    for action, label, payload_file, type in zip(actions, labels, payloads, types):
        # with open('payload/{}.json'.format(payload_file)) as payload_f:
        #     payload_f_json = json.load(payload_f)
        payload_f_json = all_payloads[payload_file]
        examples = all_examples[payload_file]
        if(action == "llm"):
            output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type, examples, access_token)], className="output-div"))
        # elif(action == "custom"):
        #     output.append(html.Div([html.H5(label), custom_api_fn(text, payload_f_json, type)], className="output-div"))
        time.sleep(1)
    return output

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text):
    return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# Open/Close payload modal
@app.callback(
    Output("payload-modal", "is_open"),
    Output("payload-modal-tb", "children"),
    [Input("payload-button", "n_clicks")],
    [State("payload-modal", "is_open"), State('user-input', 'value'),
     State("payloads", "data"), State("inmemory", "data")],
    prevent_initial_call=True
)
def toggle_payload_modal(n1, is_open, text, payloads, examples):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads(text, payloads, examples)
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
    prevent_initial_call=True
)
def toggle_example_modal(n1, is_open, counter, examples):
    if n1:
        op=[]
        if(not is_open):
            op=get_payloads_example(counter, examples)
        return not is_open,op[0], op[1]
    return is_open, [], counter


payloads = configs_dict['generate_btn_payload_files'].split(',')


# update data to inmemory store
@callback(
    Output('inmemory', 'data',allow_duplicate=True),
    Input('example-modal-tb', 'active_tab'),
    Input('example-modal', 'is_open'),
    State('example-table-summary-payload', 'children'),
    State('example-table-sentiment-payload', 'children'),
    State('example-table-entity-payload', 'children'),
    State('example-modal-tb', 'active_tab'),
    State("inmemory", "data"),
    prevent_initial_call=True
)
def display_output_inmemory(active_tab, is_open, summary_payload,sentiment_payload,entity_payload,current_tab,inmemory_examples):
    tabs = ['summary-payload','sentiment-payload','entity-payload']
    file_name = [summary_payload,sentiment_payload,entity_payload]

    for rows,tab in zip(file_name, tabs):
        example=""
        # add updated input & output 
        for i in range(len(rows)):
            example = "{}Input:\n{}".format(example,rows[i]['props']['children'][1]['props']['children']['props']['value'])
            example = "{}\nOutput:\n{}\n\n\n".format(example,rows[i]['props']['children'][2]['props']['children']['props']['value'].strip())
        inmemory_examples[tab] = example
    return inmemory_examples


for payloadFile in payloads:
    # add rows
    @callback(
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
    @callback(Output('example-table-{}'.format(payloadFile), 'children', allow_duplicate=True),
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
    @callback(
        Output('payloads', 'data',allow_duplicate=True),
        Output('examples', 'data',allow_duplicate=True),
        Output('inmemory', 'data',allow_duplicate=True),
        Input('save-example-{}'.format(payloadFile),'n_clicks'),
        State('example-table-{}'.format(payloadFile), 'children'),
        State("payloads", "data"),
        State("examples", "data"),
        State("inmemory", "data"),
        State("example-modal", "is_open"),
        prevent_initial_call=True)
    def display_output(n_clicks, rows, all_payloads, all_examples, inmemory, is_open):

        if(n_clicks>0):
            # getting file name from id
            id = ctx.triggered_id.split('-')
            file_name = "-".join(i for i in (id[2:]))
            example=""  
            # add updated input & output 
            for i in range(len(rows)):
                example = "{}Input:\n{}".format(example,rows[i]['props']['children'][1]['props']['children']['props']['value'])
                example = "{}\nOutput:\n{}\n\n\n".format(example,rows[i]['props']['children'][2]['props']['children']['props']['value'].strip())
        
            all_examples[file_name] = example
            inmemory[file_name] = example
            return all_payloads, all_examples, inmemory
        return all_payloads, all_examples, inmemory

    # restore the examples
    @callback(
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
            examples = all_examples[file_name]
            examples = examples.split('Input:')[1:]
            new_child=[]
            for i in range(len(examples)):
                counter=counter+1
                new_child.append(dbc.Row([dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(file_name), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[0][1:-1], rows=4, class_name='carbon-input')), dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:], rows=4, class_name='carbon-input'))], style={'paddingTop':'10px'}))
            inmemory_examples[file_name] = all_examples[file_name]
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
            # json_content = json.loads(content)
            for i in range(len(examples)):
                counter=counter+1
                child.append(dbc.Row([dbc.Col(dbc.Button(color="danger",n_clicks=0, id={'type':"delete-button-{}".format(file_name), 'index':counter}, class_name='remove-btn', outline=True, children=html.I(className="bi bi-trash3")), width=1),dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[0][1:-1], rows=4, class_name='carbon-input')), dbc.Col(dbc.Textarea(value=examples[i].split('Output:')[1][1:], rows=4, class_name='carbon-input'))], style={'paddingTop':'10px'}))
        return child, counter

    # Downlaod examples
    @callback(  Output("export-text", "data", allow_duplicate=True),
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
