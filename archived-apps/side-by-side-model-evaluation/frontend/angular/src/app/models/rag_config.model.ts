
export enum LoadersEnum{
	LlamaIndexLoader = "LlamaIndexLoader",
    IBMDoclingLoader = "IBMDoclingLoader"
    // LLMSherpaLoader = "LLMSherpaLoader"
}


export enum TextSplitterEnum{
	TokenTextSplitter = "TokenTextSplitter",
    SentenceSplitter = "SentenceSplitter",
    SemanticSplitter = "SemanticSplitter",
    HierarchicalNodeParser = "HierarchicalNodeParser",
	CustomHierarchicalChunker = "CustomHierarchicalChunker"
    // LLMSHERPA = "LLMSHERPA"
}

export enum TableExtractorEnum{
	DOCLING = "DOCLING",
    GMFT = "GMFT"
}

export enum VectorDBEnum{
	IN_MEMORY = "IN_MEMORY",
	MILVUSDB = "MILVUSDB"
}

export enum EmbeddingModelEnum {
	BAAI_bge_small_en_v15 = "BAAI/bge-small-en-v1.5",
    // WX_slate_125m_english_rtrvr = "ibm/slate-125m-english-rtrvr-v2",
    // WX_slate_30m_english_rtrvr = "ibm/slate-30m-english-rtrvr-v2",
    ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2",
    MXBAI_EMBED_LARGE_V1 = "mixedbread-ai/mxbai-embed-large-v1",
    INSTRUCTOR_LARGE = "hkunlp/instructor-large",
}

export enum ResponseModesEnum {
	COMPACT = "compact",
    REFINE = "refine",
    SIMPLE_SUMMARIZE = "simple_summarize",
    TREE_SUMMARIZE = "tree_summarize",
    ACCUMULATE = "accumulate"
}

export class Audit {
    public user_id: string;
}

export class ChunkingConfig{
	public chunk_size: number = 512;
	public chunk_overlap: number = 100;
	public separator: any = []

	clear(): void {
        this.chunk_size = 512;
        this.chunk_overlap = 100;
        this.separator = [];
    }

	static default(){
		return new ChunkingConfig()
	}

}

export class VectorDBConfig{
	public db_name: VectorDBEnum = VectorDBEnum.MILVUSDB;
	public embedding_model: EmbeddingModelEnum = EmbeddingModelEnum.BAAI_bge_small_en_v15;
	public collection_name: string = "";
	public replace: boolean = true;
	public response_mode: ResponseModesEnum = ResponseModesEnum.TREE_SUMMARIZE

	clear(): void {
        this.db_name = VectorDBEnum.IN_MEMORY;
        this.embedding_model = EmbeddingModelEnum.BAAI_bge_small_en_v15;
		this.collection_name = "";
		this.replace = true;
    }

	static default(){
		return new VectorDBConfig()
	}
}

export class RagConfig {
    public loader: LoadersEnum = LoadersEnum.LlamaIndexLoader;
    public splitter: TextSplitterEnum = TextSplitterEnum.SentenceSplitter;
	public vectordb_config: VectorDBConfig = VectorDBConfig.default();
	public table_extractor: TableExtractorEnum = TableExtractorEnum.DOCLING
    public image_md_config: any;
    public chunk_size: number = 512
    public chunk_overlap: number = 30
	public split_at: string = "HEADER"
    public chunk_separator: string = " "
	public do_ocr: boolean = false
    public do_table_structure: boolean = true
    public do_cell_matching: boolean = true
	public audit: Audit;

	constructor() {
	}

    clear(): void {
        this.loader = LoadersEnum.LlamaIndexLoader;
        this.splitter = TextSplitterEnum.SentenceSplitter;
        this.vectordb_config = VectorDBConfig.default();
		this.table_extractor = TableExtractorEnum.DOCLING;
		this.chunk_size = 512;
		this.chunk_overlap = 100;
		this.split_at = "HEADER";
		this.chunk_separator = " ";
		this.do_ocr = false;
		this.do_table_structure = true;
		this.do_cell_matching = true;
      }
 }
