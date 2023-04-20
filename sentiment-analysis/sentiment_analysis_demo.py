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
REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/SentimentPredict'

# pre-trained model used
MODEL_NAME = 'sentiment_aggregated-cnn-workflow_lang_en_stock'
# for a more updated list of models available on the container, refer to the latest README in the GitHub repo for this sample

# change this text if you want a different sample in the UI
sentiment_sample_text = "I don't share everyone's unbridled enthusiasm for this film. \
It is indeed a great popcorn flick, with outstanding aerial photography and maneuvers.\
But 10 stars? There are few, if any, movies that are perfect, and deserve that kind of rating. \
The problem with the film is the plot. It is so filled with age-worn cliches that one \
could easily tell what was coming from beginning to end. I mean, you had to know who was going \
to save the day at the end, and you had to know what was going to happen when Maverick jumped \
out of Penny's window. Those are just two examples of the many obvious plot points that you \
could see coming a mile away. I could list them all, but it would take up too much space here.\
Basically the entire plot was entirely predictable. \
The opening scene, especially, was straight out of Hollywood Screenplay Writing 101. \
I mean, seriously, how many times have we seen that subplot? Countless. \
There were no characters in the movie, either. They were all caricatures, stereotypes.\
No depth to any of them. They had their standard roles to play, and that was it.\
Did I enjoy the film? Sure, it was fun. Especially on a big theater screen with a loud sound system. \
Did I take anything away from the film? Did it make me think about anything after it was over? \
Nah. Will I see it again? Nah. I will give Tom Cruise credit for including Val Kilmer in the cast.\
Considering his health problems, that was a nice touch.\
So, yeah, enjoy the film. Sit back with your bag of popcorn and enjoy the g-forces. \
But don't pretend it is anything other than just another summer blockbuster."


# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP])
app.title = 'Watson NLP - Sentiment Analysis'

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
                    dbc.Row(html.H4(" Sentiment Analysis", style={'textAlign': 'center'}),
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

sentiment_analysis_input =  dbc.InputGroup(
            [
                dbc.InputGroupText("Enter Text"),
                dbc.Textarea(id="sentiment-input", placeholder="Text for Sentiment analysis", value=sentiment_sample_text, rows=7)
            ],
            className="mb-3",
        )

sentiment_button = html.Div(
    [
        dbc.Button(
            "Get Sentiment", id="sentiment-button", className="me-2", n_clicks=0
        ),
        dbc.Button("Overall Sentiment Output: ", id="sentiment-result", color="light", className="me-1", disabled=True),
    ],
    className = "text-center"
)

sentiment_output_figure = dcc.Graph(id='sentiment-output-figure')

df_sentiment_output = pd.DataFrame(columns=['Sentence', 'Label', 'Score'])
sentiment_output_table = dash_table.DataTable(
    columns=[{"name": i, "id": i} for i in df_sentiment_output.columns],
    style_cell={
        'textAlign': 'left',
        'font-family':'sans-serif'
    },
    style_table={'overflowX': 'scroll'},
    style_as_list_view=True,
    sort_action='native',
    sort_mode='multi',
    id='sentiment-output-table'
)

app.layout = html.Div(children=[
                    navbar_main,
                dbc.Row(
                    [
                    dbc.Col(
                        children=[
                        html.Br(),
                        html.Div(sentiment_analysis_input),
                        sentiment_button,
                        html.Hr(),
                        html.Div(id='container-button-sentiment'),
                        html.Div(sentiment_output_figure, className="border"),
                        html.Br(),
                        html.Div(sentiment_output_table),
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

empty_sentiment_output = {
  "document_sentiment": {
    "score": 0,
    "label": "Sentiment not analyzed",
    "mixed": "NONE/EMPTY",
    "sentiment_mentions": [
      {
        "span": {
          "begin": 0,
          "end": 0,
          "text": "NONE/EMPTY"
        },
        "sentimentprob": {
          "positive": 0,
          "neutral": 0,
          "negative": 0
        }
      }
    ]
  },
  "targeted_sentiments": {
    "targeted_sentiments": {},
    "producer_id": {
      "name": "Aggregated Sentiment Workflow",
      "version": "0.0.1"
    }
  },
  "producer_id": {
    "name": "Aggregated Sentiment Workflow",
    "version": "0.0.1"
  }
}

# ---- end UI code ----



#
# function that calls the backend API
#
def get_sentiment(text):

    if text is None:
        return empty_sentiment_output['document_sentiment']['sentiment_mentions'], \
            empty_sentiment_output['document_sentiment']['label'],empty_sentiment_output['document_sentiment']['score']
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
        sentence_sentiment = response_json['documentSentiment']['sentimentMentions']
        document_sentiment_label = response_json['documentSentiment']['label']
        document_sentiment_score = round(response_json['documentSentiment']['score'],2)

        return sentence_sentiment, document_sentiment_label, document_sentiment_score



# call back functions from UI

@app.callback(
    Output('sentiment-result', 'children'),
    Output('sentiment-output-figure', 'figure'),
    Output('sentiment-output-table', 'data'),
    Input('sentiment-button', 'n_clicks'),
    State('sentiment-input', 'value')
)

def sentiment_analysis_callback(n_clicks, value):

    # color of chart elements
    positive_color = "#009D9A"
    negative_color = "#9F1853"
    neutral_color = "#c8c8c9"
    positive_border_color = "#ffffff"
    negative_border_color = "#ffffff"
    neutral_border_color = "#000000"
   
    sentiment_score_list = []
    sentiment_color_list = []
    sentiment_border_list = []
    sentiment_label_list = []
    sentiment_text_list = []


    # call the backend for analysis
    sentiment_output = get_sentiment(value)

    overall_sentiment_score = sentiment_output[2]

    # keep the score in the range 0 to 1 and use the category label to know positive, negative or neutral
    if overall_sentiment_score < 0:
        overall_sentiment_score = overall_sentiment_score * (-1)

    # get the label positive or negative or neutral
    overall_sentiment_category = sentiment_output[1].split('_')[1]

    sentiment_output_details = sentiment_output[0]
    sentence_sentiment = [(sm['sentimentprob']) for sm in sentiment_output_details]

    for sentiments in sentence_sentiment:
        sentence_label = max(sentiments, key=sentiments.get)
        sentence_score = round(max(sentiments.values()),2)
        if sentence_label == "negative":
            color = negative_color
            bar_color = negative_border_color
        elif sentence_label == "neutral":
            color = neutral_color
            bar_color = neutral_border_color
        else:
            color = positive_color
            bar_color = positive_border_color
        sentiment_score_list.append(sentence_score)
        sentiment_color_list.append(color)
        sentiment_border_list.append(bar_color)
        sentiment_label_list.append(sentence_label)

    for results in sentiment_output_details:
        sentiment_text_list.append(results['span']['text'])

    # chart content
    df_sentiment = pd.DataFrame()
    df_sentiment["Label"] = sentiment_label_list
    df_sentiment["Score"] = sentiment_score_list
    df_sentiment["Sentence"] = sentiment_text_list

    # chart colors
    df_sentiment["Color"] = sentiment_color_list
    df_sentiment["BorderColor"] = sentiment_border_list

    # plot chart
    fig_sentiment = go.Figure()
    fig_sentiment.add_trace(
        go.Bar(
            y=df_sentiment['Score'],
            marker_color=df_sentiment['Color'],
            hovertext=df_sentiment['Label'],
            name='',
            showlegend=False,
            marker_line_color=df_sentiment['BorderColor']
            ))
    # chart legends
    fig_sentiment.add_trace(go.Bar(y=[None], name="Neutral", marker_color=neutral_color, marker_line_color=neutral_border_color))
    fig_sentiment.add_trace(go.Bar(y=[None], name="Negative", marker_color=negative_color, marker_line_color=negative_border_color))
    fig_sentiment.add_trace(go.Bar(y=[None], name="Positive", marker_color=positive_color, marker_line_color=positive_border_color))
    
    fig_sentiment.update_yaxes(rangemode="nonnegative")
    fig_sentiment.update_layout(template=plotly_template,barmode='stack',title_text='Sentiment score for each sentence', title_x=0.5,
                                xaxis_title="Sentence Number", yaxis_title="Sentiment Score", xaxis = dict(tickmode = 'linear',tick0 = 0,dtick = 1))
   
    return ("Overall Sentiment Output: ", overall_sentiment_category, ' | ', str(overall_sentiment_score) + ' (0 to 1)'),\
		fig_sentiment, df_sentiment.to_dict('records')



# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
