import os
import dash
from dash import dcc
import dash_bootstrap_components as dbc
from dash import Input, Output, html, State
import plotly.io as pio
from dash.dependencies import Input, Output
import matplotlib.pyplot as plt
import plotly.express as px
import requests
import librosa
import base64

plt.switch_backend("Agg")

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])
app.title = "Text to Speech (TTS) Library"


# Setting theme for plotly charts
plotly_template = pio.templates["plotly_white"]
pio.templates["plotly_dark_custom"] = pio.templates["plotly_dark"]



navbar_main = dbc.Navbar(
        [
            dbc.Row(
                [
                    dbc.Col([
                            "Text to Speech",
                        ],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                ]
            )
        ],
    style={
          'paddingLeft': '1rem', 'height': '3rem', 'paddingRight': '2rem',
          'borderBottom': '1px solid #393939', 'color': '#fff'},
    class_name = "bg-dark"
)

wave_figure = dcc.Graph(id="wave-figure")

# pre-defined URL for backend
SERVER_URL = "https://993e36cad5.dsceapp.buildlab.cloud"

# API end-point
REQ_URL = SERVER_URL+'/text-to-speech/api/v1/synthesize'

# Setting up the headers for post request to service
headers = {"Content-Type": "application/json", "Accept": "audio/wav"}
params = {"voice": "en-US_AllisonV3Voice"}
file_name = "assets/result.wav"
tts_sample_text = "Welcome to Text to speech service demo. Text to Speech service supports a wide variety of voices in all supported languages and dialects."

tts_analysis_input = dbc.InputGroup(
    [
        dbc.Textarea(
            id="tts-input",
            value=tts_sample_text,
            cols=150,
            rows=5,
            placeholder="Text to Speech analysis",
            style={'borderRadius': '0', 'borderTop': 'none', 'borderLeft': 'none', 'borderRight': 'none', 'backgroundColor': '#f4f4f4','borderBottomColor': '#8d8d8d', 'resize':'none'}
        )
    ],
    className="mb-3",
)

tts_button = html.Div(
    [
        dbc.Button("Convert", id="tts-button", outline=True, color="primary", className="me-2", n_clicks=0,
                   style={'height': '2.5rem', 'width': 'min(250px, 100%)', 'borderRadius': 0, 'textAlign': 'left', 'paddingLeft': '1rem', 'paddingRight': '4rem', 'marginTop': '0.5rem'}
                   )
    ],
    className = "text-center"
    )


def print_plot_play(fileName, text=""):
    x, Fs = librosa.load(fileName, sr=None)
    fig = px.line(y=x)
    fig.update_layout(
        xaxis_title="Time (samples)",
        yaxis_title="Amplitude",
        title="Text To Speech Output wave form",
    )

    return fig


app.layout = html.Div(
    children=[
        navbar_main,
        html.Br(),
        dbc.Row(
            [
                dbc.Col(className="col-2"),
                dbc.Col(
                    children=[
                        html.Br(),
                        dbc.Row(
                            [
                                dbc.Col("Use the sample text or enter your own text in English",
                                    class_name="d-flex",
                                    style={'align-items':'center'}
                                ),
                                dbc.Col([html.Div("Select option for voice", className="pe-2"),
                                            html.Div([
                                                dcc.Dropdown(
                                                            ["Allison", "Michael"],
                                                            "Allison",
                                                            id="voice_dropdown",
                                                            persistence=True,
                                                            persistence_type="session",
                                                            style={"color": "#00361c"},
                                                            )
                                                        ],
                                                    style={"width": "40%"},
                                                    )
                                            ],
                                            class_name="d-flex",
                                            style={'justifyContent': 'flex-end', 'align-items':'center'}
                                        )
                            ],style={'align-item':'center'}
                        ),
                        html.Br(),
                        html.Div(tts_analysis_input),
                        html.Div(tts_button),
                        html.Br(),
                        html.Hr(),
                        html.Br(),
                        dbc.Row([
                            dbc.Col([ html.Div(id="div-audio", children=[" "])], width=3, style={'align-self':'center'}),
                            dbc.Col([ html.Div(wave_figure)], width=9)
                        ]
                        ),
                        html.Br(),
                     ],
                    className="col-8"
                ),
                 dbc.Col(className="col-2"),
            ],
             className="px-3 pb-5"
        ),
        html.Br(),
         html.Footer(
                    dbc.Row([
                    dbc.Col(
                        "Please note that this content is made available by IBM Build Lab to foster Embedded AI technology adoption. \
                                The content may include systems & methods pending patent with USPTO and protected under US Patent Laws. \
                                Copyright - 2022 IBM Corporation",
                        className="p-3"
                    )]),
                    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
                    className="bg-dark position-fixed bottom-0"
                )
        
    ],className="bg-white", style={"fontFamily": "'IBM Plex Sans', sans-serif"}
)

# method to get the Voice data from the text service
def getSpeechFromText(headers, params, data, voice_dropdown):
    if voice_dropdown == "Michael":
        params = {"voice": "en-US_MichaelV3Voice"}
   
    request = requests.post(REQ_URL, headers=headers, params=params, data=data)
    file_data = file_name
    if request.status_code != 200:
        print("TTS Service status:", request.text)
    if os.path.exists(file_name):
        os.remove(file_name)
    with open(file_data, mode="bx") as f:
        f.write(request.content)
    return file_data


@app.callback(
    Output("div-audio", "children"),
    Output("wave-figure", "figure"),
    Input("tts-button", "n_clicks"),
    State("voice_dropdown", "value"),
    State("tts-input", "value"),
)
def update_output(n_clicks, voice_dropdown, text_input):
    try:
        text_data = '{"text":"' + text_input + '"}'
        file_data = getSpeechFromText(headers, params, text_data, voice_dropdown)
        plt = print_plot_play(file_name, "Text To Speech Wav form")
        data_sound = base64.b64encode(open(file_data, "rb").read())
        audio3 = html.Audio(
            id="audiospeler",
            src="data:audio/wav;base64,{}".format(data_sound.decode()),
            controls=True,
            autoPlay=False,
            style={"width": "100%"},
        )
    except:
        audio3 = html.P("Please give proper text")
        fig = px.line()
        plt=fig
    return audio3, plt


if __name__ == "__main__":
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
