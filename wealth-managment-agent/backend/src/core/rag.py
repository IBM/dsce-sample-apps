import os
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymilvus import MilvusClient
from langchain_huggingface import HuggingFaceEmbeddings
from tqdm import tqdm
import logging

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

class Rag:
    def __init__(self, collection_name="goldman_report", doc_path="docs/2025Outlook.pdf") -> None:
        self.collection_name = collection_name
        self._embeddings = None  # lazy — initialised on first use
        self.milvus_client = self.rag_load(collection_name, doc_path)

    @property
    def embeddings(self):
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings()
        return self._embeddings

    def rag_load(self, collection_name, doc_path) -> MilvusClient:
        # Ensure db directory exists
        db_dir = 'db'
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

        # Create Milvus database path
        milvus_db_path = f"db/milvus_{collection_name}.db"

        # If milvus path exists as a plain file (not directory), remove it
        if os.path.exists(milvus_db_path) and os.path.isfile(milvus_db_path):
            os.remove(milvus_db_path)
            logger.info(f"Removed existing file at {milvus_db_path}")

        milvus_client = MilvusClient(milvus_db_path)

        if milvus_client.has_collection(collection_name):
            logger.info(f"Collection {collection_name} already exists")
            # Load at startup while MPS/PyTorch is not yet active.
            # Loading after LLM/embedding code has initialised MPS causes
            # a segfault on Apple Silicon due to gRPC/MPS memory conflict.
            milvus_client.load_collection(collection_name)
            logger.info(f"Collection {collection_name} loaded into memory")
            return milvus_client

        logger.info(f"Loading the document from {doc_path}...")
        loader = PyMuPDFLoader(doc_path)
        docs = loader.load()
        logger.info(f"Number of pages: {len(docs)}")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=512, chunk_overlap=10, is_separator_regex=False
        )
        splits = text_splitter.split_documents(docs)
        logger.info(f"Number of splits: {len(splits)}")

        logger.info(f"Creating collection {collection_name}...")
        milvus_client.create_collection(
            collection_name=collection_name,
            dimension=768,
            metric_type="IP",
            consistency_level="Strong",
        )

        data = []
        for i, line in enumerate(tqdm(splits, desc="Creating embeddings for the collection, please wait...")):
            data.append({
                "id": i,
                "vector": self.embeddings.embed_query(line.page_content),
                "text": line.page_content,
            })
        milvus_client.insert(collection_name=collection_name, data=data)
        return milvus_client

    def rag_retriever(self, query: str) -> str:
        search_res = self.milvus_client.search(
            collection_name=self.collection_name,
            data=[self.embeddings.embed_query(query)],
            limit=3,
            search_params={"metric_type": "IP", "params": {}},
            output_fields=["text"],
        )

        result = ""
        retrieved_lines_with_distances = [
            (res["entity"]["text"], res["distance"]) for res in search_res[0]
        ]
        for item in retrieved_lines_with_distances:
            result += "[Document]\n"
            result += item[0] + "\n"
            result += "[End]\n\n"
        return result.strip()
