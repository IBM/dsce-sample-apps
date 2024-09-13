import base64, dash, dash_bootstrap_components as dbc, io, json, os, requests, time
from dash import Input, Output, State, html, dcc, ctx, ALL
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

# For Flow engine call
FLOW_ENGINE_URL = os.getenv('FLOW_ENGINE_URL')
FLOW_ENGINE_API_KEY = os.getenv('FLOW_ENGINE_API_KEY')
FLOW_ENGINE_HEADER = {
    'content-type': 'application/json',
    'Authorization': 'Apikey {}'.format(FLOW_ENGINE_API_KEY)
}
MODEL = os.getenv('MODEL')
COLLECTION_NAME = os.getenv('COLLECTION_NAME')

suggestions_list = [
                    "Explain the difference between vertical integration and globally distributed client-server production.",
                    "What is the advantage of vertical integration vs globally distributed production?",
                    "What role does symbolic design entry play in electronic design?",
                    "What is the SPICE concept and its application in analog simulation?",
                    "How does optimization of sequential logic impact the overall design process?",
                    "Describe the structure and use of digital simulators in the verification of logic circuits.",
                    "Compare the first, second and third generation of EDA.",
                    "What are the anticipated features of the fourth generation of EDA?",
                    "what is the size of an ARM7TMI processor core using CMOS0.6 ?",
                    "Give an example of where ASIP processors are used.",
                    "Explain in couple of lines the components of a re-targetable compiler."
                ]

suggestions_options = []
for input_suggestion in suggestions_list:
    suggestions_options.append(html.Option(input_suggestion))

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

with open('payload/flow-eng-query.json') as payload_f:
    flow_eng_query_json=json.load(payload_f)

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenuItem("View document", id="view-document-button", href='/assets/EDA.pdf', target='_blank', external_link=True, class_name="dmi-class"),
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
                    navbar_main,
                    input_data_list,
                    html.Br(),
                    html.Br(),
                    horizontal_layout if configs_dict['layout'] == 'horizontal' else vertical_layout,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

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

# Call flow engine
def flow_eng_fn(text):
    flow_eng_query_copy = flow_eng_query_json.copy()
    flow_eng_query_copy['query'] = flow_eng_query_json['query'].replace('#QUESTION#', text).replace('#MODEL#', MODEL).replace('#COLLECTION_NAME#', COLLECTION_NAME)
    print("calling FL ENG")
    response_fl = requests.post(FLOW_ENGINE_URL, headers=FLOW_ENGINE_HEADER, data=json.dumps(flow_eng_query_copy))
    response_fl_json = response_fl.json()
    try:
        out = response_fl_json['data']['myRagWithGuardrails']['out']
        resp_text = out['modelResponse']['results'][0]['generated_text'] or 'No result found'
        resp_hall = out['hallucinationScore']
        resp_contexts = json.dumps(out['contexts'], indent=2)

        view_source = dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("View source")),
                dbc.ModalBody([
                        dcc.Markdown(f"```json\n{resp_contexts}\n```", className='markdown-content')
                    ],
                    className='markdown-container'
                )
            ],
            id="view-source-modal",
            size="xl",
            scrollable=True,
            is_open=False,
        )

        scores = []
        for k, v in resp_hall.items():
            scores.append(html.B(k.replace('_', " ").capitalize()+':'))
            scores.append(round(v, 2))

        view_source_link = html.A(['View source contexts'], id='view-source-link', n_clicks=0, href="#", style={'display': 'block', 'margin-top': '1rem'})

        constructedop = html.Div([resp_text, html.Hr(), html.H5("Hallucination score"),
            html.Div(scores, style={'display': 'grid', 'grid-template-columns': '150px auto', 'row-gap': '5px'}),
            view_source_link, view_source])
        return constructedop
    except Exception as e:
        print("{} Error from LLM -->{}\n{}", datetime.now(), e, response_fl_json)
        return "Error occured. {} \n{}. Please try again.".format(e, response_fl_json)


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

# Search
@app.callback(
    Output('generate-output', 'children'),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output(n, s, text):
    if(n>0 or s>0):
        if(text.strip()==""):
            time.sleep(0.5)
            return dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger")
        
        output = []
        actions = configs_dict['generate_btn_actions'].split(',')
        labels = configs_dict['generate_btn_output_labels'].split(',')        
        types = configs_dict['generate_btn_output_type'].split(',')

        for action, label, type in zip(actions, labels, types):
            try:
                output.append(html.Div([html.H5(label), flow_eng_fn(text)], className="output-div"))
            except Exception as e:
                print(action, e)
        return output
    return []

@app.callback(
    Output("view-source-modal", "is_open"),
    Input("view-source-link", "n_clicks"),
    State("view-source-modal", "is_open"),
)
def toggle_view_source_modal(n, is_open):
    if n:
        return not is_open
    return is_open

# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('search-button', 'n_clicks'),
    Input('user-input', 'n_submit'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm_sp(n, s, text):
    if(n>0 or s>0):
        return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]


payloads = configs_dict['generate_btn_payload_files'].split(',')

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
