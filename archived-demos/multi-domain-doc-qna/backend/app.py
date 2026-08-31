import os, json, uvicorn, sys

from utils import CloudObjectStorageReader, CustomWatsonX, create_sparse_vector_query_with_model, create_sparse_vector_query_with_model_and_filter
from dotenv import load_dotenv

# Fast API
from fastapi import FastAPI, Security, HTTPException
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN
from fastapi.middleware.cors import CORSMiddleware

# ElasticSearch
from elasticsearch import AsyncElasticsearch

# Vector Store / WatsonX connection
from llama_index.core import VectorStoreIndex, StorageContext, PromptTemplate, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.vector_stores.elasticsearch import ElasticsearchStore
from llama_index.core.vector_stores.types import MetadataFilters, FilterOperator, MetadataFilter

# wx.ai
from ibm_watson_machine_learning.foundation_models import Model
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams

# wd
from ibm_watson import DiscoveryV2
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

# Custom type classes
from customTypes.ingestRequest import ingestRequest
from customTypes.ingestResponse import ingestResponse
from customTypes.queryLLMRequest import queryLLMRequest
from customTypes.queryLLMResponse import queryLLMResponse
from customTypes.queryWDLLMRequest import queryWDLLMRequest
from customTypes.queryWDLLMResponse import queryWDLLMResponse

app = FastAPI()

# Set up CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
# RAG APP Security
API_KEY_NAME = "RAG-APP-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

#Token to IBM Cloud
ibm_cloud_api_key = os.environ.get("IBM_CLOUD_API_KEY")
project_id = os.environ.get("WX_PROJECT_ID")

# wxd creds
wxd_creds = {
    "username": os.environ.get("WXD_USERNAME"),
    "password": os.environ.get("WXD_PASSWORD"),
    "wxdurl": os.environ.get("WXD_URL")
}

wd_creds = {
    "apikey": os.environ.get("WD_API_KEY"),
    "wd_url": os.environ.get("WD_URL")
}

# WML Creds
wml_credentials = {
    "url": os.environ.get("WX_URL"),
    "apikey": os.environ.get("IBM_CLOUD_API_KEY")
}

# COS Creds
cos_creds = {
    "cosIBMApiKeyId": os.environ.get("COS_IBM_CLOUD_API_KEY"),
    "cosServiceInstanceId": os.environ.get("COS_INSTANCE_ID"),
    "cosEndpointURL": os.environ.get("COS_ENDPOINT_URL")
}

# Create a global client connection to elastic search
async_es_client = AsyncElasticsearch(
    wxd_creds["wxdurl"],
    basic_auth=(wxd_creds["username"], wxd_creds["password"]),
    verify_certs=False,
    request_timeout=3600,
)

# Create a watsonx client cache for faster calls.
custom_watsonx_cache = {}

# Basic security for accessing the App
async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == os.environ.get("RAG_APP_API_KEY"):
        return api_key_header
    else:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN, detail="Could not validate RAG APP credentials. Please check your ENV."
        )

@app.get("/")
def index():
    return {"Message": "Server is up & running. Go to /docs for OpenAPI documentation."}

@app.post("/ingestDocs")
async def ingestDocs(request: ingestRequest, api_key: str = Security(get_api_key))->ingestResponse:
    cos_bucket_name   = request.bucket_name
    chunk_size        = request.chunk_size
    chunk_overlap     = request.chunk_overlap
    es_index_name     = request.es_index_name
    es_pipeline_name  = request.es_pipeline_name
    es_model_name     = request.es_model_name
    es_model_text_field = request.es_model_text_field
    es_index_text_field = request.es_index_text_field
    # TODO: Metadata to add to nodes, could be anything from the user, maybe a list?
    #metadata_fields     = request.metadata_fields

    # try: 
    cos_reader = CloudObjectStorageReader(
        bucket_name = cos_bucket_name,
        credentials = {
            "apikey": cos_creds["cosIBMApiKeyId"],
            "service_instance_id": cos_creds["cosServiceInstanceId"]
        },
        hostname = cos_creds["cosEndpointURL"]
    )

    print(cos_reader.list_files())

    documents = await cos_reader.load_data()
    print(f"Total documents: {len(documents)}\nExample document:\n{documents[0]}")

    async_es_client = AsyncElasticsearch(
        wxd_creds["wxdurl"],
        basic_auth=(wxd_creds["username"], wxd_creds["password"]),
        verify_certs=False,
        request_timeout=3600,
    )

    await async_es_client.info()

    # Pipeline must occur before index due to pipeline dependency
    await create_inference_pipeline(async_es_client, es_pipeline_name, es_index_text_field, es_model_text_field, es_model_name)
    await create_index(async_es_client, es_index_name, es_index_text_field, es_pipeline_name)

    Settings.embed_model = None
    Settings.llm = None
    Settings.node_parser = SentenceSplitter.from_defaults(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap
    )

    vector_store = ElasticsearchStore(
        es_client=async_es_client,
        index_name=es_index_name,
        text_field=es_index_text_field
    )

    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=StorageContext.from_defaults(vector_store=vector_store),
        show_progress=True,
        use_async=True
    )

    return ingestResponse(response="success: number of documents loaded " + str(len(documents)))
    # except Exception as e:
    #     return ingestResponse(response = json.dumps({"error": repr(e)}))


async def create_index(client, index_name, esIndexTextField, pipeline_name):
    print("Creating the index...")
    index_config = {
        "mappings": {
            "properties": {
                "ml.tokens": {"type": "rank_features"}, 
                esIndexTextField: {"type": "text"}}
        },
        "settings": {
            "index.default_pipeline": pipeline_name,
        }
    }
    try:
        if await client.indices.exists(index=index_name):
            print("Deleting the existing index with same name")
            await client.indices.delete(index=index_name)
        response = await client.indices.create(index=index_name, body=index_config)
        print(response)
    except Exception as e:
        print(f"An error occurred when creating the index: {e}")
        response = e
        pass
    return response


async def create_inference_pipeline(client, pipeline_name, esIndexTextField, esModelTextField, esModelName):
    print("Creating the inference pipeline...")
    pipeline_config = {
        "description": "Inference pipeline using elser model",
        "processors": [
            {
                "inference": {
                    "field_map": {esIndexTextField: esModelTextField},
                    "model_id": esModelName,
                    "target_field": "ml",
                    "inference_config": {"text_expansion": {"results_field": "tokens"}},
                }
            },
            {"set": {"field": "file_name", "value": "{{metadata.file_name}}"}},
            {"set": {"field": "url", "value": "{{metadata.url}}"}},
        ],
        "version": 1,
    }

    try:
        if await client.ingest.get_pipeline(id=pipeline_name):
            print("Deleting the existing pipeline with same name")
            await client.ingest.delete_pipeline(id=pipeline_name)
    except:
        pass
    response = await client.ingest.put_pipeline(id=pipeline_name, body=pipeline_config)
    return response

# Uses Llama-index to obtain the context from an ES query
# which uses WML library underneath the hood via
# a CustomWatsonX class in utils.py
@app.post("/queryLLM")
async def queryLLM(request: queryLLMRequest, api_key: str = Security(get_api_key))->queryLLMResponse:

    question         = request.question
    index_name       = request.es_index_name
    index_text_field = request.es_index_text_field
    es_model_name    = request.es_model_name
    model_text_field = request.es_model_text_field
    num_results      = request.num_results
    llm_params       = request.llm_params
    es_filters       = request.filters
    llm_instructions = request.llm_instructions

    # Sanity check for instructions
    if "{query_str}" not in llm_instructions or "{context_str}" not in llm_instructions:
        data_response = {
            "llm_response": "",
            "references": [{"error":"Please add {query_str} and {context_str} placeholders to the instructions."}]
        }
        return queryLLMResponse(**data_response)

    # Format payload for later query
    payload = {
        "input_data": [
            {"fields": ["Text"], "values": [[question]]}
        ]
    }

    # Attempt to connect to ElasticSearch and call Watsonx for a response
    # try:
    # Setting up the structure of the payload for the query engine
    user_query = payload["input_data"][0]["values"][0][0]

    # Create the prompt template based on llm_instructions
    prompt_template = PromptTemplate(llm_instructions)

    # Create the watsonx LLM object that will be used for the RAG pattern
    Settings.llm = get_custom_watsonx(llm_params.model_id, llm_params.parameters.dict())
    Settings.embed_model = None

    # Create a vector store using the elastic client
    vector_store = ElasticsearchStore(
        es_client=async_es_client,
        index_name=index_name,
        text_field=index_text_field
    )

    # Retrieve an index of the ingested documents in the vector store
    # for later retrieval and querying
    index = VectorStoreIndex.from_vector_store(vector_store=vector_store)

    if es_filters: 
        print(es_filters)
        for k, v in es_filters.items():
            print(k)
            print(v)
        filters = MetadataFilters(
                filters=[
                    MetadataFilter(key=k,operator=FilterOperator.EQ, value=v) for k, v in es_filters.items()
            ]
        )
        
        query_engine = index.as_query_engine(
            text_qa_template=prompt_template,
            similarity_top_k=num_results,
            vector_store_query_mode="sparse",
            vector_store_kwargs={
                "custom_query": create_sparse_vector_query_with_model_and_filter(es_model_name, model_text_field=model_text_field, filters=filters)
            },
        )
    else:
        query_engine = index.as_query_engine(
            text_qa_template=prompt_template,
            similarity_top_k=num_results,
            vector_store_query_mode="sparse",
            vector_store_kwargs={
                "custom_query": create_sparse_vector_query_with_model(es_model_name, model_text_field=model_text_field)
            },
        )
    print(user_query)
    # Finally query the engine with the user question
    response = query_engine.query(user_query)
    print(response)
    data_response = {
        "llm_response": response.response,
        "references": [node.to_dict() for node in response.source_nodes]
    }

    return queryLLMResponse(**data_response)

    # except Exception as e:
    #     return queryLLMResponse(
    #         llm_response = "",
    #         references=[{"error": repr(e)}]
    #     )

def get_custom_watsonx(model_id, additional_kwargs):
    # Serialize additional_kwargs to a JSON string, with sorted keys
    additional_kwargs_str = json.dumps(additional_kwargs, sort_keys=True)
    # Generate a hash of the serialized string
    additional_kwargs_hash = hash(additional_kwargs_str)
    
    cache_key = f"{model_id}_{additional_kwargs_hash}"

    # Check if the object already exists in the cache
    if cache_key in custom_watsonx_cache:
        return custom_watsonx_cache[cache_key]

    # If not in the cache, create a new CustomWatsonX object and store it
    custom_watsonx = CustomWatsonX(
        credentials=wml_credentials,
        project_id=project_id,
        model_id=model_id,
        validate_model_id=False,
        additional_kwargs=additional_kwargs,
    )
    custom_watsonx_cache[cache_key] = custom_watsonx
    return custom_watsonx

@app.post("/queryWDLLM")
def queryWDLLM(request: queryWDLLMRequest, api_key: str = Security(get_api_key))->queryWDLLMResponse:
    question         = request.question
    num_results      = request.num_results
    llm_params       = request.llm_params
    wd_document_names= request.wd_document_names
    project_id       = request.project_id
    collection_id    = request.collection_id
    wd_version       = request.wd_version
    wd_return_params = request.wd_return_params
    llm_instructions = request.llm_instructions

    # Sanity check for instructions
    if "{query_str}" not in llm_instructions or "{context_str}" not in llm_instructions:
        data_response = {
            "llm_response": "",
            "references": [{"error":"Please add {query_str} and {context_str} placeholders to the instructions."}]
        }
        return queryLLMResponse(**data_response)

    # Sanity check for Watson Discovery
    if not wd_creds["apikey"] or wd_creds["wd_url"] == "":
        data_response = {
                "llm_response": "",
                "references": [{"error":"Please update the environment variables for Watson Discovery: WD_API & WD_URL"}]
            }
        return queryLLMResponse(**data_response)
    
    authenticator = IAMAuthenticator(wd_creds["apikey"])
    discovery = DiscoveryV2(
        version=wd_version,
        authenticator=authenticator
    )

    discovery.set_service_url(wd_creds["wd_url"])

    generate_params = {
        GenParams.MIN_NEW_TOKENS: llm_params.parameters.min_new_tokens,
        GenParams.MAX_NEW_TOKENS: llm_params.parameters.max_new_tokens,
        GenParams.DECODING_METHOD: llm_params.parameters.decoding_method,
        GenParams.REPETITION_PENALTY: llm_params.parameters.repetition_penalty,
        GenParams.TEMPERATURE: llm_params.parameters.temperature,
        GenParams.TOP_K: llm_params.parameters.top_k,
        GenParams.TOP_P: llm_params.parameters.top_p
    }

    model = Model(
        model_id=llm_params.model_id,
        params=generate_params,
        credentials={
            "apikey": os.environ.get("IBM_CLOUD_API_KEY"),
            "url": os.environ.get("WX_URL")
        },
        project_id=os.environ.get("WX_PROJECT_ID")
    )
    
    results = []
    wd_contexts = []

    # Filter the documents if the user provides it.
    if wd_document_names: 
        all_results = []

        listDocs = discovery.list_documents(
            project_id=project_id,
            collection_id=collection_id
        )

        data = listDocs.result

        doc_id_list = []
        # Get the document details for each document passed by the user
        for doc_id in data["documents"]:
            doc = discovery.get_document(
                project_id=project_id,
                collection_id=collection_id,
                document_id=doc_id['document_id']
            ).get_result()

            # Create an object containing the document name and its doc id
            for wd_document_name in wd_document_names:
                if doc["filename"] == wd_document_name:
                    doc_id_list.append({'doc_name': wd_document_name, 'doc_id': doc_id['document_id']})

        # Sanity checking to make sure the provided documents are available.
        if not doc_id_list or len(doc_id_list) != len(wd_document_names):
            data_response = {
                "llm_response": "One or more documents are not found in the Watson Discovery Collection or Project",
                "references": [{"node":"not implemented"}]
            }

            return queryWDLLMResponse(**data_response)

        for doc in doc_id_list:
            # Query WD based on a specific document and the NLQ question
            # https://cloud.ibm.com/docs/discovery-data?topic=discovery-data-query-reference
            # Link above contains the operator :: from the filter below
            discovery_json = discovery.query(
                project_id=project_id,
                filter='document_id::' + str(doc["doc_id"]),
                return_=wd_return_params,
                natural_language_query=question,
                count=num_results
            ).get_result()
            
            all_results.append(discovery_json["results"])

        # Iterate over all of the filtered WD results and prepare the passages for prompting
        for results in all_results:
            for document in results:
                document_id = document['document_id']
                passages = document['document_passages']
                results = []

                # Find the document title by its ID
                document_title = None
                for item in doc_id_list:
                    if item['doc_id'] == document_id:
                        document_title = item['doc_name']
                        break

                for item in passages:
                    # Remove the <em> and </em> tags from the passage
                    passage_text = item["passage_text"].replace("<em>", "").replace("</em>", "")
                    
                    # If document_title is available append it to the passage_text for context
                    if document_title:
                        passage_text = f"{document_title}: {passage_text}"

                    results.append(passage_text)

                # Join all passages for a single document and append to wd_contexts
                wd_contexts.append("\n".join(results))
                
    # Do a general search without filters   
    else:
        discovery_json = discovery.query(
            project_id=project_id,
            return_=wd_return_params,
            natural_language_query=question,
            count=num_results
        ).get_result()

        # Iterate over the WD results and prepare the passages for prompting
        for document in discovery_json["results"]:
            document_id = document['document_id']
            passages = document['document_passages']
            results = []

            # Find the document title by its ID
            document_title = None
            doc = discovery.get_document(
                project_id=project_id,
                collection_id=collection_id,
                document_id=document_id
            ).get_result()
            document_title = doc["filename"]

            for item in passages:
                # Remove the <em></em> tags
                passage_text = item["passage_text"].replace("<em>", "").replace("</em>", "")
                
                # If document_title is available append it to the passage_text for context
                if document_title:
                    passage_text = f"{document_title}: {passage_text}"

                results.append(passage_text)
            # Join all passages for a single document and append to wd_contexts
            wd_contexts.append("\n".join(results))

    prompt = get_custom_prompt(llm_instructions, wd_contexts, question)

    generated_response = model.generate(prompt=prompt)
    response=generated_response['results'][0]['generated_text']

    data_response = {
        "llm_response": response,
        "references": [{"node":"not implemented"}]
    }

    return queryWDLLMResponse(**data_response)

def get_custom_prompt(llm_instructions, wd_contexts, query_str):#
    context_str = "\n".join(wd_contexts)

    # Replace the placeholders in llm_instructions with the actual query and context
    prompt = llm_instructions.replace("{query_str}", query_str).replace("{context_str}", context_str)
    return prompt

if __name__ == '__main__':
    if 'uvicorn' not in sys.argv[0]:
        uvicorn.run("app:app", host='0.0.0.0', port=4050, reload=True)
