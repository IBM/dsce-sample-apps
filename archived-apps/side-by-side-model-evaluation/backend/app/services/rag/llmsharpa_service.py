import os
import logging
import numpy as np
# from numpy.linalg import norm
from pathlib import Path

from models.rag_model import LoadSelectionEnum, RagConfig
from llmsherpa.readers import LayoutPDFReader

from core.log_config import init_loggers

# import spacy
# nlp = spacy.load('en_core_web_sm')

from langchain.docstore.document import Document

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class Sentence(object):
    text: str
    vector: float
    vector_norm: float

class LLMSharpaService(object):
    def __init__(self) -> None:
        logger.info(f"--------- INIT LLMSharpaSplitter ----------")   

    async def load_documents(self, ragConfig: RagConfig, saveFolder, files = None, loadSelectionType: LoadSelectionEnum = LoadSelectionEnum.load_all):
        try:
            docs = []
            llmsherpa_api_url = os.environ.get('llmsherpa_api_url', None)
            if llmsherpa_api_url is not None:
                llmsherpa_api_url = llmsherpa_api_url + "?renderFormat=all&useNewIndentParser=yes"
            logger.info(f"Inside DocumentLoader, __LayoutPDFReader, llmsherpa_api_url: {llmsherpa_api_url}")         
            pdf_reader = LayoutPDFReader(llmsherpa_api_url)   

            input_doc_paths = []
            if files is not None:
                for file_path in files:
                    input_doc_paths.append(Path(file_path))
                    # input_doc_paths.append(file_path)
            elif saveFolder is not None:
                files = self.utils.get_file_paths(saveFolder)
                for file_path in files:
                    input_doc_paths.append(Path(file_path))
                    # input_doc_paths.append(file_path)

            for file_path in input_doc_paths:
                # file_path = saveFolder + "/"+file_
                logger.debug(f"IN LLMSharpaService.load_documents, Parsing file: {file_path}")
                doc = pdf_reader.read_pdf(file_path.as_posix())
                doc.source = file_path
                docs.append(doc)
        except Exception as err:
            # return {"output": f"{file_.split('rag_docs/')[1]} cannot be loaded, please check the name and try again"}
            logger.error(err)
            raise err
        
        return docs    

    def split_documents(self, documents):
        docs = []        
        for document in documents:
            for chunk in document.chunks():
                # parent = chunk.parent
                # if parent:
                #     chunk_text = "*Title: " +parent.title + "*\n"
                metadata = {'source': document.source}
                context_chunk = chunk.to_context_text()
                metadata['page'] = chunk.page_idx + 1
                metadata['type'] = chunk.tag
                chunked_doc = Document(page_content = context_chunk, metadata=metadata)
                docs.append(chunked_doc)
        
        logger.debug(f"IN LLMSharpaSplitter.split_documents, Total Chunks: {len(docs)}")

        return docs
   