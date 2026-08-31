"""
Document loader for reports.
Loads PDFs, creates embeddings, and sets up vector store for retrieval.
"""

import os
from typing import List
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_ibm import WatsonxEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from ibm_watsonx_ai import Credentials


class DocumentProcessor:
    """Handles document loading and vector store creation."""

    def __init__(self, watsonx_credentials: dict, document_path: str = None, docs_dir: str = "docs",
                 chunk_size: int = 500, chunk_overlap: int = 50):
        """
        Initialize the document processor.

        Args:
            watsonx_credentials: Dictionary with watsonx.ai credentials and config
            document_path: Path to specific document to load (takes precedence over docs_dir)
            docs_dir: Directory containing PDF documents (used if document_path not provided)
            chunk_size: Size of text chunks for splitting
            chunk_overlap: Overlap between chunks
        """
        self.document_path = document_path
        self.docs_dir = docs_dir
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Initialize watsonx.ai embeddings
        credentials = Credentials(
            url=watsonx_credentials['url'],
            api_key=watsonx_credentials['apikey']
        )

        self.embeddings = WatsonxEmbeddings(
            model_id=watsonx_credentials.get('embedding_model', 'ibm/slate.125m.english.rtrvr'),
            url=watsonx_credentials['url'],
            apikey=watsonx_credentials['apikey'],
            project_id=watsonx_credentials['project_id']
        )
        self.vectorstore = None

    def load_documents(self) -> List[Document]:
        """Load PDF document(s) - either a specific file or all from directory."""
        documents = []

        # If specific document path is provided, use that
        if self.document_path:
            if not os.path.exists(self.document_path):
                raise ValueError(f"Document file '{self.document_path}' not found")

            if not self.document_path.endswith('.pdf'):
                raise ValueError(f"Document file must be a PDF: {self.document_path}")

            print(f"Loading document: {self.document_path}")

            loader = PyPDFLoader(self.document_path)
            docs = loader.load()

            # Add metadata about source file
            source_filename = os.path.basename(self.document_path)
            for doc in docs:
                doc.metadata['source_file'] = source_filename

            documents.extend(docs)
            print(f"Loaded {len(documents)} pages from {source_filename}")

        else:
            # Load all PDFs from directory
            if not os.path.exists(self.docs_dir):
                raise ValueError(f"Documents directory '{self.docs_dir}' not found")

            pdf_files = [f for f in os.listdir(self.docs_dir) if f.endswith('.pdf')]

            if not pdf_files:
                raise ValueError(f"No PDF files found in '{self.docs_dir}'")

            print(f"Loading {len(pdf_files)} PDF documents...")

            for pdf_file in pdf_files:
                file_path = os.path.join(self.docs_dir, pdf_file)
                print(f"  - Loading {pdf_file}...")

                loader = PyPDFLoader(file_path)
                docs = loader.load()

                # Add metadata about source file
                for doc in docs:
                    doc.metadata['source_file'] = pdf_file

                documents.extend(docs)

            print(f"Loaded {len(documents)} pages total")

        return documents

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks."""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

        chunks = text_splitter.split_documents(documents)
        print(f"Split into {len(chunks)} chunks")
        return chunks

    def create_vectorstore(self, chunks: List[Document]) -> FAISS:
        """Create FAISS vector store from document chunks."""
        print("Creating vector store with embeddings...")
        self.vectorstore = FAISS.from_documents(chunks, self.embeddings)
        print("Vector store created successfully")
        return self.vectorstore

    def setup(self) -> FAISS:
        """Complete setup: load, split, and create vector store."""
        documents = self.load_documents()
        chunks = self.split_documents(documents)
        vectorstore = self.create_vectorstore(chunks)
        return vectorstore

    def get_retriever(self, k: int = 4):
        """Get a retriever from the vector store."""
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Call setup() first.")
        return self.vectorstore.as_retriever(search_kwargs={"k": k})
