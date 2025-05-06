import os
import logging
import uuid

from services.utils import CommonUtils
from models.rag_model import RagConfig, TextSplitterEnum
from routers.common import ServiceException
from services.rag.embeddings import EmbeddingService
from services.rag.clustering_splitter import ClusteringAdjacentSentencesSplitter
from services.rag.llmsharpa_service import LLMSharpaService

from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter, NLTKTextSplitter, SpacyTextSplitter
from langchain_experimental.text_splitter import SemanticChunker

import nltk
nltk.download('punkt')

# from main import app
from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class TextSplitterService:
    def __init__(self, utils: CommonUtils) -> None:
        logger.info(f"--------- INIT TextSplitterService ----------")
        self.utils = utils

    async def split(self, documents, ragConfig: RagConfig):
        self._text_splitter = self.__get_text_splitter(ragConfig=ragConfig)
        if self._text_splitter:
            chunks = self._text_splitter.split_documents(documents)
            logger.info(f'We have total documents after split: {len(chunks)}')
            ids = []
            metadatas = []
            text_chunks = []
            index = 0
            for chunk in chunks:
                ids.append(str(uuid.uuid1()))                
                text_chunks.append(chunk.page_content)
                file_name = os.path.basename(chunk.metadata['source'])
                metadata = {'source': file_name}
                if 'page' in chunk.metadata:
                    metadata['page'] = chunk.metadata['page']
                if 'page_number' in chunk.metadata:
                    metadata['page'] = chunk.metadata['page_number']
                if 'type' in chunk.metadata:
                    metadata['type'] = chunk.metadata['type']
                else:
                    metadata['type'] = "para"
                metadatas.append(metadata) 
                if index < 10:
                    index = index + 1
                    logger.info(f"\n\nCHUNK_{index}: >> {chunk}, metadata: {metadata}\n\n")                   

            logger.info(f'\n\n---------- TOTAL CHUNKS >>>>> : {len(text_chunks)} ------------- \n\n')
            return {"ids": ids, "metadatas": metadatas,  "text_chunks": text_chunks}
        else:
            raise ServiceException(status_code=400, detail="Invalid TextSplitter Selected, select either of CharacterTextSplitter | RecursiveCharacterTextSplitter | SemanticChunker ")
 
    def __get_text_splitter(self, ragConfig: RagConfig):
        logger.info(f"IN TextSplitterService, get_text_splitter: {ragConfig['splitter']}")
        if ragConfig['splitter'] == TextSplitterEnum.CharacterTextSplitter.value:
            self._text_splitter = CharacterTextSplitter(chunk_size=int(ragConfig['chunking_config']['chunk_size']), chunk_overlap=int(ragConfig['chunking_config']['chunk_overlap']))            
        elif ragConfig['splitter'] == TextSplitterEnum.RecursiveCharacterTextSplitter.value:
            self._text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=ragConfig['chunking_config']['chunk_size'], 
                chunk_overlap=ragConfig['chunking_config']['chunk_overlap'], 
                # separators = ragConfig['chunking_config']['separator'], 
                # separators=["\n\n", "\n", ' ', ''],
                # length_function = len_fun,
                is_separator_regex = False
                )
        elif ragConfig['splitter'] == TextSplitterEnum.SpacyTextSplitter.value:
            spacy_pipiline = "en_core_web_sm" # Options are en_core_web_sm | sentencizer
            self._text_splitter = SpacyTextSplitter(pipeline=spacy_pipiline, chunk_size=int(ragConfig['chunking_config']['chunk_size']), chunk_overlap=int(ragConfig['chunking_config']['chunk_overlap']))
        elif ragConfig['splitter'] == TextSplitterEnum.NLTKTextSplitter.value:
            self._text_splitter = NLTKTextSplitter(chunk_size=int(ragConfig['chunking_config']['chunk_size']), chunk_overlap=int(ragConfig['chunking_config']['chunk_overlap']))
        elif ragConfig['splitter'] == TextSplitterEnum.SemanticChunker.value:
            embeddingService = EmbeddingService(ragConfig=ragConfig, utils=self.utils)
            embed_model = embeddingService.get_embedding_model()
            self._text_splitter = SemanticChunker(embed_model, breakpoint_threshold_type="percentile")            
        elif ragConfig['splitter'] == TextSplitterEnum.ClusteringAdjacentSentences.value:
            self._text_splitter = ClusteringAdjacentSentencesSplitter(min_cluster_len=int(ragConfig['chunking_config']['chunk_size']), max_cluster_len=int(ragConfig['chunking_config']['chunk_overlap']))
        elif ragConfig['splitter'] == TextSplitterEnum.LLMSHERPA.value:
            self._text_splitter = LLMSharpaService()
        else:
            logger.error(f"TextSplitter Type: >> {ragConfig['splitter']}")
            raise ServiceException(status_code=400, detail="Invalid TextSplitter Selected, select either of CharacterTextSplitter | RecursiveCharacterTextSplitter | SemanticChunker | ClusteringAdjacentSentences ")

        return self._text_splitter
