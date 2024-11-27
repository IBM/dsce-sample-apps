# import logging
import logging
import os
import json
from functools import wraps

from flask import request, jsonify
from flask import send_from_directory, Response
from flask import stream_with_context
from flask_cors import cross_origin

from app import current_env, flask_app, CONFIG
from app.chat_to_llm import process_text_file, get_text_for_image, send_hello_world_prompt, run_text_ext
from app.util import get_last_user_message

API_KEY = os.getenv("WATSONX_API_KEY")


def root_dir():  # pragma: no cover
    return os.path.abspath(os.path.dirname(__file__))


def get_file(filename):  # pragma: no cover
    try:
        src = os.path.join(root_dir(), "static", filename)
        return open(src).read()
    except IOError as exc:
        return str(exc)


if current_env == 'prod':
    @flask_app.route('/')
    @cross_origin()
    def index():
        return flask_app.send_static_file('index.html')


    @flask_app.route('/', defaults={'path': ''})
    @flask_app.route('/<path:path>')
    def catch_all(path):
        return 'You want path: %s' % path


    @flask_app.errorhandler(404)
    def not_found(e):
        return flask_app.send_static_file('index.html')


@flask_app.route('/static/images/<path:path_to_image>')
@cross_origin()
def send_js(path_to_image):
    print("Tryigng to access image,", path_to_image)
    return send_from_directory('static/images', path_to_image)


@flask_app.route('/static/assets/<path:path_to_image>')
@cross_origin()
def send_svg(path_to_image):
    print("Tryigng to access image,", path_to_image)
    return send_from_directory('static/assets', path_to_image)


@flask_app.route("/health")
def health():
    return Response("OK", status=200)


@cross_origin()
@flask_app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    # Handle chat logic here
    return jsonify({"response": "This is a regular chat response."})


@cross_origin()
@flask_app.route('/extraction_model', methods=['GET'])
def extraction_model():
    selected_image = request.args.get('selectedImage')
    extraction_option = request.args.get('extraction')

    if not selected_image or not extraction_option:
        return jsonify({"error": "Invalid request parameters"}), 400

    text = get_text_for_image(selected_image, extraction_option)
    if text is not None:
        return text, 200
    else:
        print("Text not found for the given image and extraction option")
        if(extraction_option == "wdu"):
            print("Invoke text extraction")
            run_text_ext(selected_image, API_KEY)
            text = get_text_for_image(selected_image, extraction_option)
            return text, 200
        else:
            return "Text not found for the given image and extraction option", 404


logging.basicConfig(level=logging.DEBUG)


def validate_parameters(*args_to_check):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for arg in args_to_check:
                value = request.args.get(arg)
                if not value:
                    logging.error(f'Error: Missing {arg} parameter')
                    return Response(f'Missing {arg} parameter', content_type='text/plain', status=200)
            return func(*args, **kwargs)

        return wrapper

    return decorator


def verify_api_key(api_key):
    try:
        for token in send_hello_world_prompt(api_key):
            print(token)
        return True
    except:
        return False


@cross_origin()
@flask_app.route('/api/verify_key', methods=['POST'])
def verify_key():
    print('/api/verify_key')
    data = request.get_json()
    api_key = data.get("apiKey")
    print(api_key)
    if not api_key:
        # Handle the case where no API key is provided
        return jsonify({"verified": False}), 400

    is_verified = verify_api_key(api_key)
    print(is_verified)
    return jsonify({"verified": is_verified}), 200


@cross_origin()
@flask_app.route('/api/send_to_llm', methods=['POST'])
@validate_parameters('model_name', 'extraction', 'selected_image')
def send_to_llm():
    try:
        model_name = request.args.get('model_name')
        extraction = request.args.get('extraction')
        selected_image = request.args.get('selected_image')

        if not request.json or not request.json.get('messages'):
            logging.error('Error: Invalid request body')
            return Response('Invalid request body', content_type='text/plain', status=400)

        latest_message = get_last_user_message(request.json)
        if not latest_message:
            logging.error('Error: Missing or empty content in the message')
            return Response('Missing or empty content in the message', content_type='application/octet-stream',
                            status=400)

        return Response(
            stream_with_context(process_text_file(model_name, selected_image, extraction, latest_message, API_KEY)),
            content_type='text/plain')


    except Exception as e:
        def return_error():
            yield f'Helo World'

        logging.error(f'Exception caught: {str(e)}', exc_info=True)
        return stream_with_context(return_error())


@cross_origin()
@flask_app.route('/api/get_images_list', methods=['GET'])
def get_images_list():
    try:
        # Get a list of all files in the directory
        image_files = [f for f in os.listdir(flask_app.config["IMAGES"]) if
                       os.path.isfile(os.path.join(flask_app.config["IMAGES"], f))]

        # Sort the list of files alphabetically
        sorted_image_files = sorted(image_files)

        # Return the sorted list
        return jsonify(sorted_image_files)
    except Exception as e:
        # If there is any exception, return an error message with status code 500
        return jsonify({'error': str(e)}), 500


@cross_origin()
@flask_app.route('/api/suggested_question', methods=['GET'])
def get_suggested_question():

    selected_image = request.args.get('selectedImage')

    if not selected_image:
        return jsonify({"error": "Invalid request parameters"}), 400
    # Replace 'your_json_file.json' with the actual path to your JSON file
    file_path = flask_app.config['CHAT_SUGGESTION_JSON']

    if not file_path:
        raise ValueError("IMAGES configuration is not set in Flask app")

    with open(file_path, 'r') as file:
        data = json.load(file)
    if data and selected_image in data:
        questions = data[selected_image].get("questions")
        if questions:
            return jsonify({"questions": questions}), 200
        else:
            return jsonify({"error": "No questions found for the selected image"}), 404
    else:
        return jsonify({"error": "Image not found in the data"}), 404

# API to run watsonx.ai Text extraction.
# Pre-requisites:
#   A COS bucket with images
#   A data connection asset in watsonx project to the COS
# Working:
#   Pick image from the COS bucket
#   run the text extraction on the image
#   download the result (.txt/json) file from the bucket to local folder
# Input: selected_image = Image file name (from /static/images/ folder), extraction=wdu
# Output: Dict with job extraction id & status.
@cross_origin()
@flask_app.route('/api/text_ext', methods=['GET'])
@validate_parameters('extraction', 'selected_image')
def run_text_extraction():
    try:
        extraction = request.args.get('extraction')
        selected_image = request.args.get('selected_image')
        response = run_text_ext(selected_image, API_KEY)
        return jsonify(response)
    except Exception as e:
        # If there is any exception, return an error message with status code 500
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="5001")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    # only used locally
    is_https = CONFIG.IS_HTTPS
    if is_https:
        flask_app.run(host='0.0.0.0', port=8443, debug=False)
    else:
        flask_app.run(host='0.0.0.0', port=SERVICE_PORT, debug=DEBUG_MODE)