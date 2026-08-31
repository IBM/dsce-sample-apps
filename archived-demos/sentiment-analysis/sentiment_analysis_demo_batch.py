#
# This is a modified version of sentiment_analysis_demo.py to handle batch processing 
# of a set of newline separated records in a file and provide an aggregate sentiment of the data.
# You can add a data file in the same directory, remove the sample text to type
# 'batch process file:<filename>' in the given text box and click the button.
# The UI shows percentage of records and sentences in 3 sentiment categories as an aggregate view.
# It utilizes 2 pre-trained language models English and Spanish. So you can add a data set with
# these 2 different languages to test language detection and sentiment analysis.
#
# This file is given as an example to demonstrate how a sample app can be modified to create a
# a custom demo with a new data set, change UI, switch language models etc.
#

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

# API end-points
SENT_REQ_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/SentimentPredict'
LANG_DETECT_URL = SERVER_URL+'/v1/watson.runtime.nlp.v1/NlpService/LangDetectPredict'

# pre-trained models used
MODEL_NAME_EN = 'sentiment_aggregated-cnn-workflow_lang_en_stock'
MODEL_NAME_ES = 'sentiment_aggregated-cnn-workflow_lang_es_stock'
MODEL_NAME_LANG = 'lang-detect_izumo_lang_multi_stock'
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

# color of chart elements
positive_color = "#009D9A"
negative_color = "#9F1853"
neutral_color = "#c8c8c9"
positive_border_color = "#ffffff"
negative_border_color = "#ffffff"
neutral_border_color = "#000000"

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
                        "This App is built using Watson NLP library. Please note that this content is made available \
                         to foster Embedded AI technology adoption. The content may include systems & methods pending \
                         patent with USPTO and protected under US Patent Laws. \
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
# function to detect language of the text so that we can change the model used for sentiment analysis
#
def get_language_model(text):

        headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'grpc-metadata-mm-model-id': MODEL_NAME_LANG
        }
        payload = {
            'rawDocument': {
                'text': text
            }
        }
        response = requests.post(LANG_DETECT_URL, headers=headers, data=json.dumps(payload))
        response_json = response.json()
        lang = response_json['langCode']
        if lang == "LANG_SPA":
            return MODEL_NAME_ES
        elif lang == "LANG_ENG":
            return MODEL_NAME_EN
        else:
            print("Processing text : " + text)
            print("Language detected: " + lang + ". Model not in container, hence using default model (English)")
            return MODEL_NAME_EN

#
# function that calls the backend sentiment API after detecting the language 
#
def get_sentiment(text):

    if text is None:
        return empty_sentiment_output['document_sentiment']['sentiment_mentions'], \
            empty_sentiment_output['document_sentiment']['label'],empty_sentiment_output['document_sentiment']['score']
    else:

        # first detect language 
        lang_model = get_language_model(text)

        headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'grpc-metadata-mm-model-id': lang_model
        }
        payload = {
            'rawDocument': {
                'text': text
            }
        }
        response = requests.post(SENT_REQ_URL, headers=headers, data=json.dumps(payload))
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
  r = process(value)
  return r


# 
# batch process a set of records
#
import sys, traceback, re
def batch_process(value):

	pos_count = 0
	neg_count = 0
	neu_count = 0
	pos_review = 0
	neg_review = 0
	neu_review = 0
	total_score = 0
	total_reviews = 0
	total_sentences = 0
	
	try:    
		# get file name that was sent with the 'batch process command'
		filename = ''
		words = value.split()
		for w in words:
			if 'file:' in w:
				filename = w.split(':')[1]
		if filename == '':
			fig_sentiment = go.Figure()
			fig_sentiment.add_trace(
				go.Bar(
					x = ['positive sentences (%)','negative sentences (%)','neutral sentences (%)','positive reviews (%)','negative reviews (%)','neutral reviews (%)'],
					y = [0,0,0,0,0,0],
				)
			)
			return "No filename specified (batch process file:<filename>)", fig_sentiment, None

		# continue with a proper filename

		try:
			f = open(filename, "r")
		except:
			fig_sentiment = go.Figure()
			fig_sentiment.add_trace(
				go.Bar(
					x = ['positive sentences (%)','negative sentences (%)','neutral sentences (%)','positive reviews (%)','negative reviews (%)','neutral reviews (%)'],
					y = [0,0,0,0,0,0],
				)
			)
			return "File not found (batch process file:<filename>)", fig_sentiment, None

		# start processing record at a time
		lines = f.readlines()
		for line in lines:
			result = get_sentiment(line)
			sentiment_overall = result[2]
			#print('SCORE', sentiment_overall)
			sentiment_output = result[0]
			sentence_sentiment = [(sm['sentimentprob']) for sm in sentiment_output]
                    
			for sentiments in sentence_sentiment:
				sentence_label = max(sentiments, key=sentiments.get)
				sentence_score = round(max(sentiments.values()),2)
				if sentence_label == "positive":
					pos_count = pos_count + 1
				elif sentence_label == "negative":
					neg_count = neg_count + 1
				else:
					neu_count = neu_count + 1
				total_sentences = total_sentences + 1

			total_score = total_score + sentiment_overall
			total_reviews = total_reviews + 1
			if sentiment_overall>0:
				pos_review = pos_review + 1
			elif sentiment_overall<0:
				neg_review = neg_review + 1
			else:
				neu_review = neu_review + 1

	except Exception as e:
		print(traceback.format_exc())

	avg_score = round(float(total_score / total_reviews), 2)
	pos_sentences_perc = round(float(pos_count/total_sentences) * 100, 1)
	neg_sentences_perc = round(float(neg_count/total_sentences) * 100, 1)
	neu_sentences_perc = round(float(neu_count/total_sentences) * 100, 1)
	pos_reviews_perc = round(float(pos_review/total_reviews) * 100, 1)
	neg_reviews_perc = round(float(neg_review/total_reviews) * 100, 1)
	neu_reviews_perc = round(float(neu_review/total_reviews) * 100, 1)

	# Plot 
	fig_sentiment = go.Figure()
	fig_sentiment.add_trace(
		go.Bar(
			x = ['positive sentences (%)','negative sentences (%)','neutral sentences (%)','positive reviews (%)','negative reviews (%)','neutral reviews (%)'],
			y = [pos_sentences_perc, neg_sentences_perc, neu_sentences_perc, pos_reviews_perc, neg_reviews_perc, neu_reviews_perc],
			marker_color=[positive_color, negative_color, neutral_color, positive_color, negative_color, neutral_color]
		)
	)
	# Plot legends
	title_string = "Voice of Customer: Percentage of all sentences across reviews and percentage of all reviews classified as positive, negative and neutral"
	fig_sentiment.update_layout(template=plotly_template,barmode='stack',title_text=title_string, yaxis_title="Percentage")
	fig_sentiment.add_trace(go.Bar(y=[None], name="Neutral", marker_color=neutral_color, marker_line_color=neutral_border_color))
	fig_sentiment.add_trace(go.Bar(y=[None], name="Negative", marker_color=negative_color, marker_line_color=negative_border_color))
	fig_sentiment.add_trace(go.Bar(y=[None], name="Positive", marker_color=positive_color, marker_line_color=positive_border_color))

	return ("Overall Sentiment: ", avg_score, " (-1 to 1)"), fig_sentiment, None


# 
# function called to process a value which can be for 1 record from UI or a set of records from a batch data source, e.g. a file or a DB
#
def process(value):

  try:

    # check if user entered a command to batch process data and not the actual text to be analyzed 
    if "batch process" in value:
        r = batch_process(value)
        return r

    # this is a request from the UI with text to be analyzed
    
    # call the API to get sentiment which in turn also detects language model to be used
    sentiment_output = get_sentiment(value)

    sentiment_output1 = sentiment_output[0]
    sentence_sentiment = [(sm['sentimentprob']) for sm in sentiment_output1]

    sentiment_score_list = []
    sentiment_color_list = []
    sentiment_border_list = []
    sentiment_label_list = []
    sentiment_text_list = []
    
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

    for results in sentiment_output1:
       sentiment_text_list.append(results['span']['text'])

    df_sentiment = pd.DataFrame()
    df_sentiment["Label"] = sentiment_label_list
    df_sentiment['Score'] = sentiment_score_list
    df_sentiment["Sentence"] = sentiment_text_list
    # Adding a column with colors
    df_sentiment["Color"] = sentiment_color_list
    df_sentiment["BorderColor"] = sentiment_border_list
    # Plot for sentiment score
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
    #Legends
    fig_sentiment.add_trace(go.Bar(y=[None], name="Neutral", marker_color=neutral_color, marker_line_color=neutral_border_color))
    fig_sentiment.add_trace(go.Bar(y=[None], name="Negative", marker_color=negative_color, marker_line_color=negative_border_color))
    fig_sentiment.add_trace(go.Bar(y=[None], name="Positive", marker_color=positive_color, marker_line_color=positive_border_color))
    
    fig_sentiment.update_yaxes(rangemode="nonnegative")
    fig_sentiment.update_layout(template=plotly_template,barmode='stack',title_text='Sentiment score for each sentence in given text', title_x=0.5,
                                xaxis_title="Sentence Number", yaxis_title="Sentiment Score", xaxis = dict(tickmode = 'linear',tick0 = 0,dtick = 1))
  except Exception as e:
       print(traceback.format_exc())
  
  return ("Overall Sentiment: ", sentiment_output[1].split('_')[1], ' | ', "Confidence: ", str(sentiment_output[2]), " (0 to 1)"), \
       fig_sentiment, df_sentiment.to_dict('records')


# main -- runs on localhost. change the port to run multiple apps on your machine

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
