from ibm_watson_machine_learning.foundation_models import Model
import json

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('API_KEY')
endpoint = os.getenv('ENDPOINT')
project_id = os.getenv('PROJECT_ID')

model_id = "mistralai/mixtral-8x7b-instruct-v01"
gen_parms   = {"decoding_method":"greedy",
            "max_new_tokens":1000,
            "stop_sequences": ["```"],
            "random_seed":1024, 
            "repetition_penalty":1}
space_id    = None
verify      = False
my_credentials = { 
    "url"    : endpoint, 
    "apikey" : api_key
}
model = Model( model_id, my_credentials, gen_parms, project_id, space_id, verify )
model_details = model.get_details()


def RegionalIssues(city, province, affected_services, concern, tweets, competitor):
    prompt1 = """
    [INST] <<SYS>>
    Input Information:

    - City and Province: The specific city and province where the issues have been reported.
    - Affected Service: The type of service experiencing issues (Internet, Cellular, TV, Customer Service).
    - Concern Type: A general estimation of the concern (e.g., outage, poor service quality).
    - List of Tweets: A curated list of tweets from customers mentioning the telecom company regarding the service issue.
    - Telco: The name of the telecom company in question.

    Objective:

    1. Analyze the List of Tweets: Go through the provided list of tweets to understand the context, issues, and sentiments expressed by the customers about the telecom company's service.

    2. Summarize Main Issues and Sentiments: Identify and summarize the key themes, main issues, and overall sentiment (positive, negative, neutral) from the tweets. Focus on common complaints, praises, or suggestions mentioned by multiple users.

    3. Generate a Descriptive Summary: Present a concise overview that not only states the city and province, the type of service affected, and the estimated concern type but also seamlessly incorporates the key themes and sentiments from the tweets. This overview should capture the essence of the customer feedback, highlighting the main concerns, issues, and overall sentiment towards the telecom company's handling of the situation in an integrated manner.

    Output Expectations:
    1. Analysis of Tweets:
    - Summarize the main issues and sentiments expressed in the provided list of tweets.
    - Output should include key themes and customer sentiments identified from the tweets.
    2. Summary:
    - The output should be a concise summary that not only provides a clear picture of the situation, including the geographical and service context but also deeply integrates the key themes and customer sentiments into the overview. It should effectively communicate the main concerns.

    ### Example Output in JSON Format:
    ```json
    {
        "tweets_analysis": {
            "customer_sentiments": ["sentiment 1", "sentiment 2", "sentiment 3"],
            "key_themes": ["keyword 1", "keyword 2", "keyword 3"]
        },
        "summary": "Brief overview of issues faced by clients identified based on location, affected_service, concern_type, and tweets_analysis in less than 50 words"
    }
    ```
    """
    prompt2 = f"""
    <</SYS>>
    
    Inputs:
    - City: {city}, {province}
    - Affected Service: {affected_services}
    - Concern Type: {concern}
    - List of Tweets: {tweets}
    - Telco:{competitor}
    [/INST]
    ```json"""
    result = model.generate(prompt1+prompt2)
    first_result =  result['results'][0]['generated_text'].strip()
    cleaned_summary = json.loads(first_result.replace("```", ""))
    second_result = RegionalMessages(competitor, cleaned_summary["summary"])
    cleaned_messages = json.loads(second_result.replace("```", ""))
    final_result = {
        "campaign": {
            "affected_service": affected_services,
            "concern_type": concern,
            "tweets_analysis": cleaned_summary["tweets_analysis"],
            "issue_summary": cleaned_summary["summary"],
            "messaging": cleaned_messages["messaging"]
        }
    }
    return final_result


def RegionalMessages(competitor, summary):
    prompt1="""[INST] <<SYS>>
    Input Information:

    - Summary Generated: A detailed summary analyzing the main issues, key themes, and customer sentiments expressed in the list of tweets about a competitor's telecom services. This summary includes the geographical location, affected service type, concern type, and integrates key themes and sentiments from the customer feedback.
    - Name of Competitor: The name of the competitor telecom company as mentioned in the summary.

    Objective:

    1. Understand the Competitor's Weaknesses and Customer Sentiments: Carefully read through the provided summary to grasp the weaknesses in the competitor's services, main customer complaints, and the overall sentiment towards the competitor.

    2. Identify Opportunities for TelcoA: Based on the competitor's weaknesses and customer frustrations, identify areas where TelcoA can offer better services, customer experience, or value.

    3. Generate Targeted Marketing Messages:
    - Craft Messages Highlighting TelcoA's Strengths: Create compelling marketing messages for Twitter that highlight how TelcoA addresses the specific issues mentioned in the summary. Emphasize improvements, reliability, customer service, or any other areas where TelcoA excels compared to the competitor.
    - Positive Tone and Customer Focus: Ensure the messages have a positive tone and focus on the benefits for the customer. Avoid direct criticism of the competitor; instead, subtly suggest how switching to TelcoA could alleviate the issues they've been facing.
    - Call to Action (CTA): Include a clear CTA in each message, encouraging users to learn more, switch to TelcoA, or take advantage of a special offer.

    Output Expectations:

    The output should be a series of targeted marketing messages ready to be posted on Twitter. These messages should:
    - Directly address the concerns and sentiments identified in the summary of the competitor's customer feedback.
    - Clearly communicate TelcoA's advantages and how it provides a better solution or experience.
    - Be engaging and concise, making them suitable for the Twitter platform.
    - Include CTAs that motivate potential customers to consider TelcoA as their preferred telecom service provider.

    Example Output Format:
    ```json
    {
        "messaging": ["tweet1", "tweet2", "tweet3"]
    }
    ```
    """
    prompt2 = f"""
    <</SYS>>
    Inputs:
    - Summary Generated: {summary}
    - Name of Competitor: {competitor}

    [/INST]
    ```json"""
    result = model.generate(prompt1+prompt2)
    first_result =  result['results'][0]['generated_text'].strip()
    return first_result
