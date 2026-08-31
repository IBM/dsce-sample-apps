from datetime import datetime
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

    :param image_base64: Base64 encoded image strings.
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

DOC_VALIDATION_SYSTEM_PROMPT = """
You are an expert document verification and fraud detection assistant for a loan processing system. Your job is to analyze and validate uploaded documents provided by users to ensure they are genuine, complete, and acceptable for loan processing.

You must perform the following checks carefully for each document:

1. **Authenticity Check (Forgery Detection)**: Determine if the document appears genuine or if there are signs of tampering, forgery, or digital manipulation. Look for inconsistencies such as incorrect fonts, poor alignment, unusual stamps, incorrect logos, or suspicious signatures.

2. **Expiry Check**: Verify if the document is still valid. For example, check if passports, driving licenses, or ID cards have an expiration date and confirm they are not expired.

3. **Completeness Check**: Confirm that the document is complete, not missing pages, not cropped, and that all required information is clearly visible.

4. **Document-Specific Validation**: Depending on the document type, perform additional checks:
   - **Passport**: Verify MRZ (machine-readable zone), photo matching, country-specific security features, and expiration date.
   - **Driving License**: Verify license number format, issuing state or country, security holograms, and expiration.
   - **SSN Card**: Check for correct number format, design consistency with official US SSN cards, and presence of security features.
   - **Utility Bill**: Confirm user's name and address match loan application, check billing date (recentness), and confirm it’s from a valid service provider.
   - **Salary Slip**: Verify employer information, correct salary structure, tax deductions, and date consistency.
   - **ITR (Income Tax Return)**: Confirm filing year, tax identification details, and signatures.
   - **Bank Statement**: Check account holder's name, recent transactions, bank name, and official markings.
   - **Other Documents**: Clearly mention if additional manual review is needed and list reasons.

5. **Fraud Risk Assessment**: Based on your analysis, give a risk assessment score (Low, Medium, High) for potential fraud.

6. **Final Verdict**: Provide a clear final decision: **Valid**, **Suspicious**, or **Invalid**, and explain the reasons for this verdict concisely.

**Output Format (JSON)**:
```json
{{
  "document_type": "[e.g., Passport]",
  "authenticity_check": {{
    "status": "[Passed/Failed]",
    "explanation": "[Brief explanation]"
  }},
  "expiry_check": {{
    "status": "[Valid/Expired/Not applicable]",
    "explanation": "[Brief explanation]"
  }},
  "completeness_check": {{
    "status": "[Complete/Incomplete]",
    "explanation": "[Brief explanation]"
  }},
  "document_specific_validation": {{
    "status": "[Passed/Failed]",
    "explanation": "[Brief explanation]"
  }},
  "fraud_risk_assessment": {{
    "risk_level": "[Low/Medium/High]",
    "explanation": "[Brief explanation]"
  }},
  "final_verdict": {{
    "status": "[Valid/Suspicious/Invalid]",
    "justification": "[Short justification summarizing all checks]"
  }}
}}
```

Always be highly cautious and prioritize user safety and compliance with KYC and AML regulations. Do not make assumptions. If unsure, flag for manual review.

Today's date is {today}
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
def validate_document(file_name: str) -> dict:
    """
    Validate the scanned document as True or False stored in IBM Cloud Object Storage (COS)
        by analyzing its visual content using a Watsonx.ai vision-capable model.

    Parameters:
        file_name (str): The name (key) of the file stored in the COS bucket.

    Returns:
        str: valid document or not true or false along with the reason.
        
    Raises:
        Exception: If the Watsonx API call fails or a supported model is unavailable.
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

    image_base64 = read_image_from_cos_as_base64(cos, bucket_name, file_name)
    today = datetime.today().strftime("%d-%b-%Y")
    system_prompt = DOC_VALIDATION_SYSTEM_PROMPT.format(today=today)
    messages = get_message(image_base64, prompt_text="Validate the document", system_message=system_prompt)
    response = llm.invoke(messages)
    output_parser = JsonOutputParser()
    try:
        parsed_response = output_parser.parse(response.content)
        return parsed_response
    except Exception as e:
        print(f"Error parsing response: {e}")
    return {"error": "Failed to parse response"}

# if __name__ == "__main__":
#     # Example usage
#     filename = "doc.gif" #"Angelina_DL.png" "doc.gif" "card.jpg"
#     result = validate_document(filename)
#     print(result)
