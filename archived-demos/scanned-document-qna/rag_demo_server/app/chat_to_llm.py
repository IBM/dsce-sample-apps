import os, time

from app import flask_app
from app.util import create_path_dict, get_filename_without_extension
from ibm_watsonx_ai.foundation_models import Model
from ibm_watsonx_ai.foundation_models.extractions import TextExtractions
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams, TextExtractionsMetaNames as TextExtParams
from ibm_watsonx_ai.helpers import DataConnection, S3Location
from ibm_watsonx_ai import Credentials
from dotenv import load_dotenv


QUESTION = "Which Transactions are with credit of 100.00 ?"
MODEL_70B = "meta-llama/llama-2-70b-chat"
MODEL_13B = "meta-llama/llama-2-13b-chat"
# MODEL_FALCON = "ibm/falcon-40b-8lang-instruct"
MODEL_GRANITE_13B = "ibm/granite-13b-sft"
MODEL_GRANITE_13B_CFT = "ibm/granite-13b-sft-cft"
MAX_NEW_TOKENS = 500

load_dotenv()


model_for_image = create_path_dict()
SERVER_URL = os.getenv("SERVER_URL")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
WX_CONNECTION_ASSET_ID = os.getenv("WX_CONNECTION_ASSET_ID")
WX_TXT_EXT_BUCKET_NAME = os.getenv("WX_TXT_EXT_BUCKET_NAME")
WX_TXT_EXT_RESULT_RETRY_COUNT = int(os.getenv("WX_TXT_EXT_RESULT_RETRY_COUNT"))
WX_TXT_EXT_RESULT_WAIT_IN_SEC = float(os.getenv("WX_TXT_EXT_RESULT_WAIT_IN_SEC"))
WX_TXT_EXT_RESULT_FILEPATH = os.getenv("WX_TXT_EXT_RESULT_FILEPATH")

def get_text_for_image(image_name, extraction):
    key = get_filename_without_extension(image_name)
    if key in model_for_image and extraction.lower() in model_for_image[key]:
        text_file_path = model_for_image[key][extraction.lower()]
        try:
            with open(text_file_path, 'r', encoding='utf-8') as file:
                text = file.read()
            return text
        except FileNotFoundError:
            print("FileNotFoundError for ", text_file_path)
            return None
    else:
        return None


def make_prompt(instruction, input_, output="", model_name=''):
    if 'llama' in model_name:
        return "{0}\n\n{1}\n{2}\n\n{3}\n{4}\n\n{5}\n{6}".format(
            "[INST] Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.",
            "### Instruction:",
            instruction,
            "### Input:",
            input_,
            "[/INST]",
            output
        )
    else:
        return "{0}\n\n{1}\n{2}\n\n{3}\n{4}\n\n{5}\n{6}".format(
            "Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.",
            "### Instruction:",
            instruction,
            "### Input:",
            input_,
            "### Response:",
            output
        )

def send_hello_world_prompt(api_key, model_name=MODEL_GRANITE_13B):
    load_dotenv()
    params = {
                GenParams.MAX_NEW_TOKENS: MAX_NEW_TOKENS,
                GenParams.Temperature: 0.05,
                GenParams.DECODING_METHOD: "sample"
            }
    prompts = 'This is a test'
    

    model = Model(
        model_id=model_name,
        params=params,
        credentials=Credentials(
                        api_key = api_key,
                        url = SERVER_URL),
        project_id=WATSONX_PROJECT_ID
    )

    generated_response = model.generate_text_stream(prompt=prompts)
    for response in generated_response:
        print(response, end=" ")


def process_text_file(model_name, image_name, extraction, question, api_key):
    load_dotenv()
    print('Step 1')
    text_file_path = model_for_image[get_filename_without_extension(image_name)][extraction.lower()]
    print('Step 2')
    params = {
                GenParams.MAX_NEW_TOKENS: MAX_NEW_TOKENS,
                GenParams.TEMPERATURE: 0.05,
                GenParams.DECODING_METHOD: "sample"
            }
 
    print('Step 3')
    with open(os.path.join(flask_app.config['STATIC'], 'instruction.txt'), 'r') as file:
        instruction = file.read()
        instruction += '2. ' + question

    with open(text_file_path, 'r') as file:
        textual_representation = file.read()

    prompt = make_prompt(instruction, textual_representation, output="")
    print('-------')
    print(f'prompt = {prompt}')

    prompts = prompt
    print('Step 4')

    model = Model(
                model_id=model_name,
                params=params,
                credentials=Credentials(
                                api_key = api_key,
                                url = SERVER_URL),
                project_id=WATSONX_PROJECT_ID
            )
    generated_response = model.generate_text_stream(prompt=prompts)
    print('Step 5')
    print(generated_response)
    for response in generated_response:
        for character in response:
            yield f"{character}".encode('utf-8')

############## Text Extraction ##############

def run_text_ext(image_name, api_key, results_format="markdown", languages_list=["en"], process_image=True, table_processing=True):
    # Instantiate the Text Extraction service
    extraction = TextExtractions(
     credentials=Credentials(
                         api_key = api_key,
                         url = SERVER_URL),
     project_id=WATSONX_PROJECT_ID
    )

    # reference to the document in the bucket from which text will be extracted
    document_reference = DataConnection(
        connection_asset_id=WX_CONNECTION_ASSET_ID,
        location=S3Location(bucket=WX_TXT_EXT_BUCKET_NAME, path=image_name),
    )

    # Prepare output filename
    file_name_wo_ext = get_filename_without_extension(image_name)
    output_filename = file_name_wo_ext+".iocr_parse.txt"

    # reference to the location in the bucket where results will saved
    results_reference = DataConnection(
        connection_asset_id=WX_CONNECTION_ASSET_ID,
        location=S3Location(bucket=WX_TXT_EXT_BUCKET_NAME, path=output_filename),
    )

    # Start a request to extract text and metadata from a document
    run_job_reponse = extraction.run_job(
        document_reference=document_reference,
        results_reference=results_reference,
        steps = {
            TextExtParams.OCR: {
                "process_image": process_image,
                "languages_list": languages_list,
            },
            TextExtParams.TABLE_PROCESSING: {"enabled": table_processing},
        },
        results_format=results_format,
    )

    # Get the unique ID of a extraction request
    extraction_id = extraction.get_id(run_job_reponse)
    # Return text extraction job details
    job_detls = extraction.get_job_details(extraction_id)
    # job status
    status = job_detls["entity"]["results"]["status"]

    # Check status of job till "completed" or retry count exceeded.
    # Wait for provided number of seconds before a next attempt of status check.
    retry_count = WX_TXT_EXT_RESULT_RETRY_COUNT
    while status != "failed" and retry_count > 0:
        print(time.time(),"extraction_job_result_check trial: ", retry_count)
        time.sleep(WX_TXT_EXT_RESULT_WAIT_IN_SEC)
        retry_count -= 1
        job_detls = extraction.get_job_details(extraction_id)
        status = job_detls["entity"]["results"]["status"]
        if(status == "completed"):
            break
    
    # If job is completed, download the file from COS to the provided local path.
    if(status == "completed"):
        print("completed")
        results_reference_data_conn = extraction.get_results_reference(extraction_id)
        results_reference_data_conn.download(os.path.join(WX_TXT_EXT_RESULT_FILEPATH,output_filename))
    else:
        print("Some error occured. jobstatus:", status)

    return dict(id=extraction_id, status=status)