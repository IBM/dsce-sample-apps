
import os
import re
from io import StringIO
import base64
import os
from urllib.parse import urlparse
# import datetime
# import time
from pathlib import Path
import pandas as pd
from tempfile import TemporaryDirectory
from services.services_factory import ServicesFactory
from pydantic import BaseModel
import logging

# from models.common import ServiceException
from models.rag_model import LoadSelectionEnum, RagConfig, TextSplitterEnum
from services.utils import CommonUtils
from services.rag.embeddings import EmbeddingService

from llama_index.core import SimpleDirectoryReader, Settings
from llama_index.core.node_parser import (
    SentenceSplitter,
    SemanticSplitterNodeParser,
    TokenTextSplitter,
    HierarchicalNodeParser,
    MarkdownNodeParser
)
from llama_index.core.schema import TextNode, NodeRelationship, RelatedNodeInfo
from llama_index.core.schema import Document as LIDocument
# from llama_index.readers.docling import DoclingReader
# from llama_index.node_parser.docling import DoclingNodeParser

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class DocumentMetadata(BaseModel):
    dl_doc_hash: str

# @singleton
class LlamaIndexService:

    def __init__(self) -> None:
        self.utils: CommonUtils = CommonUtils()
        logger.info(f"Inside LlamaIndexService >>>>>>>>> ")
        
    async def load_documents(self, ragConfig: RagConfig, saveFolder, files = None, loadSelectionType: LoadSelectionEnum = LoadSelectionEnum.load_all):
        try:
            nodes = []
            docs = []
            cos = ServicesFactory.get_cos_service()
            local_dir = (tmp_dir := TemporaryDirectory()).name
            if saveFolder is not None:
                loader = SimpleDirectoryReader(input_dir=saveFolder, recursive=True)
                docs = loader.load_data()
            elif files is not None and len(files) > 0:
                folders = []
                for file_path in files:
                    if "https" in file_path:
                        a = urlparse(file_path)
                        file_key = os.path.basename(a.path)
                        file_path = cos.file_from_cos_to_local(file_key=file_key, local_dir=local_dir)

                    folderPath = os.path.dirname(file_path)
                    if folderPath not in folders:
                        folders.append(folderPath)
                temp_docs = []
                for folder in folders:
                    logger.debug(f"LOAD_DATA FROM DOCS IN: {folder}")
                    loader = SimpleDirectoryReader(input_dir=folder, recursive=True)
                    temp_docs = loader.load_data()
                docs.extend(temp_docs)                
            
            if docs and len(docs) > 0:
                logger.debug(f"\n\nInside LlamaIndexService.load_documents, TOTAL DOCS COUNT >>>>>>>>> {len(docs)} loaded")
                nodes = await self.split_documents(docs, ragConfig=ragConfig) 
            
            return nodes              
        except Exception as err:
            logger.error(err)
            raise err
        
    async def split_documents(self, docs, ragConfig: RagConfig): 
        logger.info(f"Inside LlamaIndexService.split_documents >>>>>>>>> {ragConfig['splitter']}")
        Settings.chunk_size = int(ragConfig['chunk_size'])
        if ragConfig['splitter'] == TextSplitterEnum.TokenTextSplitter.value:
            splitter = TokenTextSplitter(chunk_size=int(ragConfig['chunk_size']), chunk_overlap=int(ragConfig['chunk_overlap']), separator=ragConfig['chunk_separator'])  
            nodes = splitter.get_nodes_from_documents(docs)
            return nodes
        
        if ragConfig['splitter'] == TextSplitterEnum.SemanticSplitter.value:
            embeddingService = EmbeddingService(ragConfig=ragConfig)
            embed_model = embeddingService.get_embedding_model()
            splitter = SemanticSplitterNodeParser(
                buffer_size=1, breakpoint_percentile_threshold=95, embed_model=embed_model
            )
            nodes = splitter.get_nodes_from_documents(docs)
            return nodes

        if ragConfig['splitter'] == TextSplitterEnum.SentenceSplitter.value:
            logger.info(f"ragConfig in SentenceSplitter, chunk_size: {ragConfig['chunk_size']}, chunk_overlap: {ragConfig['chunk_overlap']}")
            splitter = SentenceSplitter(chunk_size=int(ragConfig['chunk_size']), chunk_overlap=int(ragConfig['chunk_overlap']))  
            nodes = splitter.get_nodes_from_documents(docs)
            logger.info(f"\n\nInside LlamaindexService.split_documents: >> size of chunked_nodes:  {len(nodes)}\n\n")
            return nodes

        if ragConfig['splitter'] == TextSplitterEnum.HierarchicalNodeParser.value:
            splitter = HierarchicalNodeParser.from_defaults(
                chunk_sizes=[2048, 512, 128]
            )
            nodes = splitter.get_nodes_from_documents(docs)
            return nodes
        
    
    def df_to_LINodes(self, df, page_range = None):
        nodes = []
        excl_metadata_keys = ["type", "subtype", "page", "document_hash", "page_hash", "page_width", "page_height", "bbox", "index_in_doc"]
        for index, row in df.iterrows():        
            if page_range is not None and row['extra.page_num'] not in page_range:
                continue

            # display(Markdown(f"\n\n ## DOCUMENT: {row['document']}, PAGE: {row['extra.page_num']}\n\n"))
            image_string = base64.b64encode(row['image.bytes']).decode('utf-8')
            parent_metadata = {
                "type": "page",
                "document": row['document'],
                "page": row['extra.page_num'],
                "document_hash": row['hash'],
                "page_hash": row['page_hash'],
                "page_width": row['image.width'],
                "page_height": row['image.height']
                # "page_image_bytes": image_string
            }
            parent_node = TextNode(text="", id_=row['page_hash'], metadata=parent_metadata, excluded_embed_metadata_keys=excl_metadata_keys,
                    excluded_llm_metadata_keys=excl_metadata_keys,)
            nodes.append(parent_node)
            parentNodeInfo = RelatedNodeInfo(
                node_id=parent_node.node_id, metadata=parent_node.metadata
            )
            labelFound = False
            text = None
            previous_node = None

            metadata = {
                "type": "segment"            
            }
            for segment in row['segments']:
                text = None
                metadata['subtype'] = segment['label']
                metadata['bbox'] = segment['bbox']
                metadata['index_in_doc'] = segment['index_in_doc']            
                
                if segment['label'] == 'page_header':
                    labelFound = True
                    text = f"### {segment['text']}\n\n"                
                if segment['label'] == 'section_header':
                    labelFound = True
                    text = f"#### {segment['text']}\n\n"
                if segment['label'] == 'list_item':
                    labelFound = True
                    text = f"* {segment['text']}\n\n"
                if segment['label'] == 'caption':
                    labelFound = True
                    text = f"** {segment['text']} **\n\n"
                if segment['label'] == 'text':
                    labelFound = True
                    text = f"{segment['text']}\n"
                if segment['label'] == 'table':
                    labelFound = True
                    html = f"{segment['data'][0]['html_seq']}\n\n"
                    # display(HTML(html))
                    html = re.sub(r'(?<=\|)( *[\S ]*? *)(?=\|)', lambda match: match.group(0).strip(), html)
                    table_data = pd.read_html(StringIO(html), header=0)
                    # table_df = table_data[0].dropna(axis=1, how='all').iloc[1:]
                    table_df = table_data[0]
                    table_df = table_df.fillna('')
                    table_df = table_df.replace('\r',' ', regex=True)
                    table_df = table_df.replace(regex=[' \W+'],value='') 
                    # md_format = tabulate(table_df, tablefmt="pipe", headers="keys", showindex=False)
                    md_format = table_df.to_markdown()
                    text = md_format
                    # print(f"\nPAGE: {row['extra.page_num']} \n\nTABLE DATA:\n {text}")
                if segment['label'] == 'picture':
                    labelFound = True                
                    if 'text' in segment:
                        text = f"{segment['text']}\n"
                    else:
                        print(f"<<<<<<< METADATA NOT FOUND FOR IMAGE >>>>>>>>")
                    
                if segment['label'] == 'footnote':
                    labelFound = True
                    text = f"{segment['text']}\n"
                if segment['label'] == 'code':
                    labelFound = True
                    text = f"{segment['text']}\n"
                if segment['label'] == 'page_footer':
                    labelFound = True
                    text = f"{segment['text']}\n"

                if labelFound == False or text is None:
                    logger.debug(f"\n\nLABEL NOT FOUND: {segment['label']}\n\n")
                else:
                    current_node = TextNode(text=text, metadata=metadata, excluded_embed_metadata_keys=excl_metadata_keys,
                        excluded_llm_metadata_keys=excl_metadata_keys)                                
                    current_node.relationships[NodeRelationship.PARENT] = parentNodeInfo
                    previous_node = nodes[-1]
                    if previous_node is not None:                    
                        current_node.relationships[NodeRelationship.PREVIOUS] = RelatedNodeInfo(
                            node_id=previous_node.node_id, metadata=previous_node.metadata
                        )
                        previous_node.relationships[NodeRelationship.NEXT] = RelatedNodeInfo(
                            node_id=current_node.node_id, metadata=current_node.metadata
                        )
                        
                    nodes.append(current_node)
                                            
        return nodes
    
    def dl_docs_to_LINodes(self, dl_docs, page_range = None):
        li_docs = []
        for dl_doc in dl_docs:
            text = dl_doc.export_to_markdown()
            excl_metadata_keys = ["dl_doc_hash"]
            li_doc = LIDocument(
                doc_id=dl_doc.file_info.document_hash,
                text=text,
                excluded_embed_metadata_keys=excl_metadata_keys,
                excluded_llm_metadata_keys=excl_metadata_keys,
            )
            li_doc.metadata = DocumentMetadata(
                dl_doc_hash=dl_doc.file_info.document_hash,
            ).model_dump()
            li_docs.append(li_doc)

        node_parser = MarkdownNodeParser()
        nodes = node_parser.get_nodes_from_documents(li_docs)
        return nodes
