
import logging
from rich.pretty import pprint

from routers.common import ServiceException, FetchContextPayload
from models.rag_model import LoadSelectionEnum, RagConfig, SourceNode, VectorDBEnum

from services.utils import CommonUtils
from services.services_factory import ServicesFactory
from services.rag.document_loader import DocumentLoader

from core.log_config import init_loggers
from pymilvus.exceptions import MilvusException

init_loggers(__name__)
logger = logging.getLogger(__name__) 

# @singleton
class RAGService:
    def __init__(self) -> None:
        logger.info("--------- INIT RAG_Service ----------")
        self.utils: CommonUtils = CommonUtils()
        self.text_splitter_obj = None
        self.vectorDbService = None 

    async def default_setup(self, ragConfig: RagConfig):
        try:
            if isinstance(ragConfig, RagConfig):
                ragConfig = ragConfig.model_dump(mode="json")  
            # db_name = ragConfig["vectordb_config"]["db_name"] 
            # db_name = VectorDBEnum.IN_MEMORY.value
            # ragConfig["vectordb_config"]["db_name"] = VectorDBEnum.IN_MEMORY.value
            collection_name =  ragConfig["vectordb_config"]["collection_name"]  
            logger.debug(f"\n\nIN RAG_API.default_setup for >>>>>> db_name : {ragConfig['vectordb_config']['db_name']}, collection_name: {collection_name} \n\n")
            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=ragConfig['vectordb_config']['db_name'])        
            collections = await self.vectorDbService.fetch_collections(REFRESH=True)
            collection_found = False
            for ix, collection in enumerate(collections):
                if collection['name'] == collection_name:
                    collection_found = True
                    print(f"DEFAULT COLLECTION EXISTS: >> {collection}")
                    break
            if collection_found == False or ragConfig["vectordb_config"]["replace"] == True  :
                print(f"CREATE DEFAULT COLLECTION: >> {collection_name}")
                cos = ServicesFactory.get_cos_service()
                file_name = f"{collection_name}.parquet"
                PARQUET_DIR_PATH = self.utils.getFromCache("TEMP_DIR") + "/parquet_dir"
                parquet_file_path = cos.file_from_cos_to_local(file_key=file_name, local_dir=PARQUET_DIR_PATH)
                # parquet_file_path = f"{PARQUET_DIR_PATH}/{file_name}"
                if parquet_file_path is None:
                    raise ServiceException(status_code=404, detail="Default Parquet File not found.  Please run the parsing on IBM_Annual_Report_2022")
                docling_service = ServicesFactory.get_docling_service()
                dl_object = docling_service.read_parquet(parquet_file_path)
                pprint(dl_object, max_length=1, max_string=50, max_depth=4)
                li_documents = docling_service.convert_to_LIDocuments(dl_object)
                nodes = await docling_service.parse_documents(li_documents, ragConfig=ragConfig)
                self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=ragConfig["vectordb_config"]["db_name"])
                await self.vectorDbService.save_nodes(nodes=nodes, ragConfig=ragConfig)
                logger.debug(f"\n\nTOTAL NODES SAVED SUCCESSFULLY IN DB: {len(nodes)}\n\n")
                return {"count": len(nodes)}
            else:
                return {"count": 0, "message": "COLLECTION ALREADY EXISTS" }
        except ServiceException as se:
            raise se
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)        

    async def load_docs_in_db(self, savedFiles = None, ragConfig: RagConfig = None):
        try:
            if savedFiles is None:
                raise Exception("SavedFiles empty, so nothing to load in DB !")        
            
            logger.info(f"\n\n--------- LOADING {savedFiles} documents in VectorDB ----------- ")
            if ragConfig is None:
                ragConfig = RagConfig()
            
            if isinstance(ragConfig, RagConfig):
                ragConfig = ragConfig.model_dump(mode="json")  
            elif isinstance(ragConfig, str):
                ragConfig = RagConfig.model_validate_json(ragConfig)
                ragConfig = ragConfig.model_dump(mode="json")  
        
            # dataset_dir = self.utils.getFromCache("DATASET_DIR")
            # prefix = f"{ragConfig['vectordb_config']['db_name']}/{ragConfig['vectordb_config']['collection_name']}"
            # dataset_dir = f"{dataset_dir}/{prefix}"

            document_loader_obj = DocumentLoader(loadSelectionType = LoadSelectionEnum.load_all)        
            nodes = await document_loader_obj.load(ragConfig=ragConfig, saveFolder=None, files=savedFiles)
            logger.debug(f"\n\nTOTAL NODES TO SAVE IN DB: {len(nodes)}")
            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=ragConfig["vectordb_config"]["db_name"])
            await self.vectorDbService.save_nodes(nodes=nodes, ragConfig=ragConfig)
            logger.debug(f"\n\nTOTAL NODES SAVED SUCCESSFULLY IN DB: {len(nodes)}\n\n")
            result = {"count": len(nodes)}
            return result
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)
        
    
    async def fetch_context(self, payload: FetchContextPayload):
        # data = payload.model_dump(mode="json")
        try:
            if isinstance(payload, FetchContextPayload):
                payload = payload.model_dump(mode="json") 
            logger.info(f"\n\nIN RAG_API.fetchContext with payload: {payload}\n\n")

            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=payload["vectordb_config"]["db_name"])
            context_docs = await self.vectorDbService.fetch_context(payload=payload)
            # logger.debug(f"IN RAG_SERVICE.fetchContext with context: {context_docs}\n\n")
            return context_docs
        except MilvusException as me:
            raise ServiceException(status_code=404, detail=me.message, err=me)
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)

    async def resetRag(self, ragConfig): 
        try:
            # ragConfig = ragConfig.model_dump(mode="json")                
            if isinstance(ragConfig, RagConfig):
                ragConfig = ragConfig.model_dump(mode="json") 
            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=ragConfig["vectordb_config"]["db_name"])
            await self.vectorDbService.reset_db()

            DATASET_DIR = self.utils.getFromCache("DATASET_DIR")
            # for filename in glob.iglob(DATASET_DIR+"/**/*", recursive=True):
            #     os.remove(filename)
            self.utils.deleteDirectoryContent(DATASET_DIR, ignore="default")
            VECTORDB_DIR = self.utils.getFromCache("VECTORDB_DIR")
            # os.makedirs(os.path.dirname(VECTORDB_DIR), exist_ok=True)
            self.utils.deleteDirectoryContent(VECTORDB_DIR, ignore="chroma")
            return True
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)
    
    async def fetch_collections(self, ragConfig: RagConfig):
        # data = ragConfig.model_dump(mode="json") 
        try:
            if isinstance(ragConfig, RagConfig):
                ragConfig = ragConfig.model_dump(mode="json")  
            db_name = ragConfig["vectordb_config"]["db_name"]      
            logger.debug(f"\n\nIN RAG_API.fetch_collections for >>>>>> db_name : {db_name} \n\n")
            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=db_name)        
            return await self.vectorDbService.fetch_collections(REFRESH=True)
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)
    
    async def delete_collection(self, collection_name: str, dbName: VectorDBEnum = VectorDBEnum.MILVUSDB):
        try:
            logger.debug(f"\n\nIN RAG_SERVICE.delete_collection >>>>>> dbName: {dbName}, collection_name: {collection_name} \n\n")
            self.vectorDbService = ServicesFactory.get_vectordb_service(dbName=dbName.value)        
            return await self.vectorDbService.delete_collection(collection_name)
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)
        
    async def showSourceOnPage(self, sourceNode: SourceNode):
        try:
            result = None
            # logger.debug(f"\n\nIN RAG_SERVICE.showSourceOnPage >>>>>> sourceNode: {sourceNode} \n\n")
            if isinstance(sourceNode, SourceNode):
                sourceNode = sourceNode.model_dump(mode="json")  

            cos = ServicesFactory.get_cos_service()
            result = cos.get_file_url(file_key=sourceNode['filename'])

            # utils: CommonUtils = ServicesFactory.get_common_utils()
            # dataset_dir = utils.getFromCache("TEMP_DIR")
            # if 'prefix' in sourceNode:
            #     dataset_dir = f"{dataset_dir}/{sourceNode['prefix']}"
            # files = utils.get_file_paths(dataset_dir)
            # for file_path in files:
            #     if sourceNode['filename'] in file_path:
            #         result = file_path
            
            return result
        except Exception as err:
            logger.error(err)
            raise ServiceException(err)
     

        
  
	