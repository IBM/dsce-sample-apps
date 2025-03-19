import os
from langchain.docstore.document import Document
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymilvus import MilvusClient
from langchain_huggingface import HuggingFaceEmbeddings
from tqdm import tqdm
import logging

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)
class Rag:
    def __init__(self, collection_name="goldman_report", doc_path="docs/2025Outlook.pdf") -> None:
        self.embeddings = HuggingFaceEmbeddings()
        self.collection_name = collection_name
        self.milvus_client = self.rag_load(collection_name, doc_path)

    def rag_load(self, collection_name, doc_path) -> MilvusClient:
        milvus_client = MilvusClient(f"db/milvus_{collection_name}.db")
        if milvus_client.has_collection(collection_name):
            # milvus_client.drop_collection(collection_name)
            logger.info(f"Collection {collection_name} already exists")
            return milvus_client
        logger.info(f"Loading the document from {doc_path}...")
        loader = PyMuPDFLoader(doc_path)
        docs = loader.load()
        logger.info(f"Number of pages: {len(docs)}")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=10, is_separator_regex = False)
        splits = text_splitter.split_documents(docs)
        logger.info(f"Number of splits: {len(splits)}")
        
        logger.info(f"Creating collection {collection_name}...")
        milvus_client.create_collection(
            collection_name=collection_name,
            dimension=768,
            metric_type="IP",  # Inner product distance
            consistency_level="Strong",  # Strong consistency level
        )
        data = []
        for i, line in enumerate(tqdm(splits, desc="Creating embeddings for the collection, please wait...")):
            data.append({"id": i, "vector": self.embeddings.embed_query(line.page_content), "text": line.page_content})
        milvus_client.insert(collection_name=collection_name, data=data)
        return milvus_client

    def rag_retriever(self, query: str) -> str:
        result = ""
        search_res = self.milvus_client.search(
            collection_name=self.collection_name,
            data=[
                self.embeddings.embed_query(query)
            ],
            limit=3,
            search_params={"metric_type": "IP", "params": {}},
            output_fields=["text"],
        )
        retrieved_lines_with_distances = [
            (res["entity"]["text"], res["distance"]) for res in search_res[0]
        ]
        for item in retrieved_lines_with_distances:
            result += "[Document]\n"
            result += item[0] + "\n"
            result += "[End]\n\n"
        return result.strip()