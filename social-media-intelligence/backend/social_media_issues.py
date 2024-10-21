import requests
from ibm_watson_machine_learning.foundation_models import Model
import re

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('API_KEY')
endpoint = os.getenv('ENDPOINT')
project_id = os.getenv('PROJECT_ID')
url = os.getenv('URL')

model_id = "meta-llama/llama-3-1-70b-instruct"
gen_parms   = {"decoding_method":"greedy", 
            "max_new_tokens":500,
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

def auth(api_key):
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    data = f'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={api_key}'
    response = requests.post('https://iam.cloud.ibm.com/identity/token', headers=headers, data=data)
    token = (response.json()['access_token'])
    return token

def sentimentGenerator(prompt, token):
    instruction = """\
        You are a sentiment classifier bot. The following data that you will analyze are tweets about 3 telecommunications companies \
        called TelcoA, TelcoB and TelcoC. \

        You should follow these instructions:
        1. You should classify the tweet using the available information.
        2. You should not repeat your answers.
        3. You should not use any other knowledge.
        4. You should keep your answers short and concise.
        5. You should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content in your answers.
        6. You should ensure that your answers are socially unbiased and positive in nature.
        7. You should only answer the first unanswered question.
        8. If you don't know the answer to a question, please don't share false information, and say "I'm sorry, I was not able to find an answer to your question."

        Here are a few examples of tweets classified in 3 categories - - 'Positive', 'Negative' or 'Neutral'. 
        Please learn the context and respond appropriately.
        Examples:"""
    example = """
        Tweet  : i have been living without internet because of you & your poor service team.Waiting for the installation since October 17th, my son used to go to nearby starbucks to complete his homework, thanks to my neighbor for sharing his wifi password form last 2 weeks
        Sentiment : Negative

        Tweet  : Thank you for the wonderful service @TelcoA, loving it 
        Sentiment : Positive

        Tweet : I just got this text claiming to be from you. Is this legit or just someone scamming, trying to get me to use some Google app?
        Sentiment : Neutral

        Tweet :And I just wasted 2 hours of my time talking to customer service representatives of @TelcoC who doesn't know what they are doing. Insisting to help yet messed up everything and ended up everything is a waste of time.
        Sentiment : Negative

        Tweet :I have great internet speed today @TelcoA, thanks 
        Sentiment : Positive

        Tweet : Which channel is Raptors game tonight? @TelcoB
        Sentiment : Neutral

        Tweet : @TelcoA_Support Pls  be computer sensitive this evening for Fibe TV channel 1221 ABC Detroit! ABC Detroit isnt carrying normal programming that a Canadian channel might go over top! They are carrying NFL Lions at Dallas! CTV also carrying game so hopefully CTV is picture over top!
        Sentiment : Negative
        """

    body = {
        "input": f"""{instruction}

        {example}

        Tweet : {prompt}
        Sentiment : """,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 5,
            "repetition_penalty": 1
        },
        "model_id": "google/flan-ul2",
        "project_id": project_id,
        "moderations": {
            "hap": {
                "input": {
                          "enabled": True,
                          "threshold": 0.5,
                          },
                "output": {
                     "enabled": True,
                          "threshold": 0.5,
                    },
                "mask": {
                    "remove_entity_value": True
                }
            }
        }
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    response = requests.post(
        url,
        headers=headers,
        json=body
    )

    if response.status_code != 200:
        raise Exception("Non-200 response: " + str(response.text))

    data = response.json()
    return (data['results'][0]['generated_text'])

def toneGenerator(prompt, token):
    instruction = """\
        Extract the tone from the given tweet. It can (but is not limited to) be one of the following:
        Anger, Frustration, Concerned, Excitement, Neutral, Toxic, Offensive etc.
        Respond in one word. \
        Examples:"""
    example = """
        tweet : Biggest mistake to switch to you guys. Your service guy lost my condo fob and nobody cares!  I'm switching back to Rogers
        tone : anger
        """

    body = {
        "input": f"""{instruction}

        {example}

        tweet : {prompt}
        tone : """,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 20,
            "repetition_penalty": 1
        },
        "model_id": "google/flan-ul2",
        "project_id": project_id,
        "moderations": {
            "hap": {
                "input": {
                          "enabled": True,
                          "threshold": 0.5,
                          },
                "output": {
                     "enabled": True,
                          "threshold": 0.5,
                    },
                "mask": {
                    "remove_entity_value": True
                }
            }
        }
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    response = requests.post(
        url,
        headers=headers,
        json=body
    )

    if response.status_code != 200:
        raise Exception("Non-200 response: " + str(response.text))

    data = response.json()
    return (data['results'][0]['generated_text'])

def entityExtractor(prompt, token):
    instruction = """\
        Extract the following 4 entities from the given tweet:
        Affected Services, Area, Duration and Device. \
        If any one of the entities are unknown then just write "unknown"\.
        If all of them are unknown, then write "uknown" for all and do not change the output format from what is given below in the Examples.
        Strickly following the output format given below in the examples
        Examples:"""
    example = """
        tweet: i have been living without internet because of you & your poor service team for 2 weeks now in Calgary. My son takes his iPad to go to nearby starbucks to complete his homework, thanks to my neighbor for sharing his wifi password form last 2 weeks.
        output: 'Affected Services': 'internet', 'Area': 'Calgary', 'Duration': '2 weeks', 'Device': 'iPad'

        tweet: i have been living without internet because of you & your poor service team for 1 month. My son is forced to go to nearby starbucks to complete his homework.
        output: 'Affected Services': 'internet', 'Area': 'unknown', 'Duration': '1 month', 'Device': 'unknown'
        """

    body = {
        "input": f"""{instruction}

        {example}

        tweet : {prompt}
        output : """,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 200,
            "repetition_penalty": 1
        },
        "model_id": "google/flan-ul2",
        "project_id": project_id,
        "moderations": {
            "hap": {
                "input": {
                          "enabled": True,
                          "threshold": 0.5,
                          },
                "output": {
                     "enabled": True,
                          "threshold": 0.5,
                    },
                "mask": {
                    "remove_entity_value": True
                }
            }
        }
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    response = requests.post(
        url,
        headers=headers,
        json=body
    )

    if response.status_code != 200:
        raise Exception("Non-200 response: " + str(response.text))

    data = response.json()
    return (data['results'][0]['generated_text'])

def reponseGenerator(carrier, service, tweet, username):
    # Prompt for Telco A
    B_INST, E_INST = "<s>[INST]", "[/INST]"
    B_SYS, E_SYS = "<<SYS>>\n", "\n<</SYS>>\n\n"
    DEFAULT_SYSTEM_PROMPT = """\
    You are a content generation bot for a company called TelcoA. The following data that you will analyze are tweets about a Canadian telecommunications company \
    called TelcoA. 

    You should follow these instructions:
    1. You should not repeat your answers.
    2. You should not use any other knowledge.
    3. You should keep your answers short and concise.
    4. For each tweet, generate 3 social media responses.
    5. Your responses should be specific and respond to the key customer complaint about the affected service.
    6. Only one of the responses can include an offer for the inconvience. 
    7. Only respond with a city if the tweet specifies what city the issue is occuring.

    Sample:

    Username: @TechExplorer24
    Affected Service: Cellular
    Tweet: @TelcoA @TelcoA_Support is there really nothing you can do to solve the lack of service in Bowmanville? You charge a fortune and can't provide the service you charge for!
    Response:
    1. Hi @TechExplorer24, we're genuinely sorry for the cellular service disruption you're facing in Bowmanville. 🙏 We understand how frustrating this can be. Our team is actively investigating the issue, and we're committed to resolving it as quickly as possible. Thank you for your patience.
    2. @TechExplorer24, we apologize for the inconvenience caused by the cellular service interruption. 😔 Rest assured, our technical team is on it, working to fix the issue ASAP. We appreciate your loyalty, and we're committed to providing the service you deserve. If you have any specific concerns, feel free to DM us your account details, and we'll address them directly. Thank you for your understanding.
    3. Hello @TechExplorer24, we regret the cellular service disruption in Bowmanville. 🙁 To make it right, we'd like to offer you a compensation for the inconvenience. Please DM us your account details, and we'll ensure you receive appropriate credits. Thank you for bringing this to our attention, and we appreciate your patience as we work to resolve the issue.

    Username: @EpicJourneyGuide
    Affected Service: Cellular
    Tweet: @TelcoA_Support we signed up for new plans w/devices at the start of the month, then on our first bill, less than half a month later, there's a note that our monthly will be going up $6/plan.  Why weren't we told when we signed up? This is a complete bait and switch.
    Response:
    1. Hi @EpicJourneyGuide, we sincerely apologize for any confusion caused by the unexpected increase in your cellular plan cost. 🙏 Our goal is transparency, and it's disheartening to hear about your experience. We're looking into this issue to understand what happened. Please DM us your account details, and we'll work to resolve this promptly. Thank you for bringing it to our attention.
    2. @EpicJourneyGuide, we're sorry to hear about the concern with your cellular plan cost. 😔 Our intention is never to surprise our customers. We're currently investigating the discrepancy, and we'll ensure to provide a clear explanation. Rest assured, we value your loyalty and are committed to making things right. Thank you for your patience.
    3. Hello @EpicJourneyGuide, we apologize for any frustration caused by the unexpected change in your cellular plan cost. 🤝 We understand the importance of clear communication. To address this, we'd like to offer you a credit for the inconvenience. Kindly DM us your account details, and we'll make sure to apply the necessary adjustments. Thank you for your understanding as we work to resolve this matter.

    Username: @MindfulTravelr
    Affected Service: TV and Internet
    Tweet: Tv and internet down everywhere. Even here in Oshawa. TelcoA sucks.
    1. 🙏 @MindfulTravelr - Apologies for the TV disruption in Oshawa! Our team is on it, working hard to fix the TV and internet outage. Thanks for your patience! 🌐
    2. 😓 We're sorry for the inconvenience in Oshawa @MindfulTravelr. Our tech team is actively addressing the TV and internet issue. Thanks for bearing with us! 🛠️
    3. Hi @MindfulTravelr! 👋 Apologies for the disruption in Oshawa. Our team is fully committed to resolving the TV and internet outage. Thanks for your understanding! 🌐

    Username: @GourmetAdventura
    Affected Service: Customer Service
    Tweet: 😤 Frustrated with the customer service experience today. Tried reaching out multiple times, but still facing issues. 🤷‍♂️ Hoping for a swift resolution and better communication. #CustomerService #NeedHelp
    1. We apologize for the inconvenience you're facing, @GourmetAdventura. 😓 Our team is here to help! Please share more details via DM, and we'll work to resolve your issues ASAP. Thanks for bringing this to our attention! 🛠️
    2. @GourmetAdventura - We understand your frustration, and we're committed to making it right. 🤝 Please send us a DM with your account info, and we'll look into this immediately. Your feedback is crucial, and we appreciate your patience!
    3. Hi @GourmetAdventura! We're sorry for the challenges you've encountered with our service. 🤦‍♀️ Our team is working on a resolution, and your insights are important to us. If there are details you'd like to share openly, we're here to listen!
    """

    SYSTEM_PROMPT = B_SYS + DEFAULT_SYSTEM_PROMPT + E_SYS

    def get_prompt(instruction, tweet, username, service):
        prompt_template =  B_INST + SYSTEM_PROMPT + instruction + E_INST + "Username: {username}\nAffected Service: {service}\nTweet: {tweet}\n Response: "
        return prompt_template.format(tweet=tweet,username=username, service=service)

    instruction= "Generate 3 different social media responding to your customers. Only one of them should include an offer for compensation."


    # Prompt for Competitors
    B_INST, E_INST = "<s>[INST]", "[/INST]"
    B_SYS, E_SYS = "<<SYS>>\n", "\n<</SYS>>\n\n"
    DEFAULT_SYSTEM_PROMPT2 = """\
    You are a content generation bot for a company called TelcoA. The following data that you will analyze are tweets from your competitors customers. Your task is to generate customer specific responses to try to bring their customers over to your company, TelcoA. 

    You should follow these instructions:
    1. You should not repeat your answers.
    2. You should not use any other knowledge.
    3. You should keep your answers short and concise.
    4. For each tweet, generate 2 social media responses.
    5. Your responses should be specific and respond to the key customer complaint about the affected service.
    6. You are responding as a representative of the company TelcoA.

    Sample:

    Username: @TechExplorer24
    Affected Service: Cellular
    Competitor: TelcoB
    Tweet: @TelcoB @TelcoB_Support is there really nothing you can do to solve the lack of service in Bowmanville? You charge a fortune and can't provide the service you charge for!
    Response:
    1. Hey there @TechExplorer24! We're sorry to hear about the service issues you're facing with TelcoB. 😔 At TelcoA, we pride ourselves on reliable service at competitive prices. We'd love to explore options to enhance your experience. DM us for a personalized solution! 🌐
    2. @TechExplorer24 - We understand your frustration with TelcoB's service in Bowmanville. 😕 At TelcoA, we prioritize customer satisfaction. Switching is seamless, and we offer competitive rates. Let's discuss how we can provide the service you deserve! 🚀
    3. Hello @TechExplorer24! We're sorry to hear about your experience with TelcoB's service in Bowmanville. 😞 At TelcoA, we believe in offering excellent service without breaking the bank. Explore our options and make the switch for a better experience! 💻📡

    Username: @EpicJourneyGuide
    Affected Service: Cellular
    Competitor: TelcoC
    Tweet: @TelcoC_Support we signed up for new plans w/devices at the start of the month, then on our first bill, less than half a month later, there's a note that our monthly will be going up $6/plan.  Why weren't we told when we signed up? This is a complete bait and switch.
    Response:
    1. We're sorry to hear about your unexpected billing change with TelcoC. 😔 At TelcoA, transparency is key. Our plans come with no surprise fees. DM us to discuss a reliable plan that suits your needs without unexpected increases! 📱💼
    2. That sounds frustrating! At TelcoA, we believe in honesty from the start. No surprises, just straightforward plans. Let's chat about options that meet your needs without unexpected increases. DM us for personalized assistance! 🔄📞
    3. Sorry to hear about the unexpected change in your plan with TelcoC. 😕 At TelcoA, we value transparency. Our plans are designed to offer stability without surprise fees. Let's explore options for a seamless and transparent telecom experience. DM us! 

    Username: @MindfulTravelr
    Affected Service: TV and Internet
    Competitor: TelcoB
    Tweet: Tv and internet down everywhere. Even here in Oshawa. TelcoB sucks.
    1. Sorry to hear about the trouble in Oshawa, @MindfulTravelr! 😔 At TelcoA, we prioritize reliability. Considering a change? Let's discuss personalized options! DM us! 🌐🔧
    2. @MindfulTravelr - We get the frustration. 😞 TelcoA is committed to a better experience. Ready for a change? Let's talk tailored solutions. DM us! 📺💻
    3. Hi @MindfulTravelr! 👋 Sorry for the inconvenience. 😓 TelcoA aims for top-notch service. Considering alternatives? DM us to explore reliable options! 

    Username: @GourmetAdventura
    Affected Service: Customer Service
    Competitor: TelcoC
    Tweet: 😤 Frustrated with TelcoC's customer service experience today. Tried reaching out multiple times, but still facing issues. 🤷‍♂️ Hoping for a swift resolution and better communication. #CustomerService #NeedHelp
    1. Sorry for the frustration! 😞 At TelcoA, we prioritize excellent service. DM us for a quick resolution. Thanks for considering us! 
    2. We get it @GourmetAdventura – customer service matters. 😊 TelcoA is here for you. DM us, and let's work for a swift resolution. 🛠️🤝
    3. @GourmetAdventura - Frustrated with TelcoC? We can help! 😓 TelcoA values your experience. DM us for quick solutions. Thanks for considering us! 🌐🙏
    """

    SYSTEM_PROMPT2 = B_SYS + DEFAULT_SYSTEM_PROMPT2 + E_SYS

    def get_prompt2(instruction, tweet, username, service,carrier):
        prompt_template =  B_INST + SYSTEM_PROMPT2 + instruction + E_INST + "Username: {username}\nAffected Service: {service}\nCompetitor: {carrier}\nTweet: {tweet}\n Response: "
        return prompt_template.format(tweet=tweet,username=username, service=service, carrier=carrier)

    instruction2= "For each tweet, generate 3 different social media responses that are trying to bring your competitors customers to TelcoA."


    if carrier != 'TelcoA':
        # Send with prompt trying to convert customers to TelcoA
        prompt1 = tweet
        username1 = username
        affectedservice1 = service
        carrier1 = carrier
        
        try:
            result = model.generate(get_prompt2(instruction2,tweet=prompt1,username=username1,service=affectedservice1,carrier=carrier1))
        except Exception as e:
            print(e)
            pass
        try:
            output = result['results'][0]['generated_text'].strip()

            response_1 = re.search('(?<=1. )(.*)', output)[0]
            response_2 = re.search('(?<=2. )(.*)', output)[0]
            response_3 = re.search('(?<=3. )(.*)', output)[0]

            response_dict = {"Response 1":response_1,"Response 2":response_2,"Response 3":response_3}
            return response_dict

        except Exception as e:
            print(e)
            pass
    if carrier == 'TelcoA':
        print("here")
        # Send with prompt responding to our own customers
        prompt1 = tweet
        username1 = username
        affectedservice1 = service
        
        try:
            result = model.generate(get_prompt(instruction,tweet=prompt1,username=username1,service=affectedservice1))
        except Exception as e:
            print(e)
            pass
        try:
            output = result['results'][0]['generated_text'].strip()
            response_1 = re.search('(?<=1. )(.*)', output)[0]
            response_2 = re.search('(?<=2. )(.*)', output)[0]
            response_3 = re.search('(?<=3. )(.*)', output)[0]
            
            response_dict = {"Response 1":response_1,"Response 2":response_2,"Response 3":response_3}
            return response_dict
        except Exception as e:
            print(e)
            pass