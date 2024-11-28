import os, dash, pandas, requests, json, base64, io, time, random,re
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc, ctx, ALL
import pandas as pd
from jproperties import Properties
from markdownify import markdownify as md
from datetime import datetime
import pandas as pd

# instantiate config
configs = Properties()
# load properties into configs
with open('app-config.properties', 'rb') as config_file:
    configs.load(config_file)

configs_dict = {}
items_view = configs.items()
for item in items_view:
    configs_dict[item[0]] = item[1].data

data = {}
taxonomy = {}
no_of_sample_data = 14
models = ['granite-13b-instruct-v2', 'granite-3-8b-instruct']
for model in models:
    with open(f'data/{model}-classification-data.json') as json_data:
        data[f'{model}-classification'] = json.load(json_data)


    with open(f'data/{model}-summarization-data.json') as json_data:
        data[f'{model}-summarization'] = json.load(json_data)


    with open(f'data/{model}-rag-data.json') as json_data:
        data[f'{model}-rag'] = json.load(json_data)

with open('taxonomy/classification-qna.yaml') as qna_data:
    taxonomy['classification'] = qna_data.read()

with open('taxonomy/summarization-qna.yaml') as qna_data:
    taxonomy['summarization'] = qna_data.read()

with open('taxonomy/rag-qna.yaml') as qna_data:
    taxonomy['rag'] = qna_data.read()

result_store = dict()

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'], suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

load_btn = dbc.Button(
    "Load examples", id="load-button", color="primary", n_clicks=0, className="carbon-btn"
)

generate_btn = dbc.Button(
    "Generate samples", id="generate-button", disabled=True, color="secondary", outline=True, n_clicks=0, className="carbon-btn"
)
test_btn = dbc.Button(
    "Test samples", id="test-button", disabled=True, color="secondary", outline=True, n_clicks=0, className="carbon-btn"
)

def create_table(df, table_columns):
    style_data_conditional = [{'if': {'column_id': 'Result'},
         'width': '10%', 'textAlign': 'center'},]
    for i in range(no_of_sample_data, len(df)):
        style_data_conditional.append({
            'if': {'row_index': i},
            'backgroundColor': '#e9f6ff' if df.iloc[i]['Result']!='Fail' else '#ffeae7'
        })
    return dash_table.DataTable(
        data=df.to_dict('records'),
        columns=[{'id': c, 'name': c.capitalize()} for c in table_columns],
        tooltip_data=[
            {
                column: {'value': str(value) if row.get(f'{column}-tt') is None else str(row.get(f'{column}-tt')), 'type': 'text' if column=="Input" else 'markdown'}
                for column, value in row.items()
            } for row in df.to_dict('records')
        ],
        style_header={
            'textAlign': 'center'
        },
        css=[{
            'selector': '.dash-table-tooltip',
            'rule': 'min-width:300px; width:fit-content; max-width:600px;'
        }],
        # Overflow into ellipsis
        style_cell={
            'overflow': 'hidden',
            'textOverflow': 'ellipsis',
            'maxWidth': 0,
            'fontFamily': 'IBM Plex Sans',
            'textAlign': 'left',
            'padding': '0rem 0.4rem 0rem 0.4rem'
        },
        style_data_conditional=style_data_conditional,
        tooltip_delay=0,
        tooltip_duration=None
        )

passing_stats = html.Div([
    html.Span(id="passing-percentage")
])

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    dbc.DropdownMenu(
                        children=[
                            dbc.DropdownMenu(
                            label="Model selector",
                            children=[
                                html.Div(
                                dbc.RadioItems(
                                    options=[
                                        {"label": "ibm/granite-3-8b-instruct", "value": 'ibm/granite-3-8b-instruct'},
                                        {"label": "ibm/granite-13b-instruct-v2", "value": 'ibm/granite-13b-instruct-v2'}
                                    ],
                                    value='ibm/granite-3-8b-instruct',
                                    id="model-selector-radio"
                                ), style={'padding': '0.2rem 0rem 0rem 0.2rem', 'minHeight': '2.5rem'})
                            ],
                            nav=True, in_navbar=True,
                            class_name="dmi-class",
                            direction="start"
                        ),
                            
                            # dbc.DropdownMenuItem("View payload", id="view-payload", n_clicks=0, class_name="dmi-class"),
                            dbc.DropdownMenuItem("View qna files", id="taxonomy-payload", n_clicks=0, class_name="dmi-class"),
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

taxonomy_modal = dbc.Modal(
    [
        dbc.ModalHeader(dbc.ModalTitle("Taxonomy")),
        dbc.ModalBody([
            dbc.Tabs([
                dbc.Tab([
                    dcc.Markdown(f'''```yaml
{taxonomy[qna.lower()]}
                        '''
                    ),
                ],
                tab_id=f'taxonomy-tab-{qna.lower()}',
                label=qna, label_style={'borderRadius': 0}
            ) for qna in ['Classification', 'Summarization', 'RAG']
            ],id="taxonomy-modal-tb", active_tab="taxonomy-tab-classification")
        ]),
    ],
    id="taxonomy-modal",
    size="xl",
    scrollable=True,
    is_open=False,
)


footer = html.Footer(
    dbc.Row([
        dbc.Col(children=[dcc.Markdown(configs_dict['footer_text'])],className="p-3 pb-0")]),
    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
    className="bg-dark position-fixed bottom-0"
)
layout_app = dbc.Row(
                    [
                        dbc.Col(className="col-1"),
                        dbc.Col(
                            children=[
                                dbc.Row([dbc.Col(dbc.Button('Home', id='home-button', className='btn-link', n_clicks=0), className='col-2')], style={'marginBottom': '1rem'}),
                                dbc.Row([
                                    dbc.Col([html.Label([html.B('Step 1:'), ' Select AI task to test model selection in settings'], className='label', style={'marginBottom':'0.55rem'}),
                                             dcc.Dropdown(
                                            ['Classification', 'Summarization', 'RAG'],
                                            'Classification',
                                            id="ai-task-selector",
                                            clearable=False,
                                            searchable=False,
                                        )], className='col-2'),
                                    dbc.Col([html.Label([html.B('Step 2:'),' Load example ground truth data'], className='label'),load_btn], className='col-2'),
                                    dbc.Col([html.Label([html.B('Step 3:'),' Generate more ground truth data'], className='label'), generate_btn], className='col-2'),
                                    dbc.Col([html.Label([html.B('Step 4:'),' Test model with ground truth data'], className='label'), test_btn], className='col-2'),
                                    dbc.Col(className='col-2'),
                                    dbc.Col(passing_stats, className='col-2', style={'alignContent': 'end', 'paddingLeft': '6rem'})
                                    ]),
                                html.Br(),
                                dbc.Row([
                                    html.Div(id='data-table')
                                ])
                            ],
                            className="col-10"
                        ),
                        dbc.Col(className="col-1"),
                    ],
                    className="px-3 pb-5"
                )

layout_main_page = dbc.Col([dbc.Row([
    dbc.Col(className='col-1'),
    dbc.Col(html.Div([
        html.H5(['Test models using ', html.A('InstructLab', href="https://instructlab.ai/", target="_blank"),' Synthetic Data Generation.']),
        html.Br(),
        html.Ul([
            html.Li([html.B('Step 1:'),' Select AI task to test model selection in settings']),
            html.Li([html.B('Step 2:'),' Load example ground truth data']),
            html.Li([html.B('Step 3:'),' Generate more ground truth data']),
            html.Li([html.B('Step 4:'),' Test model with ground truth data'])
        ], style={'listStyleType': 'none'}),
        html.Div([
            "Latest result summary: No result found"
            ],id='model-result'),
        html.Br(),
        dbc.Button('Start', id='start-app-btn', className='carbon-btn', color='primary')
    ]), className='col-10'),
        dbc.Col(className='col-1')
    ], style={'marginTop': '4rem'}),
    html.Div([
            html.P(["Powered by ", html.A('InstructLab', href="https://instructlab.ai", target='_blank'), html.Img(src="/assets/logo.png", height="40", width="40"),])
            ], style={'position': 'fixed', 'bottom': '5rem', 'right': '2rem'})
        ])

app.layout = html.Div(children=[
                    dcc.Store(id='result-store', data=result_store),
                    navbar_main,
                    html.Br(),
                    html.Div(layout_app, id='app-layout', style={'display':'none'}),
                    html.Div(layout_main_page, id='main-page-layout'),
                    taxonomy_modal,
                    html.Br(),
                    html.Br(),
                    footer
], className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# ---- end UI code ----

@app.callback(
    Output('load-button', 'disabled'),
    Output('load-button', 'outline'),
    Output('load-button', 'color'),
    Output('generate-button', 'disabled'),
    Output('generate-button', 'outline'),
    Output('generate-button', 'color'),
    Output('data-table', 'children'),
    Input('load-button', 'n_clicks'),
    State('ai-task-selector', 'value'),
    State('model-selector-radio', 'value'),
    prevent_initial_call=True
)
def display_sample_data(n, ai_task, model):
    model = model.split('/')[1]
    if(n>0):
        time.sleep(2)
        df = pd.DataFrame(data[f'{model}-{ai_task.lower()}'])
        df = df.head(no_of_sample_data)
        df['Input-tt'] = df['question']
        if (ai_task.lower()=='classification'):
            df['Input'] = df['question'].map(lambda q: q.split('Sentence:')[1])
        elif (ai_task.lower()=='rag'):
            df['Input'] = df['question'].map(lambda q: q.split('\n\n')[-1])
        else:
            df['Input'] = df['question']
        
        df['Expected response'] = df['response1']
        df['Result'] = ''
        table_columns = ['Input', 'Expected response', 'Model response', 'Result']
        table = create_table(df, table_columns)
        return True, True, 'secondary', False, False, 'primary', [table]



@app.callback(
    Output('generate-button', 'disabled', allow_duplicate=True),
    Output('generate-button', 'outline', allow_duplicate=True),
    Output('generate-button', 'color', allow_duplicate=True),
    Output('test-button', 'disabled', allow_duplicate=True),
    Output('test-button', 'outline', allow_duplicate=True),
    Output('test-button', 'color', allow_duplicate=True),
    Output('data-table', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    State('data-table', 'children'),
    State('ai-task-selector', 'value'),
    State('model-selector-radio', 'value'),
    prevent_initial_call=True
)
def generate(n, table, ai_task, model):
    model = model.split('/')[1]
    if(n>0):
        time.sleep(2)
        df = pd.DataFrame(data[f'{model}-{ai_task.lower()}'])
        df['Input-tt'] = df['question']
        if (ai_task.lower()=='classification'):
            df['Input'] = df['question'].map(lambda q: q.split('Sentence:')[1])
        elif (ai_task.lower()=='rag'):
            df['Input'] = df['question'].map(lambda q: q.split('\n\n')[-1])
        else:
            df['Input'] = df['question']
        df['Expected response'] = df['response1']
        df['Result'] = ''
        table_columns = ['Input', 'Expected response', 'Model response', 'Result']
        table = create_table(df, table_columns)
        return True, True, 'secondary', False, False, 'primary', table


@app.callback(
    Output('data-table', 'children', allow_duplicate=True),
    Output('passing-percentage', 'children'),
    Output('result-store', 'data'),
    Input('test-button', 'n_clicks'),
    State('ai-task-selector', 'value'),
    State('data-table', 'children'),
    State('passing-percentage', 'children'),
    State('result-store', 'data'),
    State('model-selector-radio', 'value'),
    prevent_initial_call=True
)
def show_test_result(n, ai_task, table, pass_percentage, result_store, model):
    model = model.split('/')[1]
    if(n>0):
        time.sleep(2)
        df = pd.DataFrame(data[f'{model}-{ai_task.lower()}'])
        df['Input-tt'] = df['question']
        if (ai_task.lower()=='classification'):
            df['Input'] = df['question'].map(lambda q: q.split('Sentence:')[1])
        elif (ai_task.lower()=='rag'):
            df['Input'] = df['question'].map(lambda q: q.split('\n\n')[-1])
        else:
            df['Input'] = df['question']
        df['Expected response'] = df['response1']
        df['Model response'] = df['response2']
        df['Result'] = df['result'].apply(lambda x: x.capitalize())
        pass_fail_counts = df['result'].value_counts()
        pass_count = pass_fail_counts.get('pass', 0)
        total_count = len(df)
        pass_percentage = round((pass_count / total_count) * 100, 2)
        if(ai_task.lower()=="classification"):
            df['Result-tt'] = ('- Generated token count: ' + df['generated_token_count'].astype(str) + "\n- " + 'Input token count: ' + df['input_token_count'].astype(str) + ' \n- ' + 'Stop reason: ' + df['stop_reason'])
        elif(ai_task.lower()=="summarization"):
            df['Result-tt'] = ('- Generated token count: ' + df['generated_token_count'].astype(str) + "\n- " + 'Input token count: ' + df['input_token_count'].astype(str) + '\n- ' + 'Stop reason: ' + df['stop_reason'] + '\n- ' + 'Threshold: ' + df['threshold'].astype(str) + '\n- ' + 'Similarity: ' + round(df['similarity'], 2).astype(str))
        else:
            df['Result-tt'] = ('- Generated token count: ' + df['generated_token_count'].astype(str) + "\n- " + 'Input token count: ' + df['input_token_count'].astype(str) + '\n- ' + 'Stop reason: ' + df['stop_reason'])
        table_columns = ['Input', 'Expected response', 'Model response', 'Result']
        table = create_table(df, table_columns)
        try:
            result_store[model][ai_task] = f'{pass_percentage}%'
        except Exception as e:
            result_store[model] = {ai_task: f'{pass_percentage}%'}
        return table, [html.B(f'Pass: {pass_percentage}%')], result_store
    return table, pass_percentage, result_store

# restart app on ai task selection
@app.callback(
    Output('load-button', 'disabled', allow_duplicate=True),
    Output('load-button', 'outline', allow_duplicate=True),
    Output('load-button', 'color', allow_duplicate=True),
    Output('test-button', 'disabled', allow_duplicate=True),
    Output('test-button', 'outline', allow_duplicate=True),
    Output('test-button', 'color', allow_duplicate=True),
    Output('generate-button', 'disabled', allow_duplicate=True),
    Output('generate-button', 'outline', allow_duplicate=True),
    Output('generate-button', 'color', allow_duplicate=True),
    Output('data-table', 'children', allow_duplicate=True),
    Output('passing-percentage', 'children', allow_duplicate=True),
    Input('ai-task-selector', 'value'),
    Input('model-selector-radio', 'value'),
    prevent_initial_call=True
)
def change_ai_task(val, model):
    return False, False, 'primary', True, True, 'secondary', True, True, 'secondary', [], []


# For loading spinner
@app.callback(
    Output('data-table', 'children', allow_duplicate=True),
    Input('load-button', 'n_clicks'),
    Input('generate-button', 'n_clicks'),
    Input('test-button', 'n_clicks'),
    prevent_initial_call=True
)
def show_loading(n1,n2,n3):
    if(n1>0 or n2>0 or n3>0):
        ctx_triggered = ctx.triggered[0]["prop_id"].split(".")[0]
        message = 'Loading examples'
        if(ctx_triggered=="generate-button"):
            message = 'Generating data'
        elif(ctx_triggered=="test-button"):
            message = 'Testing model'
        return [dbc.Spinner(color="primary", size="sm"), f" {message}..."]

# start the app
@app.callback(
    Output('app-layout', 'style'),
    Output('main-page-layout', 'style'),
    Input('start-app-btn', 'n_clicks'),
    prevent_initial_call=True
)
def update_layout(n):
    if(n>0):
        return {'display': 'block'}, {'display': 'none'}


# go back to the landing page
@app.callback(
    Output('app-layout', 'style', allow_duplicate=True),
    Output('main-page-layout', 'style', allow_duplicate=True),
    Output('model-result', 'children', allow_duplicate=True),
    Input('home-button', 'n_clicks'),
    # State('model-selector-radio', 'value'),
    State('result-store', 'data'),
    prevent_initial_call = True
)
def update_layout_home(n, result_store):
    if(n>0):
        op = []
        for model in result_store.keys():
            model_summary = [
                html.Li(f'{i}: {result_store[model][i]}') for i in result_store[model].keys()
            ]
            op.append(
                html.Div([
                    f'Latest result summary: (model: {model})',
                    html.Ol(model_summary) 
                ])
            )
        return {'display': 'none'}, {'display': 'block'}, op


# Open/Close taxonomy modal
@app.callback(
    Output("taxonomy-modal", "is_open"),
    [Input("taxonomy-payload", "n_clicks")],
    [State("taxonomy-modal", "is_open")],
    prevent_initial_call=True
)
def toggle_taxonomy_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open, []

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
