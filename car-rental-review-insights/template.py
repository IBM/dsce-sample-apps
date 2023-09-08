import os
import time
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
import json
import dash
import plotly.express as px
import dash_bootstrap_components as dbc
from dash import dash_table, Input, Output, State, html, dcc
import pandas as pd
import requests
import json
import base64
import io
from jproperties import Properties
from markdownify import markdownify as md
from customApi import custom_api_fn
import plotly.io as pio

# Setting theme for plotly charts
plotly_template = pio.templates["plotly_white"]

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
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

mask_store = dict(masked_text="")

# Read Sample text from file
sample_from_file = ""
with open('sample-text.txt', 'r') as sample_text_f:
    sample_from_file = sample_text_f.read()

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'],suppress_callback_exceptions=True)
app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
            dbc.Row([
                    dbc.Col(configs_dict['navbartitle'],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                ]
            )
        ],
    style={'paddingLeft': '1rem', 'height': '3rem', 'paddingRight': '2rem', 'borderBottom': '1px solid #393939', 'color': '#fff'},
    class_name = "bg-dark"
)

user_input = dbc.InputGroup([
        dbc.Textarea(id="user-input",
                     value=sample_from_file if len(sample_from_file)>0 else configs_dict['sample_text'],
                     placeholder=configs_dict['input_placeholder_text'],
                     rows=configs_dict['input_h_rows'] if configs_dict['layout'] == 'horizontal' else configs_dict['input_v_rows'],
                     style={'borderRadius': '0', 'borderTop': 'none', 'borderLeft': 'none', 'borderRight': 'none', 'backgroundColor': '#f4f4f4','borderBottomColor': '#8d8d8d', 'resize': 'none'}
                     ),
    ],
    className="mb-3",
)

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="generate-button", outline=True, color="primary", n_clicks=0, className="carbon-btn"
)

upload_button = dcc.Upload(id="upload-data", className="upload-data",
    children=[
        dbc.Button("Upload File", outline=True, color="primary", n_clicks=0, className="carbon-btn"),
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
                    dcc.Store(id='masked_content',data=mask_store),
                    dcc.Download(id="download-text"),
                    navbar_main,
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
        payload_f_json['input'] = payload_f_json['input']+text+"\n\nOutput:\n"
        payload_f_json['project_id'] = "xxxxx"
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
        return dcc.Markdown(md(res))

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn


# Summarization API call
def summarization_fn(text, summary_payload_json, type, access_token):
    REQ_URL = SERVER_URL+'/v1/generate'
    summary_payload_json['input'] = [text]
    print("calling LLM-Summary")
    response_llm = requests.post(REQ_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(summary_payload_json))
    response_llm_json = response_llm.json()
    return parse_output(response_llm_json['results'][0]['generated_text'], type)

# Classification API call
def classification_fn(text, classification_payload_json, type, access_token):
    REQ_URL = SERVER_URL+'/v1/generate'
    classification_payload_json['input'] = classification_payload_json['input'] + text+"\n\nOutput:\n"
    print("calling LLM-Classification")
    print("input", classification_payload_json['input'])
    response_llm = requests.post(REQ_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(classification_payload_json))
    response_llm_json = response_llm.json()
    print(response_llm_json)
    return parse_output(response_llm_json['results'][0]['generated_text'], type)

# Entity API call
def entity_extraction_fn(text, entity_payload_json, type,access_token):
    REQ_URL = SERVER_URL+'/v1/generate'
    entity_payload_json['input'] = [text]
    print("calling LLM-Entity Extraction")
    response_llm = requests.post(REQ_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(entity_payload_json))
    response_llm_json = response_llm.json()
    print(response_llm_json['results'][0]['generated_text'])
    print(type)
    return parse_output(response_llm_json['results'][0]['generated_text'], type)

# Entity API call
def content_generation_fn(text, content_payload_json, type,access_token):
    REQ_URL = SERVER_URL+'/v1/generate'
    content_payload_json['input'] = [text]
    print("calling LLM-Content Generation")
    response_llm = requests.post(REQ_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(content_payload_json))
    response_llm_json = response_llm.json()
    answer = "<html>" + response_llm_json['results'][0]['generated_text'] +"</html>"
    print(type)
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
    Output('masked_content','data'),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    State('masked_content','data'),
    prevent_initial_call=True
)

def generate_output_llm(n, text,masked_store):
    #if(eval(configs_dict['app_locked']) and text not in [sample_from_file]):
        #time.sleep(0.5)
        #return dbc.Alert("Input tampered: Please try with the sample input only", color="danger")
    
    output = []
    final_output = []
    actions = configs_dict['generate_btn_actions'].split(',')
    labels = configs_dict['generate_btn_output_labels'].split(',')
    payloads = configs_dict['generate_btn_payload_files'].split(',')
    types = configs_dict['generate_btn_output_type'].split(',')
    lines = text.split("\n")
    authenticator = IAMAuthenticator(API_KEY)
    access_token = authenticator.token_manager.get_token()

    lines = [i for i in lines if i]

    print(lines)

    print("Payloads : " , payloads)
    for line in lines:
        for action, label, payload_file, type in zip(actions, labels, payloads, types):
            try:
              with open('payload/{}.json'.format(payload_file)) as payload_f:
                payload_f_json = json.load(payload_f)
              if(action == "summary"):
                output.append(html.Div([html.H5(label), summarization_fn(text, payload_f_json, type,access_token)], className="output-div"))
              elif(action == "classify"):
                output.append(classification_fn(line, payload_f_json, type,access_token))
              elif(action == "entity"):
                output.append(html.Div([html.H5(label), entity_extraction_fn(text, payload_f_json, type,access_token)], className="output-div"))
              elif(action == "content"):
                output.append(html.Div([html.H5(label), content_generation_fn(text, payload_f_json, type,access_token)], className="output-div"))
              elif(action == "custom"):
                output.append(html.Div([html.H5(label), custom_api_fn(text, payload_f_json, type)], className="output-div"))
            except Exception as e:
              print(action, e)
    df = pd.DataFrame(output)
    new_column_names = ['Sentiment', 'BusinessArea', 'Issues','NBO','Masked']
    df = pd.DataFrame(df.values.reshape(len(lines), 5), columns=new_column_names)
    print(df)
    negative=df['Sentiment'].value_counts()['negative']/df.shape[0]*100
    positive=df['Sentiment'].value_counts()['positive']/df.shape[0]*100
    #print(df['Masked'][3])
    #1 . Code for Summary, considers only negative sentiments
    df_filtered = df[df['Sentiment'] == "negative"]
    counts = df_filtered['Issues'].value_counts().head(3)
    top_3_counts_values = counts.index.to_list()
    top_3_counts_values = list(map(lambda x: x.lower(), top_3_counts_values))
    print(top_3_counts_values)
    if negative > 50:
        gen_summary_text = "Majority respondents were unhappy."
    else:
        gen_summary_text = "Majority respondents were happy."

    #final_output.append(html.Div([html.H5("Summary"), summary_text], className="output-div"))

    summary_text =" Those who are not happy were upset with - "
    #final_output.append(html.Div([html.H5("Summary"), html.P([gen_summary_text, html.Br(), summary_text])], className="output-div"))
    #html.P(['Why no', html.Br(), 'linebreak?'])
    
    #4 code for next best action for negative sentiments
    df_filtered_ba = df[df['Sentiment'] == "negative"]
    counts = df_filtered['NBO'].value_counts().head(3)
    top_3_nba_values = counts.index.to_list()
    top_3_nba_values_lower = [x.lower() for x in top_3_nba_values]
    nbo_summary_text = "The actions to be taken to address issues are - "
    final_output.append(html.Div([html.H5(html.B("Summary")), html.P([gen_summary_text, html.Br(), summary_text, html.B(", ".join(top_3_counts_values)), html.Br(), nbo_summary_text,html.B(", ".join(top_3_nba_values_lower))])], className="output-div"))
    #final_output.append(html.Div([summary_text + ", ".join(top_3_nba_values_lower)+"."], className="output-div"))

    #final_output.append(html.Div([html.H5("Summary"), summary_text + ", ".join(top_3_counts_values)], className="output-div"))
    #final_output.append(summary_text + ", ".join(top_3_counts_values))

    #2 Code for Sentiment Classification

    sentiment_string = f"Negative sentiment: {negative}% and Positive sentiment: {positive}%"
    ######## TRIAL START ######
    new_df = pd.DataFrame({
    "sentiment": ["Negative", "Positive"],
    "value": [negative, positive],
    })

    pie_chart = px.pie(
    new_df,
    values="value",
    names="sentiment",height=300,width=550
    )
    pie_chart.update_layout(
    margin={'t':0,'b':0,'l':0,'r':0}
    )
    pie_chart.update_layout(legend=dict(orientation="h"))
    graph = dcc.Graph(figure=pie_chart,config={"displayModeBar": False})
    final_output.append((html.Div([html.H5(html.B("Review sentiment")), graph], className="output-div")))
    ######## TRIAL END ######

    # new bar chart for issues and reviews
    df_filtered_issues = df[df['Sentiment'] == "negative"]
    new_df_issues = df_filtered_issues['Issues'].value_counts()
    new_df_issues_final = pd.DataFrame({'Issues': new_df_issues.index, 'Occurrences': new_df_issues.values})
    new_df_issues_final["Issues"] = new_df_issues_final["Issues"].apply(str.lower)
    print(new_df_issues_final)

    bar_chart_issues = px.bar(new_df_issues_final, x="Issues", y="Occurrences", height=300, width=550,template=plotly_template)
    bar_chart_issues.update_layout(margin={'t':0,'b':0},xaxis_title="Issues",yaxis_title="Negative Reviews")
    bar_graph_issues = dcc.Graph(figure=bar_chart_issues,config={"displayModeBar": False})
    final_output.append((html.Div([html.H5(html.B("Issues requiring attention")), bar_graph_issues], className="output-div")))
    #final_output.append(summary_text + ", ".join(top_3_nba_values))

    #3 code for issue counts
    df_filtered_ba = df[df['Sentiment'] == "negative"]
    business_area_wise_issue_count = df_filtered_ba.groupby('BusinessArea')['Issues'].size()
    index = business_area_wise_issue_count.index
    values = business_area_wise_issue_count.values
    business_area_wise_issue_string = ""
    buss_areas =[]
    ba_issues = []
    for i in range(len(business_area_wise_issue_count)):

        key = business_area_wise_issue_count.index[i]
        buss_areas.append(key)
        value = business_area_wise_issue_count.values[i]
        ba_issues.append(value)
        business_area_wise_issue_string += f"{key}: {value}\n"

    #final_output.append(html.Div([html.H5("Business Area-wise Issues "), business_area_wise_issue_string], className="output-div"))
    bar_chart = px.bar(x=buss_areas, y=ba_issues, height=300, width=550,template=plotly_template)
    bar_chart.update_layout(margin={'t':0,'b':0},xaxis_title="Business Area",yaxis_title="Negative Reviews")
    bar_graph = dcc.Graph(figure=bar_chart,config={"displayModeBar": False})
    final_output.append((html.Div([html.H5(html.B("Business areas requiring attention")), bar_graph], className="output-div")))
    #final_output.append(business_area_wise_issue_string)


    # Adding another chart for next best actions
    nbo_counts = df_filtered['NBO'].value_counts()
    print(nbo_counts)
    new_df_nbos = pd.DataFrame({'NBO': nbo_counts.index, 'Occurrences': nbo_counts.values})
    pie_chart_nbo = px.pie(
    new_df_nbos,
    values="Occurrences",
    names="NBO",height=300,width=550
    )
    pie_chart_nbo.update_layout(
    margin={'t':0,'b':0,'l':0,'r':0}
    )
    pie_chart_nbo.update_layout(legend=dict(orientation="h"))
    graph_nbo = dcc.Graph(figure=pie_chart_nbo,config={"displayModeBar": False})
    final_output.append((html.Div([html.H5(html.B("Actions to be taken")), graph_nbo], className="output-div")))
    #final_output.append(html.Div([html.H5("Sentiments"), sentiment_string], className="output-div"))
    #final_output.append(sentiment_string)
  
    #5 code for showing masked reviews (this needs to be put in file eventually)
    i=0
    masked_review_df = pd.DataFrame({"data": []})
    for review_line in lines:
        entities = df["Masked"][i]
        data_list = entities.split(',')
        print(data_list)
        d = {}
        for line in data_list:
            if ":" in line:
                value, key = line.split(':', 1)
                print(value, key)
                # Add the key-value pair to the dictionary
                d[key.strip()] = value.strip()
                print(key.strip())
                print(d)
                if key.strip() =="Person" or key.strip() =="phoneNumber":
                    print(review_line)
                    masked_review = review_line.replace(d[key.strip()]," xxxxx ")
                    print(masked_review)
                    masked_review_df.loc[i, "data"] = masked_review
                else:
                    masked_review = review_line
                    #print(masked_review)
                    masked_review_df.loc[i, "data"] = masked_review
                #masked_review_df["masked_review"] = masked_review
                #masked_review_df.loc[len(masked_review_df)] = masked_review

        i=i+1

    masked_column = df["Masked"]
    #print(masked_review_df)
    download_btn = dbc.Button("Download", id="download-btn", outline=True, color="primary", n_clicks=0, className="carbon-btn")
    masked_store['masked_text']=masked_review_df.to_csv()
    final_output.append(html.Div([html.H5(html.B("Masked Reviews")),download_btn], className="output-div"))

    #print(final_output)
    return final_output,masked_store
# callback for downloading masked text file
@app.callback(
    Output("download-text", "data"),
    Input("download-btn", "n_clicks"),
    State('masked_content','data'),
    prevent_initial_call=True,
)
def download_masked_func(n_clicks,masked_store):
    if (n_clicks>0):
        return dict(content=masked_store['masked_text'], filename="masked_file.txt")
# For loading spinner
@app.callback(
    Output('generate-output', 'children', allow_duplicate=True),
    Input('generate-button', 'n_clicks'),
    State('user-input', 'value'),
    prevent_initial_call=True
)
def generate_output_llm(n, text):
    return [dbc.Spinner(color="primary", size="sm"), " Please wait..."]

# main -- runs on localhost. change the port to run multiple apps on your machine
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8055")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
