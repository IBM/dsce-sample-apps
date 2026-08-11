import os
from pymongo import MongoClient
from langchain.document_loaders.json_loader import JSONLoader
from sentence_transformers import SentenceTransformer
import json

# -----------------------------
# Step 1: Load Financial Chatbot Dataset
# -----------------------------
# Define dataset file path
dataset_file = './financial_dataset_chatbot.json'

if not os.path.isfile(dataset_file):
    raise FileNotFoundError(f"Dataset file not found at {dataset_file}. Please ensure the dataset exists.")
print(f"Dataset found at {dataset_file}")

# -----------------------------
# Step 2: Load Documents
# -----------------------------
# Load the dataset using LangChain's JSONLoader
print("Loading documents from dataset...")
loader = JSONLoader(file_path=dataset_file, jq_schema=".", text_content=False, json_lines=False)
docs = loader.load()
print(f"Loaded {len(docs)} documents successfully.")

# -----------------------------
# Step 3: Initialize Sentence Transformer Embedding Model
# -----------------------------
# Define embedding model details
model_path = "ibm-granite/granite-embedding-125m-english"

# Load the Sentence Transformer model
print("Initializing Sentence Transformer Embedding Model...")
model = SentenceTransformer(model_path)
print("Embedding model initialized successfully.")

# -----------------------------
# Step 4: Initialize MongoDB Atlas Vector Store
# -----------------------------
# Define MongoDB connection details
MONGO_CONN = os.getenv("MONGO_CONNECTION_URL")

# Establish a MongoDB connection
print("Connecting to MongoDB Atlas...")
client = MongoClient(
    MONGO_CONN,
    tls=True,
    tlsAllowInvalidCertificates=True
)

# Define MongoDB collections for vector stores
faq_collection = client["banking_quickstart"]["faqs"]
customer_collection = client["banking_quickstart"]["customers_details"]
transaction_collection = client["banking_quickstart"]["transactions_details"]
spending_insight_collection = client["banking_quickstart"]["spending_insight_details"]

# -----------------------------
# Step 5: Load Documents into Vector Store
# -----------------------------
# Define a helper function to process and store documents
def add_documents_to_vector_store(collection, data, key_field):
    for item in data:
        try:
            content = item[key_field]  # Extract the key field for embeddings
            metadata = {k: v for k, v in item.items() if k != key_field}
            embedding = model.encode(content).tolist()  # Generate embeddings using SentenceTransformer
            # Store the document and its embedding in MongoDB
            collection.insert_one({
                "customer_id": content,
                "embedding": embedding,
                "metadata": metadata
            })
        except Exception as e:
            print(f"Error processing item: {item} - Error: {e}")

# Load each section of the dataset into its respective MongoDB collection
with open(dataset_file, "r") as file:
    dataset = json.load(file)

print("Loading FAQs into vector store...")
add_documents_to_vector_store(faq_collection, dataset["faqs"], "question")

print("Loading Customers into vector store...")
add_documents_to_vector_store(customer_collection, dataset["customers"], "customer_id")

print("Loading Transactions into vector store...")
add_documents_to_vector_store(transaction_collection, dataset["transactions"], "customer_id")

print("Loading Spending Insights into vector store...")
add_documents_to_vector_store(spending_insight_collection, dataset["spending_insights"], "customer_id")

print("All documents successfully added to MongoDB Atlas with embeddings.")