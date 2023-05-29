import os
import dash
import dash_bootstrap_components as dbc
from dash import dash_table, dcc, Input, Output, State, html
import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
import requests
import json

# pre-defined URL for backend
SERVER_URL = 'https://8f96122371.dsceapp.buildlab.cloud'

# API end-point
REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/ConceptsPredict'

# pre-trained model used
MODEL_NAME = 'concepts_alchemy-workflow_lang_en_stock'
# for a more updated list of models available on the container, refer to the latest README in the GitHub repo for this sample

# change this text if you want a different sample in the UI
concept_sample_text = "Under the IBM Board Corporate Governance Guidelines, the Directors and Corporate Governance Committee and the full Board annually review the financial and other relationships between the independent directors and IBM as part of the assessment of director independence. The Directors and Corporate Governance Committee makes recommendations to the Board about the independence of non-management directors, and the Board determines whether those directors are independent. In addition to this annual assessment of director independence, independence is monitored by the Directors and Corporate Governance Committee and the full Board on an ongoing basis."


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP])
app.title = 'Watson NLP - Concept Extraction'

# plotly used for charts
plotly_template = pio.templates["plotly_white"]

navbar_main = dbc.Navbar(
        [
            dbc.Col(
                [
                    dbc.Row(
                        [   
                            dbc.Col([]),
                            dbc.Col([])
                        ],
                        className='me-auto',
                        align='center',
                        justify='right',
                    ),  
                ],
                align = 'center'
            ),
            dbc.Col(
                [
                    dbc.Row(html.H2("Watson NLP", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center',
                    ),
                    dbc.Row(html.H4("Concept Extraction", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center'
                    ),
                ],
                align = 'center'
            ),
            dbc.Col(
                [
                    dbc.Row(
                        [   
                            dbc.Col([]),
                            dbc.Col([])
                        ],
                        className='me-auto',
                        align='center',
                        justify='right',
                    ),  
                ],
                align = 'center'
            ),
        ],
    className='bg-dark text-light'
)

concept_extraction_input =  dbc.InputGroup(
            [
                dbc.InputGroupText("Enter Text"),
                dbc.Textarea(id="concept-input", placeholder="Text for concept extraction", value=concept_sample_text, rows=7)
            ],
            className="mb-3",
        )

concept_button = html.Div(
    [
        dbc.Button(
            "Extract concepts", id="concept-button", className="me-2", n_clicks=0
        )
    ],
    className = "text-center"
)

concept_output_figure = dcc.Graph(id='concept-output-figure')

df_concept_output = pd.DataFrame(columns=['Concept', 'Score'])
concept_output_table = dash_table.DataTable(
    columns=[{"name": i, "id": i} for i in df_concept_output.columns],
    style_cell={
        'textAlign': 'left',
        'font-family':'sans-serif'
    },
    style_table={'overflowX': 'scroll'},
    style_as_list_view=True,
    sort_action='native',
    sort_mode='multi',
    id='concept-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                dbc.Row(
                    [
                    dbc.Col(
                        children=[
                        html.Br(),
                        html.Div(concept_extraction_input),
                        concept_button,
                        html.Hr(),
                        html.Div(id='container-button-concept'),
                        html.Div(concept_output_figure, className="border"),
                        html.Br(),
                        html.Div(concept_output_table),
                        ]
                    )
                    ],
                    className="px-3 pb-5"
                ),
                html.Br(),
                html.Br(),
                html.Footer(
                    dbc.Row([
                    dbc.Col(
                        "This App is built using Watson NLP library. Please note that this content is made available to foster Embedded AI technology adoption. \
                            The library may include systems & methods pending patent with USPTO and protected under US Patent Laws. \
                            Copyright - 2023 IBM Corporation",
                        className="p-3"
                    )]),
                    className="bg-dark text-light position-fixed bottom-0"
                )
], className="bg-white")

empty_concept_output = {
    "concepts": [
        {
            "text": "",
            "relevance": 0,
            "dbpediaResource": ""
        }
    ],
    "producerId": {
        "name": "Concepts Workflow",
        "version": "0.0.1"
    }
}
# ---- end UI code ----



#
# function that calls the backend API
#
def get_concept(text):

    if text is None or text.strip() == "":
        return [empty_concept_output['concepts'][0]['text']], [empty_concept_output['concepts'][0]['relevance']]
    else:
        headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'grpc-metadata-mm-model-id': MODEL_NAME
        }
        payload = {
            'rawDocument': {
                'text': text
            },
            'limit': 5
        }
        response = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
        response_json = response.json()
        text = []
        relevance = []
        document_concept = response_json['concepts']
        
        for document in document_concept:
            text.append(document['text'])
            relevance.append(document['relevance'])

        return text, relevance



# call back functions from UI

@app.callback(
    Output('concept-output-figure', 'figure'),
    Output('concept-output-table', 'data'),
    Input('concept-button', 'n_clicks'),
    State('concept-input', 'value')
)

def concept_extraction_callback(n_clicks, value):

    # color of chart elements
    color_list = ['#1292E7','#005D5C','#FA4D56','#A01752','#520408']

    # call the backend for extracting concepts
    concept_output = get_concept(value)
    color_list = color_list[0:len(concept_output[0])]
    
    concept_output_text = concept_output[0]
    concept_output_relevance = concept_output[1]

    # chart content
    df_concept = pd.DataFrame()
    df_concept["Concept"] = concept_output_text
    df_concept["Score"] = concept_output_relevance

    # # chart colors
    df_concept["Color"] = color_list


    # plot chart
    fig_concept = go.Figure()
    fig_concept.add_trace(
        go.Bar(
            x=df_concept['Concept'],
            y=df_concept['Score'],
            marker_color=df_concept['Color'],
            name='',
            ))
    
    fig_concept.update_yaxes(rangemode="nonnegative")
    fig_concept.update_layout(template=plotly_template,barmode='stack',title_text='Extracted concepts',
                                xaxis_title="Extracted concepts", yaxis_title="Relevance Score", xaxis = dict(tickmode = 'linear',tick0 = 0,dtick = 1))
   
    return fig_concept, df_concept.to_dict('records')



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
