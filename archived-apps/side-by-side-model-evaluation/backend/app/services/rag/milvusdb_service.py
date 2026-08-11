
import os
import logging
from dotenv import load_dotenv

from core.log_config import init_loggers
import json
from tqdm import tqdm

from pydantic import TypeAdapter
# from tempfile import TemporaryDirectory

from pymilvus import MilvusClient
from rich.pretty import pprint

from routers.common import FetchContextPayload, RagConfig, VectorDbConfig
from models.rag_model import EmbeddingModelEnum, VectorDBEnum
from services.utils import CommonUtils, singleton
from services.rag.embeddings import EmbeddingService

from llama_index.core import Settings
from llama_index.core import VectorStoreIndex, StorageContext, load_index_from_storage
from llama_index.vector_stores.milvus import MilvusVectorStore
from llama_index.core.callbacks import (
    CallbackManager,
    LlamaDebugHandler,
    CBEventType,
)

from llama_index.core.vector_stores import (
    MetadataFilter,
    MetadataFilters,
    FilterOperator,
)

# from llama_index.core.retrievers import AutoMergingRetriever
# from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.schema import QueryBundle
# from llama_index.core.postprocessor import SentenceTransformerRerank


load_dotenv()
init_loggers(__name__)
logger = logging.getLogger(__name__) 

@singleton
class MilvusDBService(object):
    def __init__(self, IN_MEMORY=True):
        logger.info(f"\n\nIN MilvusDBService, init -----------{IN_MEMORY} \n\n")
        self.utils: CommonUtils = CommonUtils()
        self.utils.checkDirectories()
        self.IN_MEMORY = IN_MEMORY
        self.collection_name = None
        self.dimensions = 1024
        self.METRIC_TYPE = 'L2' # IP
        self.INDEX_TYPE = 'IVF_FLAT' # For Running Locally || IVF_FLAT || HNSW
        self._client = None
        self.vector_store = None
        self.index = None 
        self.embed_model = None  
        self.vector_store = None   

    def init_client(self, refresh=False):
        if self._client is None or refresh == True:
            MILVUS_ENDPOINT = self.utils.getFromCache('MILVUS_ENDPOINT')
            MILVUS_USER = self.utils.getFromCache('MILVUS_USER')
            IBMCLOUD_API_KEY = self.utils.getFromCache('IBMCLOUD_API_KEY')
            # logger.debug(f"\n\nIN MilvusDBService.init_client => MILVUS_ENDPOINT: {MILVUS_ENDPOINT}, MILVUS_USER: {MILVUS_USER}\n\n")
            if MILVUS_ENDPOINT is None or self.IN_MEMORY:
                self.INDEX_TYPE = 'HNSW'
                DB_PATH = self.utils.getFromCache('VECTORDB_DIR')+ "/milvus_demo.db"
                self._client = MilvusClient(DB_PATH, db_name="default")
            elif MILVUS_USER is not None and IBMCLOUD_API_KEY is not None:  
                self._client = MilvusClient(
                    uri=MILVUS_ENDPOINT,
                    user=MILVUS_USER,
                    password=IBMCLOUD_API_KEY,
                    # db_name="default"
                ) 
            else:
                self._client = None

        return self._client

    async def save_nodes(self, nodes, ragConfig: RagConfig):
        logger.debug(f"IN save_nodes, total nodes: {len(nodes)}, ragConfig:>>>>> {ragConfig}")
        embedding_model_id = ragConfig["vectordb_config"]["embedding_model"]
        embeddingService = EmbeddingService(embedding_model_id=embedding_model_id)
        embed_model = embeddingService.get_embedding_model()
        dimension = embeddingService.get_dimension()
        db_name = ragConfig["vectordb_config"]["db_name"]
        collection_name = ragConfig["vectordb_config"]["collection_name"]
        OVERWRITE = ragConfig["vectordb_config"]["replace"]
        vector_store = self.__get_vector_store(db_name=db_name, collection_name=collection_name, dimension=dimension, OVERWRITE=OVERWRITE, REFRESH=True)
        # self.utils.setInUserCache("vector_store", vector_store)
        llama_debug = LlamaDebugHandler(print_trace_on_end=True)
        callback_manager = CallbackManager([llama_debug])        
        REPLACE = ragConfig["vectordb_config"]["replace"]

        MILVUS_COLL_NAME = ragConfig["vectordb_config"]["collection_name"]
        if REPLACE:            
            logger.debug(f"\n\n Create new INDEX for {MILVUS_COLL_NAME}>>>>>>>>>> \n\n")
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            self.index = VectorStoreIndex(nodes, storage_context=storage_context, callback_manager=callback_manager, embed_model=embed_model)
            self.utils.setInDB(MILVUS_COLL_NAME, {"db_name": ragConfig["vectordb_config"]["db_name"], "embedding_model": ragConfig["vectordb_config"]["embedding_model"]})
        else:
            logger.debug(f"\n\n LOAD INDEX for {MILVUS_COLL_NAME}>>>>>>>>>> \n\n")
            # in this case we just load the vector store index
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                embed_model=embed_model,
            )
        # self.utils.setInUserCache("vector_index", self.index)
        return self.index

    async def reset_db(self):
        try:
            self._client = self.init_client()
            if self._client:
                collections = self._client.list_collections()
                logger.info(f"------ IN MilvusDBService.reset_db, Total Collections: {len(collections)} -------- ")
                if collections and len(collections) > 0:
                    for collection in collections:
                        self._client.drop_collection(collection)
                        logger.info(f'{collection} collection removed from MilvusDB')
                self._client.close()
                # self._client = None
                self._client = self.init_client(refresh=True)
                logger.info(f'IN MilvusDBService.reset_db, MilvusDB Reset: CLIENT_CLOSED \n\n')
                return True
            return True
        except ValueError as err:
            logger.error("ValueError in reset_db: ", err)
            return False
    
    async def delete_collection(self, collection_name: str):
        logger.info(f'IN MilvusDBService.delete_collection, {collection_name}')
        try:
            self._client = self.init_client()
            if self._client:
                self._client.drop_collection(collection_name)
                self.utils.setInDB(collection_name, None)
                logger.info(f'IN MilvusDBService.delete_collection, {collection_name} DROPPED \n\n')
                return True
            return True
        except ValueError as err:
            logger.error("ValueError in delete_collection: ", err)
            return False
        
       
    async def fetch_collections(self, REFRESH=False):
        try:
            logger.debug(f"------ IN MilvusDBService.fetch_collections, IN_MEMORY: {self.IN_MEMORY} -------- ")
            self._client = self.init_client(refresh=REFRESH)
            if self._client:
                collections = self._client.list_collections() 
                result = []
                for collection in collections:                    
                    # resp = self._client.describe_collection(collection_name=collection)
                    # logger.debug(f"\nCollection: {resp} \n")
                    metadata = self.utils.getFromDB(collection)
                    result.append({"name": collection, "metadata": metadata})
                logger.debug(f"------ IN MilvusDBService.fetch_collections, Collections: {collections} -------- ")
                return result  
            else:
                return None          
        except ValueError as err:
            logger.error("ValueError in fetch_collections: ", err)
            return None
        
    def fetch_index(self, payload: VectorDbConfig, REFRESH=True):
        if isinstance(payload, VectorDbConfig):
            payload = payload.model_dump(mode="json") 

        if self.collection_name != payload["collection_name"]:
            # collection_metadata = self.utils.getFromDB(self.collection_name)
            # if collection_metadata and 'embedding_model' in collection_metadata and collection_metadata['embedding_model'] != payload["embedding_model"]:
            #     REFRESH = True
            REFRESH = True

        embedding_model_id = payload["embedding_model"]
        embeddingService = EmbeddingService(embedding_model_id=embedding_model_id)
        if self.embed_model == None:            
            self.embed_model = embeddingService.get_embedding_model()            
        else:
            logger.info("\n\n<<<<<<<<<<< EMBEDDING IS NOT NONE >>>>>>>>>>>")

        if self.index == None or REFRESH == True:
            logger.debug(f"\n\nIN fetch_index, payload: {payload}\n\n")            
            dimension = embeddingService.get_dimension()
            db_name = payload["db_name"]
            self.collection_name = payload["collection_name"]
            self.vector_store = self.__get_vector_store(db_name=db_name, collection_name=self.collection_name, dimension=dimension, OVERWRITE=False, REFRESH=REFRESH)
            self.index = VectorStoreIndex.from_vector_store(
                # index_name=self.collection_name,
                # similarity_metric="L2",
                vector_store=self.vector_store,
                embed_model=self.embed_model,
            )
        else:
            logger.info(f"\n\n<<<<<<<< INDEX IS NOT NONE and REFRESH is FALSE: {REFRESH} >>>>>>>>>\n\n")
        
        return self.index, self.embed_model, self.vector_store
        
    async def fetch_context(self, payload: FetchContextPayload):
        logger.debug(f"IN fetch_context, payload: {payload}")
        self.index, self.embed_model, self.vector_store = self.fetch_index(payload["vectordb_config"], REFRESH=False)
    
        logger.debug(f"\n\nIN fetch_context, query: {payload['query']} fetch_count: {payload['fetch_count']}, where: {payload['where']}\n\n")
        # retriever = VectorIndexRetriever(
        #     index=self.index,  # VectorStoreIndex instance with local embedding model
        #     similarity_top_k=payload["fetch_count"],  # number of top k results to return
        #     # vector_store_query_mode=VectorStoreQueryMode.DEFAULT,  # vector store query mode
        #     filters=None,  # metadata filters, defaults to None
        #     alpha=None,  # weight for sparse/dense retrieval, only used for hybrid query mode
        #     node_ids=None,  # list of nodes to constrain search
        #     doc_ids=None,  # list of documents to constrain search
        #     sparse_top_k=None,  # number of top k results to return for sparse retrieval
        # )

        meta_filters = []
        if payload['where'] is not None and len(payload['where']) > 0:
            for ix, condition in enumerate(payload['where']):
                meta_filters.append(
                    MetadataFilter(key=condition['key'], operator=condition['operator'], value=condition['value'])               
                )

        filters = None
        if len(meta_filters) > 0:
            filters = MetadataFilters(
                filters=meta_filters
            )
            pprint(filters, max_length=10, max_string=50, max_depth=4)

        base_retriever = self.index.as_retriever(
            verbose=True,
            filters=filters, 
            similarity_top_k=payload["fetch_count"]
            )

        # storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        # retriever = AutoMergingRetriever(base_retriever, storage_context, verbose=True)       
        query_bundle = QueryBundle(
                        query_str=payload["query"]
                        )  
        retrieved_nodes = base_retriever._retrieve(query_bundle)
        # pprint(retrieved_nodes, expand_all=True)

        # postprocessor = SentenceTransformerRerank(model="cross-encoder/ms-marco-MiniLM-L-2-v2", top_n=payload["fetch_count"])
        # reranked_nodes = postprocessor.postprocess_nodes(nodes=retrieved_nodes, query_bundle=query_bundle)
        # pprint(reranked_nodes, expand_all=True)
        # pprint(retrieved_nodes, max_length=10, max_string=50, max_depth=4)
        return retrieved_nodes
        

    
    def __get_vector_store(self, db_name: str, collection_name: str, dimension: int, OVERWRITE: bool=True, REFRESH: bool = True):
        logger.debug(f"\n\nIN __get_vector_store, db_name: {db_name}, collection_name: {collection_name}, OVERWRITE: {OVERWRITE}")
        # vector_store = self.utils.getFromUserCache("vector_store")
        if self.vector_store is not None and REFRESH == False:
            return self.vector_store
        
        if db_name == VectorDBEnum.IN_MEMORY.value:
            # logger.debug(f"IN __get_vector_store, db_name: IN_MEMORY\n\n")
            MILVUS_ENDPOINT = self.utils.getFromCache('VECTORDB_DIR')+ "/milvus_demo.db"
            MILVUS_USER=None
            IBMCLOUD_API_KEY=None
        else:
            # logger.debug(f"IN __get_vector_store, db_name: MILVUSDB \n\n")
            MILVUS_ENDPOINT = self.utils.getFromCache('MILVUS_ENDPOINT')
            MILVUS_USER = self.utils.getFromCache('MILVUS_USER')
            IBMCLOUD_API_KEY = self.utils.getFromCache('IBMCLOUD_API_KEY')
            
        MILVUS_KWARGS = TypeAdapter(dict).validate_json(os.environ.get("MILVUS_KWARGS", "{}"))
        
        logger.debug(f"\n\nCREATING MilvusVectorStore for MILVUS_COLL_NAME: {collection_name}, OVERWRITE: {OVERWRITE}\n\n")

        self.vector_store = MilvusVectorStore(
            uri=MILVUS_ENDPOINT,
            user=MILVUS_USER,
            password=IBMCLOUD_API_KEY,
            collection_name=collection_name,
            dim=dimension,
            overwrite=OVERWRITE,
            search_config=None,
            hybrid_ranker="RRFRanker",
            hybrid_ranker_params={"k": 60},
            # index_management="create_if_not_exists",
            # similarity_metric="cosine",
            # index_config={
            #     "index_type": "",
            #     "index_name": "default_index",
            #     "params": {
            #         "metric_type" : "COSINE"
            #     } 
            # },
            **MILVUS_KWARGS
        )

        # self.utils.setInUserCache("vector_store", self.vector_store)
        # logger.debug(f"\n\n\n <<<<<<<<<<<<<< vector_store CREATED >>>>>>>>>>>>> \n\n\n")
        return self.vector_store
    
    def __is_empty(self, collection_name: str):
        result = self._client.get_collection_stats(collection_name)
        if result and "row_count" in result and result["row_count"] > 0:
            return False
        else:
            return True
    
    # async def __get_client(self, embedding_model_id: str, db_name: str, collection_name: str, OVERWRITE=True):
    #     # embedding_model_id = ragConfig["vectordb_config"]["embedding_model"]
    #     embeddingService = EmbeddingService(embedding_model_id=embedding_model_id)
    #     embed_model = embeddingService.get_embedding_model()
    #     # db_name = ragConfig["vectordb_config"]["db_name"]
    #     # collection_name = ragConfig["vectordb_config"]["collection_name"]
    #     # OVERWRITE = ragConfig["vectordb_config"]["replace"]
    #     vector_store = await self.__get_vector_store(db_name=db_name, collection_name=collection_name, embed_model=embed_model, OVERWRITE=OVERWRITE)
    #     return vector_store.client
        
    # async def query(self, ragConfig: RagConfig, query_texts:str, k:int=3, where={}):
    #     """
    #     Returns the closests vector to the question vector
    #     :param query_texts: the question
    #     :param k: number of results to generate
    #     :return: the closest result to the given question
    #     """
    #     embeddingService = EmbeddingService(ragConfig=ragConfig)
    #     embeddingFunction = embeddingService.get_embedding_function()
    #     # data = embeddingFunction(query_texts)
    #     embeddings = embeddingFunction.__call__([query_texts])
    #     logger.info(f"Query: >> {query_texts}, Where params: {where}")

    #     output_fields = ["text", "source", "page", "type"]
    #     # output_fields = ["text"]

    #     if where and 'filter' in where:
    #         filter = where['filter']
    #     else:
    #         filter = None

    #     res = self._client.search(
    #         collection_name=ragConfig['vectordb_config']["collection_name"], # Replace with the actual name of your collection
    #         data=embeddings, # Replace with your query vectors
    #         limit=k, # Max. number of search results to return
    #         search_params={"metric_type": self.METRIC_TYPE, "params": where}, # Search parameters
    #         output_fields=output_fields,
    #         filter=filter
    #     )

    #     # result = json.dumps(res, indent=4)
    #     return res
        
     # def __setup_collection(self, ragConfig: RagConfig, delete_if_exists = False):
    #     logger.info(f"IN __setup_collection, collection_name: {ragConfig['vectordb_config']['collection_name']}, delete_if_exists: {delete_if_exists}, INDEX_TYPE: {self.INDEX_TYPE} ") 
    #     if ragConfig is None:
    #         ragConfig = self.utils.getFromCache('ragConfig')

    #     if ragConfig["vectordb_config"]["embedding_model"] == EmbeddingModelEnum.ALL_MINILM_L6_V2.value:
    #         self.dimensions = 384

    #     if ragConfig["vectordb_config"]["embedding_model"] == EmbeddingModelEnum.INSTRUCTOR_LARGE.value:
    #         self.dimensions = 768

    #     if ragConfig["vectordb_config"]["embedding_model"] == EmbeddingModelEnum.MXBAI_EMBED_LARGE_V1.value:
    #         self.dimensions = 1024

    #     try:
    #         hasCollection = self._client.has_collection(ragConfig["vectordb_config"]["collection_name"])
    #         collectionLoaded = False
    #         if hasCollection:
    #             if delete_if_exists:
    #                 if 'replace' in ragConfig['vectordb_config'] and ragConfig['vectordb_config']['replace'] == True:
    #                     self._client.drop_collection(ragConfig["vectordb_config"]["collection_name"])
    #                     logger.debug(f"Collection Dropped: {ragConfig['vectordb_config']['collection_name']} ") 
    #             else:
    #                 resp = self._client.load_collection(
    #                     collection_name=ragConfig["vectordb_config"]["collection_name"],
    #                     replica_number=1 # Number of replicas to create on query nodes. Max value is 1 for Milvus Standalone, and no greater than `queryNode.replicas` for Milvus Cluster.
    #                 )
    #                 collectionLoaded = True
    #     except ValueError:
    #         logger.error(f"Collection does not exist: {ragConfig['vectordb_config']['collection_name']} ") 

    #     if collectionLoaded == False:
    #         schema = MilvusClient.create_schema(
    #             auto_id=False,
    #             enable_dynamic_field=True,
    #         )
    #         # 2. Add fields to schema
    #         schema.add_field(field_name="id", datatype=DataType.VARCHAR, is_primary=True, max_length=64)
    #         schema.add_field(field_name="text", datatype=DataType.VARCHAR, max_length=6144)
    #         schema.add_field(field_name="embedding", datatype=DataType.FLOAT_VECTOR, dim=self.dimensions)
    #         schema.add_field(field_name="source", datatype=DataType.VARCHAR, max_length=200, description='source of document')
    #         schema.add_field(field_name="page", datatype=DataType.INT8, description='Page number')
    #         schema.add_field(field_name="type", datatype=DataType.VARCHAR, max_length=30, description='Content Type')

    #         # 3. Prepare index parameters
    #         index_params = self._client.prepare_index_params()
    #         index_params.add_index(
    #             field_name="type", # Name of the scalar field to be indexed
    #             index_type="", # Type of index to be created. For auto indexing, leave it empty or omit this parameter.
    #             index_name="default_index" # Name of the index to be created
    #         )
                
    #         index_params.add_index(
    #             field_name="embedding", 
    #             index_type=self.INDEX_TYPE,
    #             metric_type=self.METRIC_TYPE,
    #             params={"nlist": self.dimensions}
    #         )

    #      # 5. Create a collection
    #         self._collection = self._client.create_collection(
    #             collection_name=ragConfig["vectordb_config"]["collection_name"],
    #             schema=schema,
    #             index_params=index_params,
    #             enable_dynamic_field=True,
    #             # consistency_level="Strong",
    #             dimension=self.dimensions,
    #             properties={"metadata": {"embedding": ragConfig["vectordb_config"]["embedding"], "embedding_model": ragConfig["vectordb_config"]["embedding_model"]}}                 
    #         )

    #         # self._client.create_index(
    #         #     collection_name=ragConfig["vectordb_config"]["collection_name"],
    #         #     index_params=index_params
    #         # )

    #     return self._collection

     # async def save_chunks(self, chunks, ragConfig: RagConfig):
    #     result = {"status":"LOADING", "total_chunks": 0}
    #     self._collection = self.__setup_collection(ragConfig, delete_if_exists=True)
    #     if self.__is_empty(ragConfig) or ragConfig['vectordb_config']['replace'] == True:
    #         # self._collection.upsert(ids=chunks["ids"], metadatas=chunks["metadatas"], documents=chunks["text_chunks"])  
    #         embeddingService = EmbeddingService(ragConfig=ragConfig)
    #         embeddingFunction = embeddingService.get_embedding_function()
    #         # logger.debug(f"EmbeddingFunction: >> {embeddingFunction}")            
    #         data = []
    #         logger.info(f"IN save_chunks, Total documents to embed and load: {len(chunks['text_chunks'])}")
    #         embeddings = embeddingFunction.__call__(chunks["text_chunks"])
    #         # quantize_embeddingsbinary_embeddings = quantize_embeddings(embeddings, precision="binary")
    #         for i, chunk in enumerate(chunks["text_chunks"]):
    #             # if i < 5:
    #             row_Data = {
    #                 "id": chunks["ids"][i],
    #                 "embedding": embeddings[i],
    #                 "text": chunk
    #             }
    #             if 'source' in chunks["metadatas"][i]:
    #                 row_Data['source'] = chunks["metadatas"][i]['source']
    #             if 'page' in chunks["metadatas"][i]:
    #                 row_Data['page'] = chunks["metadatas"][i]['page']
    #             if 'page_number' in chunks["metadatas"][i]:
    #                 row_Data['page'] = chunks["metadatas"][i]['page_number']
    #             if 'type' in chunks["metadatas"][i]:
    #                 row_Data['type'] = chunks["metadatas"][i]['type']
    #             # if len(chunk) > 2048:
    #             #     logger.info(f"\n\nChunk Length: {len(chunk)}\n")
    #             #     logger.info(f"Chunk: {chunk}\n\n")
    #             data.append(row_Data)
            
    #         if len(data) > 0:
    #             total_inserted = self.insert_data(ragConfig=ragConfig, records=data, BATCH_SIZE=256)
    #             status = "LOADED"                
    #             logger.info(f"IN load_documents, {total_inserted} DOCUMENTS LOADED IN: {ragConfig['vectordb_config']['collection_name']} colection")                            
    #     else:
    #         logger.debug(f"IN load_documents, DOCUMENTS ALREADY EXISTS IN: {ragConfig['vectordb_config']['collection_name']} colection")
    #         status = "EXISTS"           
        
    #     result = self._client.get_collection_stats(ragConfig['vectordb_config']["collection_name"])
    #     result["status"] = status
    #     if result and "row_count" in result and result["row_count"] > 0:
    #         # result['total_chunks'] = self._collection.count()
    #         result['total_chunks'] = result["row_count"]

    #     return result
    
    # def insert_data(self, ragConfig: RagConfig, records, BATCH_SIZE=256):
    #     logger.info("Inserting Data....")
    #     num_records = len(records)
    #     num_batches = (num_records + BATCH_SIZE - 1) // BATCH_SIZE
    #     logger.debug(f"Number of Records: {num_records}, Batch Size: {BATCH_SIZE}, Number of batches: {num_batches}")
    #     for i in tqdm(range(num_batches)):
    #         start_idx = i * BATCH_SIZE
    #         end_idx = min((i + 1) * BATCH_SIZE, num_records)
    #         logger.debug(f"Start Index: {start_idx} || End Index : {end_idx}")
    #         batch = records[start_idx:end_idx]
    #         # collection.insert(batch)
    #         res = self._client.insert(
    #                 collection_name=ragConfig['vectordb_config']['collection_name'],
    #                 data=batch,
    #                 timeout=50
    #             )
    #         logger.info(f"Batch {i+1}/{num_batches} Completed")
    #     return num_records
    

