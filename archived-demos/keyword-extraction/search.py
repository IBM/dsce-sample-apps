#
# search.py: Uses set of ',' separated keywords and entities entered by user to find the ranked list of documents
# Documents having more matches are ranked higher.
# An entity is of the form <key:value> and a keyword is just <value>
# The code can be enhanced to have a synonyms dictionary to map entity names or key in <key:value> or 
# better fuzzy matching of values.
#

import os
import dash
import dash_bootstrap_components as dbc
from dash import Input, Output, State, html, dcc
import re
from fuzzywuzzy import process
import itertools
import json
import pandas as pd

keyword_sample_text = "Location:london, friendly staff, victoria station"

# ---- UI code ----

app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP])
app.title = 'Watson NLP - Search Use case'

# global varibale to store recent search response
prev_result = []

navbar_main = dbc.Navbar(
        [
            dbc.Col(
                [
                    dbc.Row(html.H2("Watson NLP", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center',
                    ),
                    dbc.Row(html.H4("Hotel reviews search using Keywords and Entities extraction", style={'textAlign': 'center'}),
                        className="me-auto",
                        align='center',
                        justify='center'
                    ),
                ],
                align = 'center'
            )
        ],
    className='bg-dark text-light'
)

keyword_input =  dbc.InputGroup(
            [
                dbc.Input(id="keyword-input", placeholder="Search", value=keyword_sample_text),
                dbc.Button(id="keyword-button", style={'backgroundColor':'#E9ECEF', 'borderColor':'#CED4D9'}, children=html.I(className="bi bi-search", style={'color':'black'}))
            ],
            className="mb-3 px-1"
        )

output_div = html.Div(id="output-div")


app.layout = html.Div(children=[
                    navbar_main,
                dbc.Row(
                    [
                    dbc.Col(
                        children=[
                        html.Br(),
                        html.Div(keyword_input,style={'marginLeft':'25%'}, className="w-50"),
                        html.Br(),
                        html.Hr(),
                        html.Div(id='container-button-keyword'),
                        html.Br(),
                        html.Div(output_div, 
                        style={'border':'1px solid gray', 'borderRadius':'5px', 'padding':'10px 0px 0px 10px', 'marginTop':'-10px', 'backgroundColor':'#E9ECEF'})
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
                        style={'padding' : '1rem 6rem 1rem 3rem'}
                    )]),
                    className="bg-dark text-light position-fixed bottom-0"
                )
], className="bg-white")


# ---- end UI code ---- #

# read index files
with open('index_keywords.json') as f:
    data_keywords = json.load(f)
with open('index_entities.json') as f:
    data_entities = json.load(f)

# extract doc numbers of keywords
def get_documents_keywords(input, fuzzy_used):
    try:
        row_list = data_keywords[input.strip()]
    except:
        try:
            if(input.strip()!=""):
                # it will take input variable and will try to find most appropriate term from the data_keywords.keys() 
                fuzzy_result = process.extract(input, data_keywords.keys(), limit=1)

            # chceking for confidence score
            if(fuzzy_result[0][1]>70):
                row_list = data_keywords[fuzzy_result[0][0]]
                fuzzy_used.append({input:fuzzy_result})
            else:
                row_list = []
        except:
            row_list = []
    return row_list

# extract doc numbers of entities
def get_documents_entities(input):

    #preparing key to fetch entities data
    splitted_input = input.split(':')
    splitted_input[0] = splitted_input[0].strip().capitalize()
    splitted_input[1] = splitted_input[1].strip().lower()

    #it will take only 2 items of the array which is type and entity (e.g [Location,london], any extra items will be ignored)
    key_builder = ': '.join(['"{}"'.format(value.strip()) for value in splitted_input[0:2]])
    key = "{{{}}}".format(key_builder)
    try:
        row_list = data_entities['{}'.format(key)]
    except:
        row_list = []
    return row_list

# add markdown to specific search term
def markdown(user_inputs, search_result, row_list, row_counter, review):
    counter = 0
    for user_input in user_inputs:
        if(user_input.strip() != ''):
            # processing entities
            if(len(user_input.split(':'))>1):
                row_keyword = get_documents_entities(user_input)
                input = user_input.split(':')[1].strip().lower()
            
            # processing keywords
            else:
                # if fuzzy match is used
                if(len(search_result[2])):
                    try:
                        if(user_input in search_result[2][counter].keys()):
                            input = search_result[2][counter][user_input][0][0] # taking first fuzzy output
                            counter+=1
                        else:
                            input = user_input.strip()
                    except:
                            input = user_input.strip()
                
                # fuzzy match is not used
                else:
                    input = user_input
                try:
                    row_keyword = data_keywords[input.lower().strip()]
                except:
                    row_keyword = []
            
            pattern = r'\b{}\b'.format(re.escape(input.lower().strip()))
            matches = re.finditer(pattern, review.lower())
            occurrences = [match.start() for match in matches]
            
            flag = 0
            # only high light word if it is fetched by model (i.e available in json file)
            for row in row_keyword:
                if(row in search_result[1] and row_list[row_counter]==row):
                    flag=1
                    break
                
            if(flag):
                for i in range(len(occurrences)):
                    # it is considering * as a character so that added i*4 for **{}**
                    review = review[:occurrences[i]+i*4]+ '**{}**'.format(review[occurrences[i]+i*4:occurrences[i]+i*4+len(input.strip())]) + review[occurrences[i]+i*4+len(input.strip()):]
    return review


def search(user_input):
    
    # read csv to map doc ids to actual text records
    hotel = 'hotel_review/uk_england_london_belgrave_hotel.csv'
    listOfAll = []
    fuzzy_used = []

    if user_input is None:
        return []
    
    try:
        user_inputs = user_input.split(',')
        eligible_rows = []
        max_results = 10  #maximum number of reviews to be displayed on screen

        for input in user_inputs:

            # for entities as input
            if(len(input.split(':'))>1):
                row_list = get_documents_entities(input)
                
            # for keywords as input
            else:
                row_list = get_documents_keywords(input, fuzzy_used)
            eligible_rows.append(row_list)

        #if user has entered multiple comma separated values
        if(len(eligible_rows)>1):

            # Get rows which are common for all (AND operation)
            common_all = list(set.intersection(*map(set, eligible_rows)))
            
            # Common elements among decreasing numbers of sublists (some sub arrays are matching)
            common_decreasing = []
            for num_lists in range(len(eligible_rows), 1, -1):
                for combination in itertools.combinations(eligible_rows, num_lists):
                    common_decreasing.extend(list(set.intersection(*map(set, combination))))
            
            # Common elements within each individual sublist (single matching)
            common_individual = []
            for sublist in eligible_rows:
                common_individual.extend(sublist)
            
            eligible_rows = []
            eligible_rows.extend(common_all)
            eligible_rows.extend(common_decreasing)
            eligible_rows.extend(common_individual)
            
        else:
            eligible_rows=eligible_rows[0]
        
        # remove deplicate items from eligible_rows
        unique_list = []
        [unique_list.append(x) for x in eligible_rows if x not in unique_list]
    
        #limit the output size
        if(len(unique_list)>max_results):
            unique_list=unique_list[:max_results]
            
        df = pd.read_csv(hotel)
        output = df.iloc[unique_list]
        listOfAll.append([output['hotel'],output['text']])

        return [listOfAll,unique_list, fuzzy_used]
        
    except:
        print("No Data found")
        return [listOfAll,unique_list, fuzzy_used]


# call back functions from UI

@app.callback(
    Output('output-div', 'children'),
    Input('keyword-button', 'n_clicks'),
    Input('keyword-input', 'n_submit'),
    State('keyword-input', 'value')
)

def keyword_analysis_callback(n_clicks,n_submit, value):
    # global variable to store recent output
    global prev_result

    # if user has entered nothing then previous result will be retuned
    if(value.strip() == ''):
        if(len(prev_result)>0):
            return prev_result
        return [html.P("Please give some input")]
    
    # removing extra spaces between words (e.g. hello   world --> hello world)
    value = " ".join(value.lower().split())

    # remove extra characters other than alpha numeric, comma and colon
    pattern = r"[^a-zA-Z0-9,:]"
    processed_text = re.sub(pattern, " ", value)
    value = processed_text

    review_list = []
    hotel_list = []
    
    search_result = search(value)
    
    for response in search_result[0]:
        hotel_list.extend(response[0])
        review_list.extend(response[1])
    
    row_list = search_result[1]

    reviews = [html.P("Top {} results of hotel reviews".format(len(review_list)))]
    
    row_counter = 0
    
    for hotel,review in zip(hotel_list,review_list):
        
        #removing extra spaces between two words (e.g. hello   world --> hello world)
        review = " ".join(review.lower().split())
        user_inputs = value.split(',')

        # adding markdown to review
        review = markdown(user_inputs, search_result, row_list, row_counter, review)
        
        row_counter+=1
        
        # adding results into a list
        reviews.append(dbc.Row(dbc.Col(
                children= [
                    html.B("Hotel name : {}".format(hotel)),
                    html.Br(),
                    dcc.Markdown(review)
                ],
                className="m-3"
        )))
        
    # store latest output in global variable
    prev_result = reviews

    return reviews
   
if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=True, dev_tools_hot_reload=False)
