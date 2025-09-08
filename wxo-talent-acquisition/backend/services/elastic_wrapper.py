import os
import ssl
import tempfile
import logging
from pathlib import Path
from dotenv import load_dotenv

from elasticsearch import Elasticsearch

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# def get_certificate_path() -> Path:
#     """
#     Get the absolute path to the certificate file.

#     Returns:
#         Path: The absolute path of certificate.crt.
#     """
#     return Path(__file__).resolve().parent.parent.parent / "certificate.crt"
logger: logging.Logger = logging.getLogger(__name__)
class ElasticWrapper:
    """
    A wrapper class for managing Elasticsearch connections.
    """

    def __init__(self) -> None:
        
        self.es_credentials = {
            "url": os.getenv("ELASTIC_URL",None),
            "username": os.getenv("ELASTIC_USERNAME",None),
            "use_anonymous_access": """false""",
            "password": os.getenv("ELASTIC_PASSWORD",None)
        }
        # print(self.es_credentials)
        self.es_client = Elasticsearch(
            self.es_credentials["url"],
            basic_auth=(self.es_credentials["username"], self.es_credentials["password"]),
            verify_certs=False,
            ssl_show_warn=False,
            request_timeout=3600
        )
 
if __name__ == "__main__":
    es_client: ElasticWrapper = ElasticWrapper()
    print(es_client.es_client.info())