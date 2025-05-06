
from pydantic import BaseModel
from enum import Enum

from models.common import Audit

class LoadSelectionEnum(Enum):
    load_all = "load_all"
    load_selective = "load_selective"
class LoadersEnum(str, Enum):
    LlamaIndexLoader = "LlamaIndexLoader"
    IBMDoclingLoader = "IBMDoclingLoader"
    LLMSherpaLoader = "LLMSherpaLoader"

class TextSplitterEnum(Enum):
    TokenTextSplitter = "TokenTextSplitter"
    SentenceSplitter = "SentenceSplitter"
    SemanticSplitter = "SemanticSplitter"
    HierarchicalNodeParser = "HierarchicalNodeParser"
    CustomHierarchicalChunker = "CustomHierarchicalChunker"
    LLMSHERPA = "LLMSHERPA"

class TableExtractorEnum(str, Enum):
    DOCLING = "DOCLING"
    GMFT = "GMFT"

class VectorDBEnum(Enum):
	IN_MEMORY = "IN_MEMORY"
	MILVUSDB = "MILVUSDB"

class EmbeddingModelEnum(Enum):
    BAAI_bge_small_en_v15 = "BAAI/bge-small-en-v1.5"
    WX_slate_125m_english_rtrvr = "ibm/slate-125m-english-rtrvr-v2"
    WX_slate_30m_english_rtrvr = "ibm/slate-30m-english-rtrvr-v2"
    ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2"
    MXBAI_EMBED_LARGE_V1 = "mixedbread-ai/mxbai-embed-large-v1"
    INSTRUCTOR_LARGE = "hkunlp/instructor-large"

# response_modes = ["compact", "refine", "simple_summarize", "tree_summarize", "accumulate"]
class ResponseModesEnum(Enum):
    COMPACT = "compact"
    REFINE = "refine"
    SIMPLE_SUMMARIZE = "simple_summarize"
    TREE_SUMMARIZE = "tree_summarize"
    ACCUMULATE = "accumulate"     
class LoadersQueryParam(BaseModel):
    loader: LoadersEnum

class TypeQueryParam(BaseModel):
    type: LoadSelectionEnum

class SavedFileOutput(BaseModel):
    saved_files: list

class DocumentLoadedOutput(BaseModel):
    output: str = "n documents loaded"

class VectorDbConfig(BaseModel):
    db_name: VectorDBEnum = VectorDBEnum.IN_MEMORY
    embedding_model: EmbeddingModelEnum = EmbeddingModelEnum.BAAI_bge_small_en_v15 
    collection_name: str = "IBM_Annual_Report_2022"
    replace: bool = True
    response_mode: ResponseModesEnum = ResponseModesEnum.TREE_SUMMARIZE

class RagConfig(BaseModel):
    loader: LoadersEnum = LoadersEnum.LlamaIndexLoader
    splitter: TextSplitterEnum = TextSplitterEnum.SentenceSplitter
    table_extractor: TableExtractorEnum = TableExtractorEnum.DOCLING
    image_md_config: dict = None 
    chunk_size: int = 512
    chunk_overlap: int = 30
    chunk_separator: str = " "
    split_at: str = "HEADER"
    do_ocr: bool = False
    do_table_structure: bool = True
    do_cell_matching: bool = True
    vectordb_config: VectorDbConfig = VectorDbConfig()
    audit: Audit | None = None

class SourceNode(BaseModel):
    filename: str = None
    prefix: str = None
    page_no: int = None
    text: str = None
    score: float = None
    doc_items: list = None
