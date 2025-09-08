import os
import io
import time
import json
import ibm_boto3
from ibm_botocore.client import Config, ClientError
import logging
import pandas as pd
from typing import List, Optional, Any
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

class COSClient:
    """
    A class to interact with IBM Cloud Object Storage (COS) using the ibm_boto3 library.

    Attributes:
        cos_endpoint (str): The COS endpoint URL.
        cos_api_key_id (str): The API key for COS access.
        cos_instance_crn (str): The instance CRN of the COS resource.
        _cos (ibm_boto3.client): The client object for accessing the COS service.
    """

    def __init__(
        self,
        cos_endpoint: Optional[str] = None,
        cos_api_key_id: Optional[str] = None,
        cos_instance_crn: Optional[str] = None
    ) -> None:
        """
        Initializes the COSClient with IBM Cloud Object Storage credentials and endpoint details.

        Args:
            cos_endpoint (Optional[str]): The COS endpoint URL. If not provided, defaults to the environment variable COS_ENDPOINT.
            cos_api_key_id (Optional[str]): The API key for accessing COS. If not provided, defaults to the environment variable COS_API_KEY_ID.
            cos_instance_crn (Optional[str]): The COS instance CRN. If not provided, defaults to the environment variable COS_INSTANCE_CRN.

        Raises:
            ValueError: If any of cos_endpoint, cos_api_key_id, or cos_instance_crn is missing, raises an exception.
        """
        if cos_endpoint is None:
            cos_endpoint = os.getenv("COS_ENDPOINT")
        if cos_api_key_id is None:
            cos_api_key_id = os.getenv("COS_API_KEY_ID")
        if cos_instance_crn is None:
            cos_instance_crn = os.getenv("COS_INSTANCE_CRN")

        if (
            cos_endpoint is None
            or cos_api_key_id is None
            or cos_instance_crn is None
        ):
            raise ValueError(
                "COS_ENDPOINT, COS_API_KEY_ID and COS_INSTANCE_CRN are required for connecting to COS Bucket. Either set them in Environment Variables or pass the values while initializing."
            )

        self._cos = ibm_boto3.client(
            "s3",
            ibm_api_key_id=cos_api_key_id,
            ibm_service_instance_id=cos_instance_crn,
            config=Config(signature_version="oauth", max_pool_connections=50),
            endpoint_url=cos_endpoint
        )

    def get_buckets(self) -> List[str]:
        """
        Retrieves a list of all buckets in the COS instance.

        Returns:
            List[str]: A list of bucket names in the COS instance.

        Logs:
            ClientError: Logs any client errors that occur during the bucket retrieval process.
        """
        buckets_list = []
        try:
            response = self._cos.list_buckets()
            for bucket in response['Buckets']:
                buckets_list.append(bucket['Name'])
        except ClientError as be:
            logger.info("CLIENT ERROR: {0}\n".format(be))
        return buckets_list
    
    def get_bucket_contents(self, bucket_name: str) -> List[str]:
        """
        Retrieves the list of file names from a specific bucket.

        Args:
            bucket_name (str): The name of the bucket whose contents are to be retrieved.

        Returns:
            List[str]: A list of file names in the specified bucket.
        """
        file_names = []
        try:
            # Initialize the pagination
            continuation_token = None
            while True:
                if continuation_token:
                    response = self._cos.list_objects_v2(
                        Bucket=bucket_name,
                        ContinuationToken=continuation_token
                    )
                else:
                    response = self._cos.list_objects_v2(Bucket=bucket_name)

                # Append file names to the list
                for obj in response.get('Contents', []):
                    file_names.append(obj['Key'])

                # Check if more objects are available
                if response.get('IsTruncated'):  # If true, there are more objects to fetch
                    continuation_token = response.get('NextContinuationToken')
                else:
                    break
        except ClientError as be:
            logger.info("CLIENT ERROR: {0}\n".format(be))
        except Exception as e:
            logger.error("Unexpected error: {0}\n".format(e))
        return file_names
    
    def get_contents_of_folder_in_bucket(self, bucket_name: str, folder_path:str) -> List[str]:
        """
        Retrieves the list of file names from a specific bucket.

        Args:
            bucket_name (str): The name of the bucket whose contents are to be retrieved.

        Returns:
            List[str]: A list of file names in the specified bucket.
        """
        file_names = []
        try:
            response = self._cos.list_objects_v2(Bucket=bucket_name, Prefix=folder_path)
            for obj in response.get('Contents', []):
                file_names.append(obj['Key'])
        except ClientError as be:
            logger.info("CLIENT ERROR: {0}\n".format(be))
        return file_names
    
    def download_item(
        self, 
        bucket_name: str, 
        item_name: str, 
        data_folder: str = "data/", 
        add_timestamp: bool = False
    ) -> str:
        """
        Downloads an item from a specified bucket and stores it in a local folder.

        Args:
            bucket_name (str): The name of the bucket containing the item.
            item_name (str): The name of the item to be downloaded.
            data_folder (str, optional): The folder where the item should be stored. Defaults to "data/".
            add_timestamp (bool, optional): If True, adds a timestamp to the downloaded file name. Defaults to False.

        Returns:
            str: The path of the downloaded file.

        Raises:
            FileNotFoundError: If the specified file cannot be found in the bucket or the download process fails.
        """
        try:
            download_filename = os.path.join(data_folder, item_name)
            
            # Skip if file already exist
            if os.path.exists(download_filename):
                logger.info(f"Skipping : {download_filename} file already exists")
                return download_filename

            # Create directories if they don't exist
            path, filename = os.path.split(download_filename)
            if not os.path.exists(path):
                os.makedirs(path, exist_ok=True)

            # Add timestamp to the file name if required
            if add_timestamp:
                name_split = download_filename.rsplit(".", 1)
                download_filename = f"{name_split[0]}_{int(time.time())}.{name_split[1]}"

            # Download the file
            with open(download_filename, "wb") as f:
                self._cos.download_fileobj(bucket_name, item_name, f)

            return download_filename
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")
            raise FileNotFoundError("File could not be found in the specified path.")
        
    def concurrent_download_items(
        self, bucket_name: str, item_names: List[str], data_folder: str = "data/", add_timestamp: bool = False
    ) -> None:
        """
        Downloads multiple items concurrently from a specified bucket using a pool of 10 concurrent threads.

        Args:
            bucket_name (str): The name of the bucket containing the items.
            item_names (List[str]): A list of item names to be downloaded.
            data_folder (str, optional): The folder where the items should be stored. Defaults to "data/".
            add_timestamp (bool, optional): If True, adds a timestamp to the downloaded file names. Defaults to False.
        """
        max_concurrent_downloads = 10
        
        def download_task(item_name):
            """Wrapper to call the download_item method for each item."""
            return self.download_item(bucket_name, item_name, data_folder, add_timestamp)

        # Create a ThreadPoolExecutor to download files concurrently
        with ThreadPoolExecutor(max_workers=max_concurrent_downloads) as executor:
            # Submit all the tasks for downloading
            future_to_item = {executor.submit(download_task, item): item for item in item_names}

            # Use tqdm to show progress
            with tqdm(total=len(item_names), desc="Downloading files", unit="file") as pbar:
                # As each download completes, update progress
                for future in as_completed(future_to_item):
                    item = future_to_item[future]
                    try:
                        download_filename = future.result()  # Get the result of the download (file path)
                        logger.info(f"Successfully downloaded {item} to {download_filename}")
                    except Exception as exc:
                        logger.error(f"Error downloading {item}: {exc}")
                    finally:
                        pbar.update(1)  # Update progress bar after each file completes

    def upload_json_to_cos(self, json_content, bucket_name, output_filepath):
        """
        Uploads a JSON object to a specified bucket.

        Args:
            json_content (dict): The JSON content to upload.
            bucket_name (str): The name of the bucket.
            output_filepath (str): The path in the bucket to save the JSON file.

        Returns:
            None
        """
        try:
            data_json = json.dumps(json_content, ensure_ascii=False, indent=4)
            self._cos.put_object(Bucket=bucket_name, Key=output_filepath, Body=data_json)
            logger.info(f"Uploaded JSON to {output_filepath} in bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def upload_local_file_to_cos(self, local_filepath, bucket_name, output_filepath):
        """
        Uploads a local file to a specified bucket.

        Args:
            local_filepath (str): The local file path.
            bucket_name (str): The name of the bucket.
            output_filepath (str): The path in the bucket to save the file.

        Returns:
            None
        """
        try:
            self._cos.upload_file(local_filepath, bucket_name, output_filepath)
            logger.info(f"Uploaded {local_filepath} to {output_filepath} in bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def read_json_from_cos(self, bucket_name: str, json_filepath: str) -> dict:
        """
        Reads a JSON file from COS and returns its content as a dictionary.

        Args:
            bucket_name (str): The name of the bucket.
            json_filepath (str): The path to the JSON file in the bucket.

        Returns:
            dict: The content of the JSON file.
        """
        try:
            response = self._cos.get_object(Bucket=bucket_name, Key=json_filepath)
            json_content = json.loads(response['Body'].read())
            return json_content
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def read_excel_from_cos(self, bucket_name: str, excel_filepath: str, sheet_name:str=None) -> pd.DataFrame:
        """
        Reads an Excel file from COS and returns its content as a pandas DataFrame.

        Args:
            bucket_name (str): The name of the bucket.
            excel_filepath (str): The path to the Excel file in the bucket.

        Returns:
            pd.DataFrame: The content of the Excel file.
        """
        try:
            response = self._cos.get_object(Bucket=bucket_name, Key=excel_filepath)
            df = pd.read_excel(io.BytesIO(response['Body'].read()), sheet_name=sheet_name)
            return df
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def read_csv_from_cos(self, bucket_name: str, csv_filepath: str) -> pd.DataFrame:
        """
        Reads a CSV file from a COS bucket and loads it into a pandas DataFrame.

        Args:
            bucket_name (str): The name of the bucket.
            csv_filepath (str): The path to the CSV file in the bucket.

        Returns:
            pd.DataFrame: The content of the CSV file as a DataFrame.
        """
        try:
            response = self._cos.get_object(Bucket=bucket_name, Key=csv_filepath)
            df = pd.read_csv(io.BytesIO(response['Body'].read()))
            return df
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")
            raise
        except Exception as e:
            logger.error(f"Error reading CSV file from {csv_filepath} in bucket {bucket_name}: {e}")


    def save_df_to_cos_as_csv(self, df: pd.DataFrame, bucket_name: str, csv_filepath: str) -> None:
        """
        Saves a pandas DataFrame as a CSV file to COS.

        Args:
            df (pd.DataFrame): The DataFrame to save.
            bucket_name (str): The name of the bucket.
            csv_filepath (str): The path in the bucket to save the CSV file.

        Returns:
            None
        """
        try:
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            self._cos.put_object(Bucket=bucket_name, Key=csv_filepath, Body=csv_buffer.getvalue())
            logger.info(f"Uploaded DataFrame as CSV to {csv_filepath} in bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def read_text_file_from_cos(self, bucket_name: str, text_filepath: str) -> str:
        """
        Reads a text file from COS and returns its content as a string.

        Args:
            bucket_name (str): The name of the bucket.
            txt_filepath (str): The path to the text file in the bucket.

        Returns:
            str: The content of the text file.
        """
        try:
            response = self._cos.get_object(Bucket=bucket_name, Key=text_filepath)
            txt_content = response['Body'].read().decode('utf-8')
            return txt_content
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def save_content_to_cos(self, content: str|Any, bucket_name: str, filepath: str) -> None:
        """
        Saves a text string as a file to COS.

        Args:
            content (str): The text content to save.
            bucket_name (str): The name of the bucket.
            txt_filepath (str): The path in the bucket to save the text file.

        Returns:
            None
        """
        try:
            self._cos.put_object(Bucket=bucket_name, Key=filepath, Body=content)
            logger.info(f"Uploaded content to {filepath} in bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def copy_file_within_cos(self, bucket_name: str, source_filepath: str, destination_filepath: str) -> None:
        """
        Copies a file from one location to another within the same COS bucket.

        Args:
            bucket_name (str): The name of the bucket.
            source_filepath (str): The path to the source file in the bucket.
            destination_filepath (str): The path where the file should be copied within the bucket.

        Returns:
            None
        """
        try:
            copy_source = {'Bucket': bucket_name, 'Key': source_filepath}
            self._cos.copy_object(CopySource=copy_source, Bucket=bucket_name, Key=destination_filepath)
            logger.info(f"Copied file from {source_filepath} to {destination_filepath} in bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def copy_object_between_buckets(
        self, 
        source_bucket_name: str, 
        source_key: str, 
        destination_bucket_name: str, 
        destination_key: Optional[str] = None
    ) -> None:
        """
        Copies an object from one bucket to another.

        Args:
            source_bucket_name (str): The name of the source bucket.
            source_key (str): The key (path) of the source object in the source bucket.
            destination_bucket_name (str): The name of the destination bucket.
            destination_key (Optional[str]): The key (path) for the object in the destination bucket. 
                                            If not provided, the source_key is used.

        Returns:
            None
        """
        try:
            if destination_key is None:
                destination_key = source_key

            copy_source = {'Bucket': source_bucket_name, 'Key': source_key}
            self._cos.copy_object(CopySource=copy_source, Bucket=destination_bucket_name, Key=destination_key)
            logger.info(
                f"Copied object from {source_bucket_name}/{source_key} to {destination_bucket_name}/{destination_key}"
            )
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")

    def delete_file_from_cos(self, bucket_name: str, file_key: str) -> None:
        """
        Deletes a file from a specified COS bucket.

        Args:
            bucket_name (str): The name of the bucket.
            file_key (str): The key (path) of the file to be deleted.

        Returns:
            None
        """
        try:
            self._cos.delete_object(Bucket=bucket_name, Key=file_key)
            logger.info(f"Deleted file {file_key} from bucket {bucket_name}")
        except ClientError as be:
            logger.info(f"CLIENT ERROR: {be}")
            raise
        except Exception as e:
            logger.error(f"Error deleting file {file_key} from bucket {bucket_name}: {e}")
            raise
