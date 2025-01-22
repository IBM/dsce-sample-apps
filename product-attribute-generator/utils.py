import base64
import os
from dotenv import load_dotenv
from ibm_watsonx_ai.foundation_models import Model
from ibm_watsonx_ai.foundation_models.schema import TextChatParameters
import pandas as pd
import json
import re
from bs4 import BeautifulSoup
import logging
import cloudscraper
import hashlib
import datetime

load_dotenv()

DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
LOG_MODE=logging.INFO
if DEBUG_MODE == "True":
    LOG_MODE= logging.INFO
else:
    LOG_MODE= logging.ERROR
# Configure Logging
logging.basicConfig(
    #filename="app.log",  # Log file name
    level=LOG_MODE,  # Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(levelname)s - %(message)s",  # Log format
)
logger = logging.getLogger(__name__)

def hash_file(file_name):
    h = hashlib.sha1()
    try:
        with open(file_name, "rb") as file:
            chunk = 0
            while chunk != b'':
                chunk = file.read(1024)
                h.update(chunk)
    except FileNotFoundError:
        logger.error(f"Error: File '{file_name}' not found.")
        return None
    return h.hexdigest()

# Predefined static file hashes
static_file_hashes = [
    hash_file('static/product-1-1.jpg'),
    hash_file('static/product-1-2.jpg'),
    hash_file('static/product-1-3.jpg'),
    hash_file('static/product-1-4.jpg'),
    hash_file('static/product-1-5.jpg'),
    hash_file('static/product-2-1.jpg'),
    hash_file('static/product-2-2.jpg'),
    hash_file('static/product-2-3.jpg'),
    hash_file('static/product-2-4.jpg'),
    hash_file('static/product-3-1.jpg'),
    hash_file('static/product-3-2.jpg'),
    hash_file('static/product-3-3.jpg'),
    hash_file('static/product-3-4.jpg'),
    hash_file('static/product-3-5.jpg'),
    hash_file('static/product-3-6.jpg'),
]

# To store the hashes of the static files
def validate_uploaded_files_with_hash(file_path):


    if not file_path:
        logger.error("Error: No file path provided.")
        return False

    # Compute the hash for the uploaded image file
    uploaded_file_hash = hash_file(file_path)
    if uploaded_file_hash is None:
        return False

    # Compare the hash with the predefined static file hashes
    if uploaded_file_hash in static_file_hashes:
        logger.info("Uploaded file hash matches a static file hash.")
        return True

    logger.error("No matching hash found for the uploaded file.")
    return False


# Set model parameters to be deterministic
generate_params = TextChatParameters(
    temperature=0,
    max_tokens=1500
)



def get_category_attributes_from_llm(category):
    """Fetch attributes dynamically for the identified category using LLM."""
    get_category_attributes_from_llm_start = datetime.datetime.now()
    api_key = os.getenv("IBM_API_KEY")
    service_url = os.getenv("IBM_SERVICE_URL")
    project_id = os.getenv("IBM_PROJECT_ID")
    granite_model = os.getenv("GRANITE_MODEL")

    if not api_key or not service_url or not project_id:
        logger.error("API key, service URL, and project ID must be set as environment variables.")
        return None

    model = Model(
        model_id=granite_model,
        credentials={"api_key": api_key, "url": service_url},
        params={"decoding_method": "greedy", "max_new_tokens": 1500, "repetition_penalty": 1},
        project_id=project_id
    )

    # Define the LLM prompt to fetch attributes
    prompt = f"""
    You are an AI model designed to identify metadata attributes. 
    Given the product category '{category}', list all possible relevant attributes/metadata for this category in a JSON format.
    Example:
    {{
        "Attribute1": "Description of Attribute1",
        "Attribute2": "Description of Attribute2",
        "Attribute3": "Description of Attribute3"
    }}
    Remember only give the json and do not include anything pre or post.
    """

    response = model.generate(prompt=prompt)
    #print(response)

    if 'results' in response and len(response['results']) > 0:
        try:
            attributes_json = clean_and_parse_json(response['results'][0]['generated_text'])
            #print(attributes_json)
            get_category_attributes_from_llm_end = datetime.datetime.now()
            print("Fetch attributes dynamically call: ",get_category_attributes_from_llm_end-get_category_attributes_from_llm_start)
            return attributes_json
        except Exception as e:
            logger.error(f"Failed to parse attributes from LLM: {e}")
            return None
    else:
        logger.error("Failed to fetch attributes from LLM.")
        return None


def combine_metadata(records):
    """Combine metadata records and remove duplicates."""
    print(records)
    combined_df = pd.DataFrame()
    for record in records:
        record_df = pd.DataFrame.from_dict(record, orient="index", columns=["Description"]).reset_index()
        record_df.columns = ["Feature", "Description"]
        combined_df = pd.concat([combined_df, record_df], ignore_index=True)

    # Remove duplicates based on "Feature" column
    combined_df.drop_duplicates(subset=["Feature"], inplace=True)
    return combined_df.reset_index(drop=True)


def load_prompt(file_name, category=None):
    """Load a prompt file and dynamically inject attributes based on category."""
    try:
        with open(file_name, 'r') as file:
            prompt = file.read().strip()

        if category:
            # Fetch attributes dynamically from LLM
            attributes = get_category_attributes_from_llm(category)
            if attributes:
                attribute_list = ", ".join(attributes.keys())  # Convert attribute names to a string
                prompt = prompt.replace("{{category}}", category)
                prompt = prompt.replace("{{attributes}}", attribute_list)
                return prompt
            else:
                logger.error(f"Failed to retrieve attributes for category '{category}'.")
        return prompt
    except FileNotFoundError:
        logger.error(f"The '{file_name}' file was not found. Please ensure it exists in the app directory.")
        return None
    
    
def parse_description_to_table(description):
    """Parse and flatten JSON description into a DataFrame for display."""
    # Use the updated clean_and_parse_json to parse the response text
    metadata = clean_and_parse_json(description)
    if metadata:
        # Flatten any nested structures dynamically
        def flatten_dict(d, parent_key='', sep='_'):
            items = []
            for k, v in d.items():
                new_key = f"{parent_key}{sep}{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(flatten_dict(v, new_key, sep=sep).items())
                elif isinstance(v, list):
                    # Convert lists to comma-separated strings
                    items.append((new_key, ', '.join(map(str, v))))
                else:
                    items.append((new_key, v))
            return dict(items)

        # Flatten the JSON metadata
        flat_metadata = flatten_dict(metadata)

        # Standardize and clean the data for display
        data = [{"Feature": key, "Description": str(value)} for key, value in flat_metadata.items()]
        return pd.DataFrame(data)
    else:
        # Return an empty DataFrame if parsing fails
        return pd.DataFrame(columns=["Feature", "Description"])
    
    
    
def flatten_json(nested_json):
    """
    Flatten a nested JSON dictionary.
    Converts nested structures into flat key-value pairs.
    """
    flat_json = {}

    def _flatten(obj, parent_key=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                new_key = f"{parent_key}_{k}" if parent_key else k
                _flatten(v, new_key)
        else:
            flat_json[parent_key] = obj

    _flatten(nested_json)
    return flat_json


def clean_and_parse_json(response_text):
    """
    Extract, clean, and parse JSON from LLM response.
    Handles nested structures by flattening them.
    """
    try:
        # Step 1: Remove Markdown-style JSON block markers
        response_text = re.sub(r"```json|```", "", response_text).strip()

        # Step 2: Extract JSON block
        json_match = re.search(r"{[\s\S]*}", response_text)
        if not json_match:
            logger.error("❌ No valid JSON block found in the response.")
            return {}

        cleaned_text = json_match.group(0)

        # Step 3: Remove trailing commas before closing braces
        cleaned_text = re.sub(r",\s*(\}|\])", r"\1", cleaned_text)

        # Step 4: Parse the cleaned JSON
        try:
            parsed_json = json.loads(cleaned_text)

            # Step 5: Flatten nested structures
            if isinstance(parsed_json, dict):
                parsed_json = flatten_json(parsed_json)
            return parsed_json
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON decoding failed: {e}")
            logger.info("Cleaned JSON string for reference:", cleaned_text)
            return {}

    except Exception as e:
        logger.error(f"❌ Unexpected error during JSON parsing: {e}")
        return {}



def prepare_image_for_encoding(image_bytes):
    """Convert image to Base64 format in a consistent manner."""
    return base64.b64encode(image_bytes.getvalue()).decode('utf-8')

def fetch_and_refine_html_content(url):
    """Fetch HTML content from a URL using cloudscraper to bypass CAPTCHA and refine content."""
    try:
        # Create a cloudscraper instance
        scraper = cloudscraper.create_scraper()
        
        # Fetch the webpage
        response = scraper.get(url)
        
        # Check the response
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            refined_content = soup.get_text(separator=' ', strip=True)

            # Check for common block messages
            block_indicators = [
                "Please enable JavaScript",
                "Access Denied",
                "You have been blocked",
                "CAPTCHA",
                "Cloudflare",
                "DDoS protection",
                "Unauthorized access",
                "Forbidden",
                "Error 403",
                "Verify you are human",
                "Request blocked",
                "Suspicious activity detected",
                "Bot detection",
                "Security challenge",
                "Blocked by server",
                "Connection limit exceeded",
                "Rate limit exceeded",
                "Error 503",
                "Temporary unavailable"
            ]

            if any(indicator in refined_content for indicator in block_indicators):
                logger.error("Website blocked crawling. Possible reasons include CAPTCHA or server-side blocking.")
                return None

            return refined_content
        else:
            logger.error(f"Failed to fetch URL. HTTP Status Code: {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"An error occurred while fetching the URL: {e}")
        return None

def process_url_content(url):
    """Fetch, refine, and replace HTML content into the prompt file."""
    logger.info("process_url_content: %s", url)  # URL input
    content = fetch_and_refine_html_content(url)
    # checkContent = "Please enable JavaScript on your browser."
    # if content == checkContent:
    #     logger.error("Website Blocked Crawling, \n Reason : ", content)
    #     return None
    #elif content:
    if content:
        prompt_file = "./prompts/prompt_link.txt"
        output_file = "./generated_prompts/final_prompt_for_link.txt"
        try:
            with open(prompt_file, 'r') as file:
                prompt_text = file.read()
            # Replace the placeholder with the fetched content
            updated_prompt = prompt_text.replace("{{content}}", content)
            with open(output_file, 'w') as file:
                file.write(updated_prompt)
            #logger.success("Final prompt saved to 'final_prompt_for_link.txt'.")
            return updated_prompt
        except FileNotFoundError:
            logger.error(f"The '{prompt_file}' file was not found. Please ensure it exists.")
            return None
    else:
        return None

def get_category(encoded_image):
    """Send image to LLM to find its category using prompt-category.txt."""
    print("get_category: Start")
    get_category_start = datetime.datetime.now()
    api_key = os.getenv("IBM_API_KEY")
    service_url = os.getenv("IBM_SERVICE_URL")
    project_id = os.getenv("IBM_PROJECT_ID")
    vision_model_large = os.getenv("VISION_MODEL_LARGE")
    vision_model_small = os.getenv("VISION_MODEL_SMALL")

    model = Model(
        model_id=vision_model_large,
        params=generate_params,
        credentials={"api_key": api_key, "url": service_url},
        project_id=project_id
    )

    prompt_text = load_prompt("./prompts/prompt-category.txt")
    if not prompt_text:
        return None

    message_content = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded_image}"}}
            ]
        }
    ]
    
    model11 = Model(
        model_id=vision_model_small,
        params=generate_params,
        credentials={"api_key": api_key, "url": service_url},
        project_id=project_id
    )

    response = model.chat(messages=message_content)
    
    if 'choices' in response and len(response['choices']) > 0:
        modelCategoryRespose = response['choices'][0]['message']['content'].strip()
        #logger.info(modelCategoryRespose)
        if "not" in modelCategoryRespose.lower() or "unable" in modelCategoryRespose.lower() or "don't" in modelCategoryRespose.lower() or "can't" in modelCategoryRespose.lower() or "stop" in modelCategoryRespose.lower():
            response = model11.chat(messages=message_content)
            #logger.info("Calling LLama Vision 11B Model to fetch category")
            #logger.info(response['choices'][0]['message']['content'].strip())
        
        get_category_end = datetime.datetime.now()
        print("Get category call: ",get_category_end-get_category_start)
        return response['choices'][0]['message']['content'].strip()
    else:
        logger.error("Unable to determine category.")
        return None
def generate_llm_response_for_url(prompt_text):
    """Call LLM using the refined prompt text for the URL content."""
    print("Get URL metadata call: Start")
    get_url_response_start = datetime.datetime.now()
    api_key = os.getenv("IBM_API_KEY")
    service_url = os.getenv("IBM_SERVICE_URL")
    project_id = os.getenv("IBM_PROJECT_ID")
    granite_model = os.getenv("GRANITE_MODEL")

    if not api_key or not service_url or not project_id:
        logger.error("API key, service URL, and project ID must be set as environment variables.")
        return None

    model = Model(
        model_id=granite_model,
        credentials={"api_key": api_key, "url": service_url},
        params={"repetition_penalty": 1, "max_new_tokens": 1500},
        project_id=project_id
    )

    response = model.generate(prompt=prompt_text)
    #print(json.dumps(response, indent=4))
    if 'results' in response and len(response['results']) > 0:
        get_url_response_end = datetime.datetime.now()
        print("Get URL metadata call: ",get_url_response_end-get_url_response_start)
        return response['results'][0]['generated_text']
    else:
        logger.error("No response generated from LLM.")
        return None


def get_image_metadata(encoded_image, category):
    """Send image and category to LLM to retrieve metadata."""
    get_image_metadata_start = datetime.datetime.now()
    api_key = os.getenv("IBM_API_KEY")
    service_url = os.getenv("IBM_SERVICE_URL")
    project_id = os.getenv("IBM_PROJECT_ID")
    vision_model_large = os.getenv("VISION_MODEL_LARGE")

    model = Model(
        model_id=vision_model_large,
        credentials={"api_key": api_key, "url": service_url},
        params=generate_params,
        project_id=project_id
    )

    prompt_text = load_prompt("./prompts/prompt.txt", category)
    if not prompt_text:
        return None

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded_image}"}}
            ]
        }
    ]
    output_file_prompt = "./generated_prompts/final_prompt_for_attributes.txt"
    try:
        with open(output_file_prompt, "w") as file:
            file.write("Message Content:\n")
            file.write(json.dumps(messages, indent=4))
        #logger.info(f"Final prompt saved to '{output_file_prompt}'.")
    except Exception as e:
        logger.error(f"Failed to save the final prompt: {e}")

    response = model.chat(messages=messages)
    if 'choices' in response and len(response['choices']) > 0:
        #logger.error(response['choices'][0]['message']['content'])
        get_image_metadata_end = datetime.datetime.now()
        print("Get image metadata call: ",get_image_metadata_end-get_image_metadata_start)
        return response['choices'][0]['message']['content']
    else:
        return "No metadata available."
