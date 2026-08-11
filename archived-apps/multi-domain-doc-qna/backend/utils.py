import requests, re, asyncio, aiohttp, logging, tempfile
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    AsyncGenerator,
    Sequence
)
from ibm_watson_machine_learning.foundation_models.model import Model
from ibm_watson_machine_learning.foundation_models.utils.enums import ModelTypes
from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document
from llama_index.core.vector_stores import VectorStoreQuery
from llama_index.core.vector_stores.types import VectorStoreQueryMode
from llama_index.core.llms import (
    ChatMessage,
    ChatResponse,
    CompletionResponse,
    ChatResponseAsyncGen,
    CompletionResponseAsyncGen,
    LLMMetadata,
)
from llama_index.core.callbacks import CallbackManager
from llama_index.core.types import BaseOutputParser, PydanticProgramMode
from llama_index.llms.watsonx import WatsonX
from llama_index.readers.file import (
    DocxReader,
    PDFReader,
    UnstructuredReader,
    FlatReader,
    HTMLTagReader
)
from llama_index.core.vector_stores.types import MetadataFilters

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudObjectStorageReader(BaseReader):
    """
    A class used to interact with IBM Cloud Object Storage.

    This class inherits from the BasePydanticReader base class and overrides its methods to work with IBM Cloud Object Storage.

    Compatible with llama-index framework.

    Taken from wxd-setup-and-ingestion repository in skol-assets

    Attributes
    ----------
    bucket_name : str
        The name of the bucket in the cloud storage.
    credentials : dict
        The credentials required to authenticate with the cloud storage. It must contain 'apikey' and 'service_instance_id'.
    hostname : str, optional
    """

    def __init__(
        self,
        bucket_name: str,
        credentials: dict,
        hostname: str = "https://s3.us-south.cloud-object-storage.appdomain.cloud",
        readers: Optional[Dict[str, BaseReader]] = None,
    ):
        self.bucket_name = bucket_name
        self.credentials = credentials
        self.hostname = hostname
        self._available_readers = readers if readers else {}
        self._base_url = f"{self.hostname}/{self.bucket_name}"
        if "apikey" in self.credentials and "service_instance_id" in self.credentials:
            self.credentials = credentials
        else:
            raise ValueError(
                "Missing 'apikey' or 'service_instance_id' in credentials."
            )
        self._bearer_token = self.__get_bearer_token()
        self.readers = readers if readers else {}
        DEFAULT_READERS = {
            ".pdf": PDFReader(),
            ".docx": DocxReader(),
            ".pptx": UnstructuredReader(),
            ".txt": FlatReader(),
            ".html": HTMLTagReader(),
        }
        self.readers = {**DEFAULT_READERS, **self.readers}

    async def load_data(
        self,
        regex_filter: str = None,
        num_files: int = None,
    ) -> List[Document]:
        async def consume_generator():
            return [
                doc
                async for doc in self.async_load_data(
                    regex_filter=regex_filter, num_files=num_files
                )
            ]

        return await consume_generator()

    async def async_load_data(
        self, regex_filter: str = None, num_files: int = None
    ) -> AsyncGenerator:
        file_names = self.list_files(regex_filter)
        read_tasks = [
            self.read_file_to_documents(file_name)
            for file_name in file_names[:num_files]
        ]
        for read_task in asyncio.as_completed(read_tasks):
            docs = await read_task
            for doc in docs:
                yield doc

    async def read_file_to_documents(self, file_name: str) -> List[Document]:
        file_data = await self.__read_file_data(file_name)
        reader = self.__get_file_reader(file_name)
        file_extension = "." + file_name.split(".")[-1]

        with tempfile.NamedTemporaryFile(
            delete=True, suffix=file_extension
        ) as temp_file:
            temp_file.write(file_data)
            temp_file.flush()
            try:
                logger.info(f"Reading file {file_name}...")
                docs: List[Document]
                docs = await asyncio.wait_for(
                    asyncio.to_thread(
                        reader.load_data,
                        Path(temp_file.name),
                        extra_info={"file_name": file_name},
                    ),
                    timeout=120.0,
                )
                logger.info(
                    f"Finished reading file {file_name} with {reader.__class__.__name__}"
                )
            except asyncio.TimeoutError:
                logger.error(
                    f"Timeout when reading {file_name} with {reader.__class__.__name__}"
                )
                docs = []
            except Exception as e:
                logger.error(
                    f"Failed to read {file_name} with {reader.__class__.__name__} because of {e}"
                )
                docs = []
        return docs


    def list_files(self, regex_filter: str = None) -> List[str]:
        """
        Lists all the files in the bucket.

        This method sends a GET request to the cloud storage service and parses the response to extract the file names.

        Returns
        -------
        list
            A list of file names.
        """

        @self.__refresh_token_on_exception
        def _list_files(regex_filter: str = None) -> List[str]:
            headers = self.__get_request_header()
            response = requests.request("GET", self._base_url, headers=headers)
            data = response.text
            file_names = re.findall(r"<Key>(.*?)</Key>", data)
            if regex_filter:
                regex = re.compile(regex_filter)
                filtered_file_names = [name for name in file_names if regex.match(name)]
                file_names = filtered_file_names
            return file_names

        return _list_files(regex_filter)

    async def __read_file_data(self, file_name: str) -> bytes:
        """
        Reads a file from the bucket.

        This method sends a GET request to the cloud storage service to read the content of the specified file.

        Parameters
        ----------
        file_name : str
            The name of the file to read.

        Returns
        -------
        bytes
            The content of the file.
        """

        @self.__refresh_token_on_exception
        async def _read_file_data() -> bytes:
            headers = self.__get_request_header()
            url = f"{self._base_url}/{file_name}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    data = await response.read()
                    return data

        return await _read_file_data()

    @classmethod
    def from_service_credentials(
        cls,
        bucket: str,
        service_credentials_path: Path,
        hostname: str = "https://s3.us-south.cloud-object-storage.appdomain.cloud",
    ) -> "CloudObjectStorageReader":
        with open(service_credentials_path, "r") as file:
            cos_auth_dict = json.load(file)
        credentials = {
            "apikey": cos_auth_dict["apikey"],
            "service_instance_id": cos_auth_dict["resource_instance_id"],
        }
        return cls(bucket_name=bucket, credentials=credentials, hostname=hostname)

    def __get_file_reader(self, file_name: str) -> BaseReader:
        file_extension = "." + file_name.split(".")[-1].lower()
        if file_extension not in self.readers:
            raise ValueError(
                f"File extension {file_extension} is not supported by default readers and appropriate reader was not passed in the constructor."
            )
        return self.readers[file_extension]

    def __get_request_header(self) -> Dict[str, str]:
        headers = {
            "ibm-service-instance-id": self.credentials["service_instance_id"],
            "Authorization": f"Bearer {self._bearer_token}",
        }
        return headers

    def __get_bearer_token(self) -> str:
        url = "https://iam.cloud.ibm.com/identity/token"
        payload = f"grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey={self.credentials['apikey']}"
        headers = {
            "content-type": "application/x-www-form-urlencoded",
            "accept": "application/json",
        }
        response = requests.request("POST", url, headers=headers, data=payload)
        bearer_token = response.json()["access_token"]
        return bearer_token

    def __refresh_token_on_exception(self, func):
        def wrapper(*args, **kwargs):
            for _ in range(2):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException:
                    self._bearer_token = self.__get_bearer_token()
            raise

        return wrapper

class CustomWatsonX(WatsonX):
    """
    IBM WatsonX LLM. Wrapper around the existing WatonX LLM module to provide following features:
    1. Support for dynamically updated WatsonX models. The supported models are hardcoded in original implementation and are outdated as of 2/19/24.
    2. Implements the Async methods for the WatsonX LLM. While these are not true async methods, the implementation allows it to be used in async context.
    """

    def __init__(
        self,
        credentials: Dict[str, Any],
        model_id: Optional[str] = "ibm/mpt-7b-instruct2",
        validate_model_id: bool = True,
        project_id: Optional[str] = None,
        space_id: Optional[str] = None,
        max_new_tokens: Optional[int] = 512,
        temperature: Optional[float] = 0.1,
        additional_kwargs: Optional[Dict[str, Any]] = None,
        callback_manager: Optional[CallbackManager] = None,
        system_prompt: Optional[str] = None,
        messages_to_prompt: Optional[Callable[[Sequence[ChatMessage]], str]] = None,
        completion_to_prompt: Optional[Callable[[str], str]] = None,
        pydantic_program_mode: PydanticProgramMode = PydanticProgramMode.DEFAULT,
        output_parser: Optional[BaseOutputParser] = None,
    ) -> None:
        super().__init__(
            credentials=credentials,
            model_id="meta-llama/llama-2-70b-chat",
            project_id=project_id,
            space_id=space_id,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            additional_kwargs=additional_kwargs,
            callback_manager=callback_manager,
            system_prompt=system_prompt,
            messages_to_prompt=messages_to_prompt,
            completion_to_prompt=completion_to_prompt,
            pydantic_program_mode=pydantic_program_mode,
            output_parser=output_parser,
        )
        if validate_model_id:
            supported_models = [model.value for model in ModelTypes]
            if model_id not in supported_models:
                raise ValueError(
                    f"Model name {model_id} not found in {supported_models}"
                )
        self.model_id = model_id
        self._model = Model(
            model_id=model_id,
            credentials=credentials,
            project_id=project_id,
            space_id=space_id,
        )
        self.model_info = self._model.get_details()

    @classmethod
    def class_name(self) -> str:
        """Get Class Name."""
        return "CustomWatsonX_LLM"

    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            context_window=self.model_info["model_limits"]["max_sequence_length"],
            num_output=self.max_new_tokens,
            model_name=self.model_id,
        )

    async def acomplete(
        self, prompt: str, formatted: bool = False, **kwargs: Any
    ) -> CompletionResponse:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.complete, prompt, formatted, **kwargs
        )

    async def achat(
        self, messages: Sequence[ChatMessage], **kwargs: Any
    ) -> ChatResponse:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.chat, messages, **kwargs)

    async def astream_chat(
        self, messages: Sequence[ChatMessage], **kwargs: Any
    ) -> ChatResponseAsyncGen:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.stream_chat, messages, **kwargs)

    async def astream_complete(
        self, prompt: str, formatted: bool = False, **kwargs: Any
    ) -> CompletionResponseAsyncGen:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.stream_complete, prompt, formatted, **kwargs
        )

def create_sparse_vector_query_with_model(
    model_id: str, model_text_field: str = "ml.tokens"
) -> Callable[[Dict, VectorStoreQuery], Dict]:
    def sparse_vector_query(existing_query: Dict, query: VectorStoreQuery) -> Dict:
        new_query = existing_query.copy()
        if query.mode in [VectorStoreQueryMode.SPARSE, VectorStoreQueryMode.HYBRID]:
            new_query["query"] = {
                "text_expansion": {
                    model_text_field: {
                        "model_id": model_id,
                        "model_text": query.query_str,
                    }
                }
            }
        return new_query

    return sparse_vector_query

def create_sparse_vector_query_with_model_and_filter(
    model_id: str, model_text_field: str = "ml.tokens", filters: Optional[List[Dict]] = None
) -> Callable[[Dict, VectorStoreQuery], Dict]:
    def sparse_vector_query(existing_query: Dict, query: VectorStoreQuery) -> Dict:
        new_query = existing_query.copy()
        if query.mode in [VectorStoreQueryMode.SPARSE, VectorStoreQueryMode.HYBRID]:
            new_query["query"] = {
                "bool": {
                    "must": {
                        "text_expansion": {
                            model_text_field: {
                                "model_id": model_id,
                                "model_text": query.query_str,
                            }
                        } 
                    },
                    "filter": [_to_elasticsearch_filter(filters)],
                }
            }
            print(new_query)
        return new_query
    return sparse_vector_query

def _to_elasticsearch_filter(standard_filters: MetadataFilters) -> Dict[str, Any]:
    """Convert standard filters to Elasticsearch filter.

    Args:
        standard_filters: Standard Llama-index filters.

    Returns:
        Elasticsearch filter.
    """
    if len(standard_filters.legacy_filters()) == 1:
        filter = standard_filters.legacy_filters()[0]
        return {
            "term": {
                f"metadata.{filter.key}.keyword": filter.value,
                
            }
        }
    else:
        operands = []
        for filter in standard_filters.legacy_filters():
            operands.append(
                {
                    "term": {
                        f"metadata.{filter.key}.keyword": filter.value
                        
                    }
                }
            )
        return {"bool": {"must": operands}}
