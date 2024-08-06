from pydantic import BaseModel, Field
from typing import Optional

class ingestRequest(BaseModel):
    bucket_name: str = Field(title="COS Bucket Name", description="Name of your cloud object storage bucket.")
    es_index_name: str = Field(title="ElasticSearch Index Name", description="Name of the elasticsearch index you want to create.")
    es_pipeline_name: str = Field(title="ElasticSearch Pipeline Name", description="Name of the elasticsearch pipeline you want to create.")
    chunk_size: Optional[str] = Field(default="512")
    chunk_overlap: Optional[str] = Field(default="256")
    es_model_name: Optional[str] = Field(default=".elser_model_2")
    es_model_text_field: Optional[str] = Field(default="text_field") 
    es_index_text_field: Optional[str] = Field(default="body_content_field") 
    # TODO: Implement metadata
    # metadata_fields: Optional[List[str]] = None