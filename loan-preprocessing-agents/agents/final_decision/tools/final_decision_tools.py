import json
import ibm_boto3
from datetime import datetime
from ibm_botocore.client import Config
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.run import connections
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials

def read_json_from_cos(cos, bucket_name: str, json_filepath: str) -> str:
    """
    Reads a JSON file from COS and returns its content as a string.

    Args:
        bucket_name (str): The name of the bucket.
        json_filepath (str): The path to the JSON file in the bucket.

    Returns:
        str: The content of the JSON file as a string.
    """
    response = cos.get_object(Bucket=bucket_name, Key=json_filepath)
    json_content = response['Body'].read().decode("utf-8")
    return json_content

@tool
def calculate_years(date_str: str) -> int:
    """
    Calculate the number of full years from the given date to today.

    Args:
        date_str (str): Date in YYYY-MM-DD format.

    Returns:
        int: Number of years.
    """
    try:
        dob = datetime.strptime(date_str, "%Y-%m-%d")
        today = datetime.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except ValueError as e:
        raise ValueError(f"Invalid date format: {date_str}. Expected 'YYYY-MM-DD'. {e}")
    
@tool(
    expected_credentials=[
        ExpectedCredentials(
            app_id = "cos_credential",
            type = ConnectionType.KEY_VALUE
        )
    ]
)
def read_loan_application(filename: str) -> dict:
    """
    Reads a loan application JSON file from COS and returns its content as a dictionary.

    Args:
        filename (str): The path to the JSON file in the bucket.

    Returns:
        dict: The content of the JSON file as a dictionary.
    """
    cos_creds = connections.key_value("cos_credential")
    bucket_name = cos_creds["COS_BUCKET_NAME"]

    cos = ibm_boto3.client("s3",
        ibm_api_key_id=cos_creds["COS_API_KEY"],
        ibm_service_instance_id=cos_creds["COS_SERVICE_INSTANCE_ID"],
        config=Config(signature_version="oauth"),
        endpoint_url=cos_creds["COS_ENDPOINT"]
    )
    json_content = read_json_from_cos(cos, bucket_name, filename)
    return json.loads(json_content) if json_content else {}

