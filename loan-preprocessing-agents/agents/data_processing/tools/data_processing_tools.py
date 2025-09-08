import ibm_boto3
import base64
import mimetypes
from ibm_botocore.client import Config
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from langchain_ibm import ChatWatsonx
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from ibm_watsonx_orchestrate.run import connections
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials

def read_image_from_cos_as_base64(cos, bucket_name: str, image_filepath: str) -> str:
    """
    Reads an image file from COS and returns its content as a Base64-encoded data URI.

    Args:
        bucket_name (str): The name of the bucket.
        image_filepath (str): The path to the image file in the bucket.

    Returns:
        str: The Base64-encoded data URI of the image (e.g., "data:image/png;base64,...").
    """
    response = cos.get_object(Bucket=bucket_name, Key=image_filepath)
    image_bytes = response['Body'].read()
    base64_encoded = base64.b64encode(image_bytes).decode("utf-8")
    mime_type, _ = mimetypes.guess_type(image_filepath)
    if mime_type is None:
        mime_type = "image/png"
    return f"data:{mime_type};base64,{base64_encoded}"

def get_message(
    image_base64,
    prompt_text: str,
    system_message: str = ""
) :
    """
    Build a message list with the given image and prompt text.
    If a system message is provided, it is prepended to the message list.

    :param image_base64: List of Base64 encoded image strings (or [] if no image is provided).
    :param prompt_text: The text prompt.
    :param system_message: An optional system message.
    :return: A list of messages (SystemMessage and HumanMessage).
    """
    content = [{"type": "text", "text": prompt_text}]
    content.append({
        "type": "image_url",
        "image_url": {"url": image_base64}
    })
    message = HumanMessage(content=content)
    if system_message:
        sys_message = SystemMessage(content=system_message)
        return [sys_message, message]
    return [message]


WATSONX_CONFIG = {
    "model_id": "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
    "params": {
        "max_tokens": 1000,
        "temperature": 0.0,
        "top_p": 0.1,
    }
}


DOC_CF_SYSTEM_PROMPT = """
You are a helpful document classification assistant. You will be given an image of a document. Your task is to carefully analyze the visual and textual content of the document to determine its type.

The possible types are:
    * Driving License
    * Passport
    * SSN (Social Security Number card)
    * Utility Bill
    * Salary Slip
    * ITR (Income Tax Return)
    * Bank Account Statement
    * Others (if it does not match any of the above types)

Based on the layout, text, and any visible clues, classify the document into one of these types.
Return your answer strictly in the following JSON format (without any extra text):

```
{
  "doc_type": "<document type>"
}
```

Replace `<document type>` with one of the above options exactly as written.
"""

DOC_EXTRACTION_SYSTEM_PROMPT = """
You are a highly skilled information extraction assistant.
You will be given an image of a document. Your task is to carefully analyze the visual and textual content of the document and extract all available personal information.

Specifically, extract details such as (if present):
 - Name
 - Address
 - Date of Birth (DOB)
 - Gender
 - Document Number (e.g., passport number, license number, SSN)
 - Nationality
 - Issuing authority
 - Date of issue and expiry
 - Any other identifiable personal information visible in the document

All the dates should be extracted in the format YYYY-MM-DD.
For document number, the json key should be respective to the document type (e.g., "passport_number", "driving_license_number", etc.).
Only include information explicitly present on the document. If a field is not found, omit it from the output.
Return the extracted information strictly in a JSON format, for example:

```json
{
  "name": "John Doe",
  "address": "123 Main Street, Springfield, IL, USA",
  "dob": "1990-05-15",
  "gender": "Male",
  "document_number": "X1234567",
  "nationality": "USA",
  "issuing_authority": "US Department of State",
  "issue_date": "2015-04-10",
  "expiry_date": "2025-04-10"
}
```

If any information is missing, do not include that key in the JSON.
Provide only the JSON object as the output, with no additional text.
"""

@tool(
    expected_credentials=[
        ExpectedCredentials(
            app_id = "wxai_credential",
            type = ConnectionType.KEY_VALUE
        ),
        ExpectedCredentials(
            app_id = "cos_credential",
            type = ConnectionType.KEY_VALUE
        )
    ]
)
def classify_document(filename: str) -> dict:
    """
    Classifies a document image into a predefined document type.

    This function takes the filename of an image file as input, analyzes its contents
    (both visual and textual), and determines which type of document it is.
    The possible document types are:
        - Driving License
        - Passport
        - SSN
        - Utility Bill
        - Salary Slip
        - ITR (Income Tax Return)
        - Bank Account Statement
        - Others (if it does not match any of the above types)

    Args:
        filename (str): The path to the document image file.

    Returns:
        dict: A JSON-style dictionary containing a single key "doc_type" with the
              value being one of the document types listed above.
    """
    wxai_creds = connections.key_value("wxai_credential")
    cos_creds = connections.key_value("cos_credential")

    cos = ibm_boto3.client("s3",
        ibm_api_key_id=cos_creds["COS_API_KEY"],
        ibm_service_instance_id=cos_creds["COS_SERVICE_INSTANCE_ID"],
        config=Config(signature_version="oauth"),
        endpoint_url=cos_creds["COS_ENDPOINT"]
    )

    llm = ChatWatsonx(
        model_id=WATSONX_CONFIG["model_id"],
        apikey=wxai_creds["WATSONX_APIKEY"],
        url=wxai_creds["WATSONX_URL"],
        project_id=wxai_creds["WATSONX_PROJECT_ID"],
        params=WATSONX_CONFIG["params"],
    )

    bucket_name = cos_creds["COS_BUCKET_NAME"]

    image_base64 = read_image_from_cos_as_base64(cos, bucket_name, filename)
    messages = get_message(image_base64, prompt_text="Classify this document", system_message=DOC_CF_SYSTEM_PROMPT)
    response = llm.invoke(messages)
    output_parser = JsonOutputParser()
    try:
        parsed_response = output_parser.parse(response.content)
        parsed_response["filename"] = filename
        return parsed_response
    except Exception as e:
        print(f"Error parsing response: {e}")
    return {"error": "Failed to parse response"}

@tool(
    expected_credentials=[
        ExpectedCredentials(
            app_id = "wxai_credential",
            type = ConnectionType.KEY_VALUE
        ),
        ExpectedCredentials(
            app_id = "cos_credential",
            type = ConnectionType.KEY_VALUE
        )
    ]
)
def extract_document_info(filename: str) -> dict:
    """
    Extracts personal information from a document image.
    This function takes the filename of an image file as input, analyzes its contents
    (both visual and textual), and extracts all available personal information.
    
    Args:
        filename (str): The path to the document image file.

    Returns:
        dict: A JSON-style dictionary containing the extracted personal information.
    """
    wxai_creds = connections.key_value("wxai_credential")
    cos_creds = connections.key_value("cos_credential")

    cos = ibm_boto3.client("s3",
        ibm_api_key_id=cos_creds["COS_API_KEY"],
        ibm_service_instance_id=cos_creds["COS_SERVICE_INSTANCE_ID"],
        config=Config(signature_version="oauth"),
        endpoint_url=cos_creds["COS_ENDPOINT"]
    )

    llm = ChatWatsonx(
        model_id=WATSONX_CONFIG["model_id"],
        apikey=wxai_creds["WATSONX_APIKEY"],
        url=wxai_creds["WATSONX_URL"],
        project_id=wxai_creds["WATSONX_PROJECT_ID"],
        params=WATSONX_CONFIG["params"],
    )

    bucket_name = cos_creds["COS_BUCKET_NAME"]

    image_base64 = read_image_from_cos_as_base64(cos, bucket_name, filename)
    messages = get_message(image_base64, prompt_text="Extract personal information from this document", system_message=DOC_EXTRACTION_SYSTEM_PROMPT)
    response = llm.invoke(messages)
    output_parser = JsonOutputParser()
    try:
        parsed_response = output_parser.parse(response.content)
        parsed_response["filename"] = filename
        return parsed_response
    except Exception as e:
        print(f"Error parsing response: {e}")
    return {"error": "Failed to parse response"}

# if __name__ == "__main__":
#     # Example usage
#     filename = "doc.gif" # "Angelina_DL.png" "doc.gif" "card.jpg"
#     result = classify_document(filename)
#     print(result)
#     result = extract_document_info(filename)
#     print(result)