import { LLMParams } from "./llm-params.model";
import { VectorDBConfig } from "./rag_config.model";

export class LLMPayload {
    public input: string;
    public parameters: LLMParams;
    public modelid: string;
	public project_id: string;
	public enable_rag: boolean;
	public asynchronous: boolean;
	public vectordb_config: VectorDBConfig;
	constructor() {
	}

    clear(): void {
		let params = new LLMParams();
		params.clear();
		let vectordb_config = new VectorDBConfig();
		vectordb_config.clear()
        this.input = undefined;
        this.parameters = params;
        this.modelid = undefined;
        this.project_id = undefined;
		this.enable_rag = false;
		this.asynchronous = true;
		this.vectordb_config = vectordb_config;
      }
 }
