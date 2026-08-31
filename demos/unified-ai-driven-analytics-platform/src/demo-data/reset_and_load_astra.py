#!/usr/bin/env python3
"""
Reset Astra DB by removing all collections and loading fresh PDF data.
"""

import os
from pathlib import Path
from PyPDF2 import PdfReader
from sentence_transformers import SentenceTransformer
from astrapy import DataAPIClient
from dotenv import load_dotenv

def extract_text_from_pdf(pdf_path):
    """Extract text content from a PDF file."""
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text.strip()

def parse_pdf_filename(filename):
    """Parse PDF filename to extract metadata."""
    # Format: {id}_{source}_{title}.pdf
    # Example: rb-1_runbook_PLATINUM_delay_handling.pdf
    parts = filename.replace('.pdf', '').split('_', 2)
    if len(parts) >= 3:
        return {
            'id': parts[0],
            'source': parts[1],
            'title': parts[2].replace('_', ' ')
        }
    return None

def reset_and_load_astra(pdf_dir):
    """Remove all collections and load fresh PDF data into Astra DB."""
    
    # Load environment variables
    load_dotenv()
    
    # Get Astra DB credentials
    astra_token = os.getenv("ASTRA_TOKEN")
    astra_api_endpoint = os.getenv("ASTRA_API_ENDPOINT")
    keyspace = os.getenv("ASTRA_RUNBOOKS_KEYSPACE", "default_keyspace")
    
    if not astra_token or not astra_api_endpoint:
        raise ValueError("Missing ASTRA_TOKEN or ASTRA_API_ENDPOINT in .env")
    
    print(f"🔗 Connecting to Astra DB...")
    print(f"   Endpoint: {astra_api_endpoint}")
    print(f"   Keyspace: {keyspace}")
    
    # Initialize Astra DB client
    client = DataAPIClient(astra_token)
    database = client.get_database_by_api_endpoint(
        api_endpoint=astra_api_endpoint,
        keyspace=keyspace
    )
    
    # List and delete all existing collections
    print(f"\n🗑️  Removing existing collections...")
    try:
        collection_names = database.list_collection_names()
        print(f"   Found {len(collection_names)} collections: {collection_names}")
        
        for coll_name in collection_names:
            print(f"   Deleting collection: {coll_name}")
            database.drop_collection(coll_name)
            print(f"   ✅ Deleted: {coll_name}")
    except Exception as e:
        print(f"   ⚠️  Error listing/deleting collections: {e}")
    
    # Create new collection
    collection_name = "runbooks"
    print(f"\n📝 Creating new collection: {collection_name}")
    try:
        collection = database.create_collection(
            name=collection_name,
            definition={
                "vector": {
                    "dimension": 384,  # all-MiniLM-L6-v2 embedding size
                    "metric": "cosine"
                }
            }
        )
        print(f"✅ Collection created successfully")
    except Exception as create_error:
        print(f"❌ Error creating collection: {create_error}")
        raise
    
    # Initialize embedding model
    print("🤖 Loading embedding model...")
    model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    
    # Process all PDFs
    pdf_files = list(Path(pdf_dir).glob("*.pdf"))
    print(f"\n📄 Found {len(pdf_files)} PDF files to process")
    
    documents = []
    for pdf_file in pdf_files:
        print(f"\n   Processing: {pdf_file.name}")
        
        # Extract metadata from filename
        metadata = parse_pdf_filename(pdf_file.name)
        if not metadata:
            print(f"   ⚠️  Skipping {pdf_file.name} - invalid filename format")
            continue
        
        # Extract text from PDF
        text = extract_text_from_pdf(pdf_file)
        
        # Extract just the content (skip header/footer)
        # Content is between "Content:" and footer
        if "Content:" in text:
            content_start = text.index("Content:") + len("Content:")
            content_end = text.rfind("watsonx.data Demo")
            if content_end > content_start:
                text = text[content_start:content_end].strip()
        
        print(f"   📝 Extracted {len(text)} characters")
        print(f"   🏷️  ID: {metadata['id']}, Source: {metadata['source']}")
        
        # Generate embedding
        embedding = model.encode(text).tolist()
        
        # Prepare document
        doc = {
            "_id": metadata['id'],
            "text": text,
            "source": metadata['source'],
            "title": metadata['title'],
            "$vector": embedding
        }
        documents.append(doc)
    
    # Insert documents into Astra DB
    if documents:
        print(f"\n💾 Inserting {len(documents)} documents into Astra DB...")
        
        # Insert new documents
        result = collection.insert_many(documents)
        print(f"✅ Successfully inserted {len(result.inserted_ids)} documents")
        
        # Verify
        count = collection.count_documents({}, upper_bound=1000)
        print(f"📊 Total documents in collection: {count}")
        
        # Test vector search
        print(f"\n🔍 Testing vector search...")
        test_query = "PLATINUM customer delay handling"
        test_embedding = model.encode(test_query).tolist()
        
        results = collection.find(
            sort={"$vector": test_embedding},
            limit=3,
            projection={"_id": 1, "title": 1, "source": 1}
        )
        
        print(f"   Query: '{test_query}'")
        print(f"   Top 3 results:")
        for i, result in enumerate(results, 1):
            print(f"   {i}. [{result['_id']}] {result['title']} ({result['source']})")
    else:
        print("⚠️  No documents to insert")
    
    print(f"\n✅ Reset and load complete!")

def main():
    """Main function."""
    script_dir = Path(__file__).parent
    pdf_dir = script_dir.parent / "runbooks" / "pdfs"
    
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {pdf_dir}")
        return
    
    reset_and_load_astra(pdf_dir)

if __name__ == "__main__":
    main()

# Made with Bob
