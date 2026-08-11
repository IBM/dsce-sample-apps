import time
from elasticsearch import exceptions as es_exceptions
from typing import List, Tuple

def _create_or_recreate_index(es_client, index_name: str, recreate: bool, body: dict) -> bool:
    if recreate and es_client.indices.exists(index=index_name):
        es_client.indices.delete(index=index_name)
        print(f"Deleted existing index '{index_name}'.")
        time.sleep(0.5)
    if not es_client.indices.exists(index=index_name):
        es_client.indices.create(index=index_name, body=body)
        print(f"Created index '{index_name}'.")
        return True
    return False

def _resumes_index_body() -> dict:
    # ELSER-compatible mapping using rank_features for sparse signals (ml.tokens)
    return {
        "settings": {"number_of_shards": 1, "number_of_replicas": 1},
        "mappings": {
            "properties": {
                "resume_id": {"type": "keyword"},
                "filename": {"type": "keyword"},
                # we store summary in field 'text' today; keep both 'summary' and 'text' for flexibility
                "summary": {"type": "text"},
                "text": {"type": "text"},
                "full_text": {"type": "text"},
            }
        },
    }

def _jobs_index_body() -> dict:
    # Jobs index searchable by title/details; include ml.tokens for sparse retrieval too
    return {
        "settings": {"number_of_shards": 1, "number_of_replicas": 1},
        "mappings": {
            "properties": {
                "title": {"type": "text"},
                "details": {"type": "text"},
                "created_at": {"type": "date"},
            }
        },
    }
