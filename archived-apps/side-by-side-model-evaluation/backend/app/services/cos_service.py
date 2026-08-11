
import logging
import os, types
from typing import List
import urllib.parse
from tempfile import TemporaryDirectory
# import pandas as pd
# from botocore.client import Config
from services.services_factory import ServicesFactory
from ibm_botocore.client import Config, ClientError
import ibm_boto3

from services.utils import CommonUtils, singleton

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

@singleton
class COSService:
    def __init__(self) -> None:
        self.utils: CommonUtils = ServicesFactory.get_common_utils()
        self.IBMCLOUD_COS_API_KEY = os.environ.get('IBMCLOUD_COS_API_KEY', None)  
        self.COS_ENDPOINT = os.environ.get('COS_ENDPOINT', 's3.us-south.cloud-object-storage.appdomain.cloud')
        self.BUCKET = os.environ.get('COS_BUCKET', None)  
        self.init_client()
        # logger.info(f"--------- INIT EmbeddingService, Type: {self.type_ } ----------")

    def init_client(self):
        self.cos_client = ibm_boto3.client(service_name='s3',   
                            ibm_api_key_id = self.IBMCLOUD_COS_API_KEY,
                            ibm_auth_endpoint="https://iam.cloud.ibm.com/oidc/token",
                            config=Config(signature_version='oauth'),
                            endpoint_url=f"https://{self.COS_ENDPOINT}"
                            )  
        
    def get_item(self, object_key, bucket = None):
        try:
            if bucket is None:
                bucket = self.BUCKET
            streaming_body = self.cos_client.get_object(Bucket=bucket, Key=object_key)['Body']
            return streaming_body
        except ClientError as be:
            logger.error("COS CLIENT ERROR: {0}\n".format(be))
        except Exception as e:
            logger.error("Unable to retrieve file contents: {0}".format(e))

    def file_from_cos_to_local(self, file_key, bucket=None, local_dir=None):
        if bucket is None:
            bucket = self.BUCKET
        streaming_object = self.get_item(file_key, bucket)
        if streaming_object is None:
            return None
        file_data = streaming_object.read()

        if local_dir is None or not os.path.exists(local_dir):
            # local_dir = self.utils.getFromCache("TEMP_DIR")
            local_dir = (tmp_dir := TemporaryDirectory()).name
            
        # temp_file_path = f"{DIRECTORY_PATH}/{file_key}"
        temp_file_path = f"{local_dir}/{file_key}" 
        with open(temp_file_path, "wb") as binary_file:   
            binary_file.write(file_data)
        logger.debug(f"FILE SAVED: {temp_file_path}")
        return temp_file_path
    
    def upload_file(self, file_key, file_content, bucket=None, REPLACE=False):
        logger.debug(f"IN COSService.upload_file : {file_key}")
        try:
            if bucket is None:
                bucket = self.BUCKET
            file = self.get_item(object_key=file_key, bucket=bucket)
            if file is None or REPLACE == True:
                file = self.cos_client.put_object(
                    Bucket=bucket,
                    Key=file_key,
                    Body=file_content
                )
                logger.debug(f"\n\nfile_key: {file_key} uploaded to COS !\n\n")
            else:
                logger.debug(f"\n\nfile_key: {file_key} already exists on COS !\n\n")
            return file
        except ClientError as be:
            logger.error("IN upload_file, COS CLIENT ERROR: {0}\n".format(be))
        except Exception as e:
            logger.error(e)
            logger.error("Error in upload_file, Unable to upload file: {0}".format(e))

    async def upload_files(self, files: List[object], bucket=None):
        logger.debug(f"IN COSService.upload_files to bucket : {bucket}")
        uploaded_files = []
        try:
            for ix, _file in enumerate(files):
                obj_key = _file.filename
                logger.debug(f"UPLOADING {obj_key} to COS ")
                fileContent: bytes = await _file.read()
                self.upload_file(obj_key, fileContent, REPLACE=False) 
                file_url = f"https://{self.BUCKET}.{self.COS_ENDPOINT}/{urllib.parse.quote(obj_key)}".encode('utf-8')
                # file_url = urllib.parse.urlencode(file_url)
                # file_url = file_url.encode('utf-8')
                # file_url = urllib.parse.quote(file_url)                
                uploaded_files.append(file_url) 
            return uploaded_files     
        except ClientError as be:
            logger.error("IN upload_files, COS CLIENT ERROR: {0}\n".format(be))     
        except Exception as e:
            logger.error("Error in upload_files, Unable to upload file: {0}".format(e))

    def get_file_url(self, file_key, bucket=None):
        if bucket is None:
            bucket = self.BUCKET
        file_url = f"https://{self.BUCKET}.{self.COS_ENDPOINT}/{urllib.parse.quote(file_key)}".encode('utf-8')
        return file_url

    