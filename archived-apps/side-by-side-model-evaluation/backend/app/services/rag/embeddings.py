
import logging
import torch

from models.rag_model import EmbeddingModelEnum
from services.utils import CommonUtils

from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from langchain_ibm import WatsonxEmbeddings

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 
class EmbeddingService:
    def __init__(self, embedding_model_id: str) -> None:
        self.utils: CommonUtils = CommonUtils()
        self.embedding_model_: str = embedding_model_id
        self.wx_embeddings = None        
        # logger.info(f"--------- INIT EmbeddingService, Type: {self.type_ } ----------")

    def get_dimension(self):
        if self.embedding_model_ is None:
            self.embedding_model_ = EmbeddingModelEnum.BAAI_bge_small_en_v15.value

        if self.embedding_model_ == EmbeddingModelEnum.WX_slate_125m_english_rtrvr.value:
            return 768
        
        if self.embedding_model_ == EmbeddingModelEnum.WX_slate_30m_english_rtrvr.value:
            return 384

        embedding_model = self.get_embedding_model()
        return len(embedding_model.get_text_embedding("hi"))  

    def get_embedding_model(self):
        if self.embedding_model_ == EmbeddingModelEnum.WX_slate_125m_english_rtrvr.value or self.embedding_model_ == EmbeddingModelEnum.WX_slate_30m_english_rtrvr.value:
            return self.__get_wx_embeddings()
        else:
            # model_kwargs = {'device': self.__get_device()}
            # encode_kwargs = {'normalize_embeddings': True}
            embedding_model = HuggingFaceEmbedding(
                model_name=self.embedding_model_,
                # model_kwargs=model_kwargs,
                # encode_kwargs=encode_kwargs
            )
            return embedding_model     
            
    def __get_device(self):
        use_cuda = torch.cuda.is_available()
        device = torch.device("cuda" if use_cuda else "cpu") 
        if use_cuda:
            logger.info('\n\n__CUDNN VERSION:', torch.backends.cudnn.version())
            logger.info('__Number CUDA Devices:', torch.cuda.device_count())
            logger.info('__CUDA Device Name:', torch.cuda.get_device_name(0))
            logger.info('__CUDA Device Total Memory [GB]:', torch.cuda.get_device_properties(0).total_memory/1e9)
        else:    
            logger.info(f"\n\nIN __get_device, Device: {device}")

        logger.info(f"IN __get_device, GPU is Available: {torch.cuda.is_available()}")
        logger.info(f"IN __get_device, GPU is Enabled: {torch.backends.cudnn.enabled}\n\n")
        return device
                
    def __get_wx_embeddings(self):
        if not self.wx_embeddings:
            model_id = self.embedding_model_
            self.wx_embeddings = WatsonxEmbeddings(
                model_id=model_id,
                apikey=self.utils.getFromCache('IBMCLOUD_API_KEY'),
                url=self.utils.getFromCache('WX_ENDPOINT'),                
                project_id=self.utils.getFromCache('WX_PROJECT_ID')
            )
        return self.wx_embeddings
