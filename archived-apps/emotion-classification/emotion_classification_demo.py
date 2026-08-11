import os
import dash
from dash import dcc
from dash import html
import dash_bootstrap_components as dbc
from dash import dash_table
from dash import Input, Output, State, html
from dash.dependencies import Input, Output
import pandas as pd
import plotly.express as px
import plotly.io as pio
import requests
import json
from dash.dependencies import Input, Output
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

# pre-defined URL for backend
SERVER_URL = 'https://8f96122371.dsceapp.buildlab.cloud'

# API end-point
REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/EmotionPredict'

# pre-trained model used
MODEL_NAME = 'emotion_aggregated-workflow_lang_en_stock'
# for a more updated list of models available on the container, refer to the latest README in the GitHub repo for this sample

# change this text if you want a different sample in the UI
emotion_sample_text = " Rooms were stunningly decorated and really spacious in the top of the building Pictures are of room 300 The true beauty of the building has been kept but modernised brilliantly Also the bath was lovely and big and inviting Great more for couples Restaurant menu was a bit pricey but there were loads of little eatery places nearby within walking distance and the tram stop into the centre was about a 6 minute walk away and only about 3 or 4 stops from the centre of Amsterdam Would recommend this hotel to anyone it s unbelievably well priced too"

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP])
app.title = 'Watson NLP - Emotion Analysis'

# Setting theme for plotly charts
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
                    dbc.Row(html.H4(" Emotion Analysis", style={'textAlign': 'center'}),
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

emotion_classification_input =  dbc.InputGroup(
            [
                dbc.InputGroupText("Enter Text"),
                dbc.Textarea(id="emotion-input", placeholder="Text for Emotion analysis", value=emotion_sample_text, rows=7)
            ],
            className="mb-3",
        )

emotion_button = html.Div(
    [
        dbc.Button(
            "Get Emotion", id="emotion-button", className="me-2", n_clicks=0
        ),
        dbc.Button(id="emotion-result", color="light", className="me-1", disabled=True),
    ],
    className = "text-center"
)

emotion_output_figure = dcc.Graph(id='emotion-output-figure')

df_emotion = pd.DataFrame(columns=['class_name', 'confidence'])
emotion_output_table = dash_table.DataTable(
    # data=df_emotion.to_dict('records'),
    columns=[{"name": i, "id": i} for i in df_emotion.columns],
    style_cell={
        'textAlign': 'left',
        'font-family':'sans-serif'
    },
    style_table={'overflowX': 'scroll'},
    style_as_list_view=True,
    sort_action='native',
    sort_mode='multi',
    id='emotion-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                dbc.Row(
                    [
                    dbc.Col(
                        children=[
                        html.Br(),
                        html.Div(emotion_classification_input),
                        emotion_button,
                        html.Hr(),
                        html.Div(id='container-button-emotion'),
                        html.Div(emotion_output_figure, className="border"),
                        html.Br(),
                        html.Div(emotion_output_table),
                        ],
                    ),
                    ],
                    className="px-3 pb-5",
                ),
                html.Br(),
                html.Br(),
                html.Footer(
                    dbc.Row([
                    dbc.Col(
                        "This App is built using Watson NLP library. Please note that this content is made available to foster Embedded AI technology adoption. \
                            The content may include systems & methods pending patent with USPTO and protected under US Patent Laws. \
                            Copyright - 2022 IBM Corporation",
                        className="p-3"
                    )]),
                    className="bg-dark text-light position-fixed bottom-0"
                )
], className="bg-white")

empty_emotion_output = {
  "classes": [
    {
      "class_name": "Emotion not analyzed",
      "confidence": 0
    },
  ],
  "producer_id": {
    "name": "Voting based Ensemble",
    "version": "0.0.1"
  }
}

# ---- end UI code ---- #

# function that calls the backend API

def get_emotion(text):
    if text is None:
        return empty_emotion_output
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
        response = requests.post(REQ_URL, headers=headers, data=json.dumps(payload))
        response_json = response.json()
        emotion_predictions = response_json['emotionPredictions']
        return emotion_predictions

# call back functions from UI

@app.callback(
    Output('emotion-result', 'children'),
    Output('emotion-output-figure', 'figure'),
    Output('emotion-output-table', 'data'),
    Input('emotion-button', 'n_clicks'),
    State('emotion-input', 'value')
)
def emotion_analysis_callback(n_clicks, value):
    # call the backend for analysis
    emotion_output_python = get_emotion(value)
    class_name_list = []
    confidence_list = []
    emotions = [(sm['emotion']) for sm in emotion_output_python]
    emotion_list = list(emotions[0].items())

    for emotion in emotion_list:
        class_name_list.append(emotion[0])
        confidence_list.append(round(emotion[1],2))

    df_emotion.drop(df_emotion.index, inplace=True)
    df_emotion['class_name'] = class_name_list
    df_emotion['confidence'] = confidence_list

    # index of maximum confidence score
    max_index = confidence_list.index(max(confidence_list))

    fig_emotion = px.bar(df_emotion, x='class_name', y='confidence',color=df_emotion['class_name'])
    fig_emotion.update_layout(template=plotly_template,barmode='stack',title_text='Emotion Score', title_x=0.5,
                                xaxis_title="Emotion", yaxis_title="Confidence Score")

    return ("Prominent Emotion: ", class_name_list[max_index], ' | ', str(confidence_list[max_index])),\
         fig_emotion, df_emotion.to_dict('records')

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
