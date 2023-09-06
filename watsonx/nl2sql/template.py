import os, io, requests, json, base64, dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
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
SERVER_URL = configs_dict['SERVER_URL']
API_KEY = os.getenv("BAM_API_KEY")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

suggestions_list = ["show item and supplier details for SKU 673456", 
                    "find women owned suppliers for green salad in 234511 with SER and SSI < 3",
                ]
suggestions_options = []
for input_suggestion in suggestions_list:
    suggestions_options.append(html.Option(input_suggestion))

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(configs_dict['navbartitle'],
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

input_data_list = html.Datalist(suggestions_options, id="input-data-list")

user_input = dbc.InputGroup([
        dbc.Input(id="user-input",
                  value=configs_dict['sample_text'],
                  placeholder=configs_dict['input_placeholder_text'],
                  class_name="carbon-input",
                  list="input-data-list"
                ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload from file", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
    ]
)

buttonsPanel = dbc.Row([
                dbc.Col(upload_button),
                dbc.Col(generate_button),
            ]) if configs_dict['show_upload'] in ["true", "True"] else dbc.Row([
                    dbc.Col(generate_button, style={"textAlign": "-webkit-center"}),
                ])

footer = html.Footer(
    dbc.Row([
        dbc.Col(configs_dict['footer_text'],className="p-3")]),
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
                                        html.Div(id='generate-output')
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
                                        html.Div(id='generate-output')
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
        with open('payload/{}.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)
        query = text.split('---')
        payload_f_json['inputs'] = [query[0]]
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
        pairs = res.split(',')
        for pair in pairs:
            k, v = pair.split(':')
            parseoutput.append(html.Div([html.B(k+':'), v], className="key-value-div"))
        return html.Div(parseoutput, className="key-value-div-parent")
    elif(type == 'markdown'):
        return dcc.Markdown(md(html=res, code_language="sql"))

# LLM API call
def llm_fn(text, payload_json, type):
    REQ_URL = SERVER_URL+'/v1/generate'
    payload_json['inputs'] = [text]
    print("calling LLM-Summary")
    response_llm = requests.post(REQ_URL, headers=HEADERS, data=json.dumps(payload_json))
    response_llm_json = response_llm.json()

    try:
        return parse_output(response_llm_json['results'][0]['generated_text'], type)
    except Exception as e:
        print("{} Error from LLM -->".format(datetime.now()), response_llm_json)
        return "Error occured. Status code: {}. Please try again.".format(response_llm_json['status_code'])

# Codegen API call - loop version
def codegen_fn(text, codegen_payload_json, type):
    REQ_URL = SERVER_URL+'/v1/generate'
    query = text.split('---')
    answer = ""
    for q in query:
        codegen_payload_json['inputs'] = [q]
        print("calling LLM-Codegen")
        response_llm = requests.post(REQ_URL, headers=HEADERS, data=json.dumps(codegen_payload_json))
        response_llm_json = response_llm.json()
        answer = answer + response_llm_json['results'][0]['generated_text'] + "---\n"

    answer = "<html><pre>" + answer + "</pre></html>"
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
    @app.callback(Output('user-input', 'value'),
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
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, s, text):
    output = []
    actions = configs_dict['generate_btn_actions'].split(',')
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    types = configs_dict['generate_btn_output_type'].split(',')
    
    for action, label, payload_file, type in zip(actions, labels, payloads, types):
        try:
          with open('payload/{}.json'.format(payload_file)) as payload_f:
            payload_f_json = json.load(payload_f)

          if(action == "llm"):
            output.append(html.Div([html.H5(label), llm_fn(text, payload_f_json, type)], className="output-div"))
          elif(action == "codegen"):
            output.append(html.Div([html.H5(label), codegen_fn(text, payload_f_json, type)], className="output-div"))
        except Exception as e:
          print(action, e)
    return output

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm_sp(n, s, text):
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
            op=get_payloads(text, None)
        return not is_open,op
    return is_open, []

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
