import os
from os import path

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

print(ROOT_DIR)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS")
ALLOWED_ORIGINS = ALLOWED_ORIGINS.split(",")

current_env = "dev"
# current_env = "prod"

if current_env == 'dev':
    flask_app = Flask(__name__)

else:
    flask_app = Flask(__name__, static_folder=path.join(ROOT_DIR, '/app/static/client/build'), static_url_path='/')

# flask_app.config['JSON_AS_ASCII'] = False
flask_app.config['STATIC'] = path.join(ROOT_DIR, 'static')
flask_app.config['SESSION_TYPE'] = 'filesystem'
flask_app.config['CORS_HEADERS'] = 'Content-Type'
flask_app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
flask_app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 30
flask_app.config['UPLOAD_EXTENSIONS'] = ['.jpg', '.png', '.jpeg', ".json"]
flask_app.config['IMAGES'] = path.join(ROOT_DIR, 'static/images')
flask_app.config['ASSETS'] = path.join(ROOT_DIR, 'static/assets')
flask_app.config['EXTRACTION'] = path.join(ROOT_DIR, 'static/extraction')
flask_app.config['UPLOAD_PATH_JSON'] = path.join(ROOT_DIR, 'static/jsons')
flask_app.config['TEMPLATE_JSON'] = path.join(ROOT_DIR, 'static/config')
flask_app.config['WORD_COUNTER'] = path.join(ROOT_DIR, 'static/counter')
flask_app.config['TEMPLATE_JSON_STR'] = path.join(ROOT_DIR, 'static/config/template_str.json')
flask_app.config['LOGGING_CONFIG'] = path.join(ROOT_DIR, 'static/logging_config.ini')
flask_app.config['CHAT_SUGGESTION_JSON'] = path.join(ROOT_DIR, 'static/chat_suggestions.json')

CORS(flask_app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})


def remove_requests_data():
    import os
    import glob
    dir_path_to_delete = path.join(flask_app.config['UPLOAD_PATH_COMPARISON'])

    files = glob.glob(os.path.join(dir_path_to_delete, "*"))
    for f in files:
        os.remove(f)

    is_exist = os.path.exists(dir_path_to_delete)

    if not is_exist:
        os.makedirs(dir_path_to_delete)


deployment_env = "local"


# deployment_env = "staging"


# deployment_env = "prod"

class LOCAL_CONFIG:
    BASE_URL = "https://localhost:5000"
    CLIENT_URL = "https://localhost:5001"
    OCR_SERVICE_HOST = "lnx-vidgis.haifa.ibm.com"
    IS_HTTPS = False
    IS_LOGIN_ON = False
    REDIRECT_URL = BASE_URL + "/test"
    lOGIN_URL = BASE_URL + "/log_in"
    SHOULD_USE_LOCALHOST = False
    DOCKER_LOCAL_HOST = False
    SLACK_EMAIL = "j6u0l1x8b4x2o4i2@ibm-research.slack.com"
    SERVER_PORT = 5000
    IS_SLACK_NOTIFICATION_ON = True


class STAGING_CONFIG:
    BASE_URL = "https://ocr-dev.haifa.ibm.com"
    CLIENT_URL = "https://ocr-dev.haifa.ibm.com"
    OCR_SERVICE_HOST = "lnx-vidgis.haifa.ibm.com"
    IS_HTTPS = False
    IS_LOGIN_ON = False
    REDIRECT_URL = BASE_URL + "/test"
    lOGIN_URL = BASE_URL + "/log_in"
    SHOULD_USE_LOCALHOST = False
    DOCKER_LOCAL_HOST = True
    SLACK_EMAIL = "j6u0l1x8b4x2o4i2@ibm-research.slack.com"
    SERVER_PORT = 5000
    IS_SLACK_NOTIFICATION_ON = False


class PROD_CONFIG:
    BASE_URL = "https://ocr.res.ibm.com"
    CLIENT_URL = "https://ocr.res.ibm.com"
    OCR_SERVICE_HOST = "lnx-vidgis.haifa.ibm.com"
    IS_HTTPS = True
    IS_LOGIN_ON = True
    REDIRECT_URL = BASE_URL + "/test"
    lOGIN_URL = BASE_URL + "/log_in"
    SHOULD_USE_LOCALHOST = False
    DOCKER_LOCAL_HOST = True
    SLACK_EMAIL = "c5t4v6a4y1a5o5j3@ibm-research.slack.com"
    SERVER_PORT = 8443
    IS_SLACK_NOTIFICATION_ON = True


if deployment_env == "local":
    CONFIG = LOCAL_CONFIG

if deployment_env == "staging":
    CONFIG = STAGING_CONFIG

if deployment_env == "prod":
    CONFIG = PROD_CONFIG
