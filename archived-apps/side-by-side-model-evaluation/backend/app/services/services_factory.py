
import logging

from models.rag_model import LoadersEnum, VectorDBEnum
from services.rag.milvusdb_service import MilvusDBService
from services.utils import CommonUtils
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class ServicesFactory:

    @staticmethod
    def get_loader_service(loaderType: LoadersEnum = LoadersEnum.LlamaIndexLoader):
        logger.debug(f"Inside ServicesFactory.init, get_loader_service: {loaderType}")         
        if loaderType == LoadersEnum.LlamaIndexLoader:
            return ServicesFactory.get_llamaindex_service()     
        elif loaderType == LoadersEnum.IBMDoclingLoader:
            return ServicesFactory.get_docling_service()         
        elif loaderType == LoadersEnum.LLMSherpaLoader:
            return ServicesFactory.get_llmsherpa_service() 
        else:
            raise ServiceException(status_code=400, detail="Invalid Loader Selected, select either of LlamaIndexLoader | IBMDoclingLoader | LLMSherpaLoader")
        
    @staticmethod
    def get_common_utils():
        return CommonUtils()

    @staticmethod
    def get_cos_service():
        from services.cos_service import COSService
        return COSService()
    
    @staticmethod
    def get_llamaindex_service():
        from services.rag.llmaindex_service import LlamaIndexService
        return LlamaIndexService()
    
    @staticmethod
    def get_docling_service():
        from services.rag.docling.docling_service import DoclingService
        return DoclingService()
    
    @staticmethod
    def get_llmsherpa_service():
        from services.rag.llmsharpa_service import LLMSharpaService
        return LLMSharpaService()
        
    @staticmethod
    def get_rag_service():
        from services.rag.rag_service import RAGService
        return RAGService()
    
    @staticmethod
    def get_evaluation_service():
        from services.evaluation.evaluation_service import EvaluationService
        return EvaluationService()  
    
    @staticmethod
    def get_vectordb_service(dbName: VectorDBEnum = VectorDBEnum.MILVUSDB ):        
        if dbName == VectorDBEnum.MILVUSDB.value:
            logger.info(f"\n\nIN get_vectordb_service, MILVUSDB: {dbName} ----------- \n\n")
            instance_ = MilvusDBService(IN_MEMORY=False)  
            instance_.IN_MEMORY = False
            return instance_                       
        
        if dbName == VectorDBEnum.IN_MEMORY.value:
            logger.info(f"\n\nIN get_vectordb_service, IN_MEMORY: {dbName} ----------- \n\n")
            instance_ = MilvusDBService(IN_MEMORY=True)  
            instance_.IN_MEMORY = True
            return instance_                    
        else:
            logger.error(f"\n\nIN get_vectordb_service >> DOES NOT MATCH WITH CHROMADB or MILVUSDB \n\n")
                           
        return None
    
    @staticmethod
    def get_ws_service():
        from services.ws_connection_service import ConnectionManager
        return ConnectionManager()  
                


