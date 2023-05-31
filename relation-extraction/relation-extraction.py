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
SERVER_URL = 'https://60e04d1fdc.dsceapp.buildlab.cloud'

# API end-point
REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/RelationsPredict'

# pre-trained model used
MODEL_NAME = 'relations_transformer-workflow_lang_en_stock'

# for a more updated list of models available on the container, refer to the latest README in the GitHub repo for this sample

# change this text if you want a different sample in the UI
relation_sample_text = "Mohandas Karamchand Gandhi (2 October 1869 – 30 January 1948) was an Indian lawyer, anti-colonial nationalist and political ethicist who employed nonviolent resistance to lead the successful campaign for India's independence from British rule. He inspired movements for civil rights and freedom across the world. Gandhi was born in Porbandar, Gujarat. In 1883, Mohandas was married to Kasturbai. Gandhi worked in South Africa for several years."


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP])
app.title = 'Watson NLP - Relation Extraction'

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
                    dbc.Row(html.H4("Relation Extraction", style={'textAlign': 'center'}),
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

relation_extraction_input =  dbc.InputGroup(
            [
                dbc.InputGroupText("Enter Text"),
                dbc.Textarea(id="relation-input", placeholder="Text for Relation Extraction", value=relation_sample_text, rows=7)
            ],
            className="mb-3",
        )

relation_button = html.Div(
    [
        dbc.Button(
            "Extract relations", id="relation-button", className="me-2", n_clicks=0
        )
    ],
    className = "text-center"
)

relation_output_figure = dcc.Graph(id='relation-output-figure')

df_relation_output = pd.DataFrame(columns=['Relation', 'Score'])
relation_output_table = dash_table.DataTable(
    columns=[{"name": i, "id": i} for i in df_relation_output.columns],
    style_cell={
        'textAlign': 'left',
        'font-family':'sans-serif'
    },
    style_table={'overflowX': 'scroll'},
    style_as_list_view=True,
    sort_action='native',
    sort_mode='multi',
    id='relation-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                dbc.Row(
                    [
                    dbc.Col(
                        children=[
                        html.Br(),
                        html.Div(relation_extraction_input),
                        relation_button,
                        html.Hr(),
                        html.Div(id='container-button-relation'),
                        html.Div(relation_output_figure, className="border"),
                        html.Br(),
                        html.Div(relation_output_table),
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


# ---- end UI code ----


empty_relation_output = {
    "relations": [
        {
            "entity1": {
                "mentions": [],
                "text": "",
                "type": "",
                "confidence": 0,
                "relevance": 0,
                "disambiguation": ''
            },
            "entity2": {
                "mentions": [],
                "text": "",
                "type": "",
                "confidence": 0,
                "relevance": 0,
                "disambiguation": ''
            },
            "relationMentions": [],
            "type": "",
            "confidence": 0
        }
    ],
    "producerId": {
        "name": "Transformer Relation Mentions Workflow",
        "version": "0.0.1"
    }
}

#
# function that calls the backend API
#
def get_relation(text):

    if text is None or text.strip()=="":
        return [empty_relation_output['relations'][0]['entity1']['text']],[empty_relation_output['relations'][0]['confidence']]
    else:
        headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'grpc-metadata-mm-model-id': MODEL_NAME
        }
        payload = {
            'rawDocument': {
                'text': text
            }
        }

        sentences = []
        confidence_scores = []

        response = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
        response_json = response.json()
        
        for document in response_json['relations']:
            sentence = " ".join([document['entity1']['text'],document['type'], document['entity2']['text']])
            confidence_score = document['confidence']
            sentences.append(sentence)
            confidence_scores.append(confidence_score)

        # if extracted relations are more than 5, then extract only 5 with maximum confidence score
        if(len(confidence_scores)>5):

            # sorting
            for i in range(len(confidence_scores)):
                for j in range(len(confidence_scores)-i-1):
                    if(confidence_scores[j]>confidence_scores[j+1]):
                        confidence_scores[j], confidence_scores[j+1] = confidence_scores[j+1], confidence_scores[j]
                        sentences[j], sentences[j+1] = sentences[j+1], sentences[j]
            
            # reverse the sorted list
            sentences.reverse()
            confidence_scores.reverse()

            # extract only 5 values
            sentences = sentences[:5]
            confidence_scores = confidence_scores[:5]


        return sentences, confidence_scores



# call back functions from UI

@app.callback(
    Output('relation-output-figure', 'figure'),
    Output('relation-output-table', 'data'),
    Input('relation-button', 'n_clicks'),
    State('relation-input', 'value')
)

def relation_extraction_callback(n_clicks, value):

    # color of chart elements
    color_list = ['#1292E7','#005D5C','#FA4D56','#A01752','#520408']

    # call the backend for extracting relations
    relation_output = get_relation(value)
    color_list = color_list[0:len(relation_output[0])]
    
    relation_output_sentence = relation_output[0]
    relation_output_confidence_score = relation_output[1]

    # chart content
    df_relation = pd.DataFrame()
    df_relation["Relation"] = relation_output_sentence
    df_relation["Score"] = relation_output_confidence_score

    # # chart colors
    df_relation["Color"] = color_list

    # plot chart
    fig_relation = go.Figure()
    fig_relation.add_trace(
        go.Bar(
            x=df_relation['Relation'],
            y=df_relation['Score'],
            marker_color=df_relation['Color'],
            name='',
            ))
    
    fig_relation.update_yaxes(rangemode="nonnegative")
    fig_relation.update_layout(template=plotly_template,barmode='stack',title_text='Extracted relations',
                                xaxis_title="Extracted relations", yaxis_title="Relevance Score", xaxis = dict(tickmode = 'linear',tick0 = 0,dtick = 1))
   
    return fig_relation, df_relation.to_dict('records')



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
