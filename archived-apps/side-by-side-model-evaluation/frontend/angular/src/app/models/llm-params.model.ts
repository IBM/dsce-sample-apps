export class LLMParams {
    public decoding_method: string = "greedy";
    public min_new_tokens: number = 10;
    public max_new_tokens: number = 200;
	public stop_sequences: any = ["<|endoftext|>"];
	public repetition_penalty: number = 1;
	constructor() {
	}

    clear(): void {
        this.decoding_method = "greedy";
        this.min_new_tokens = 10;
        this.max_new_tokens = 200;
        this.stop_sequences = ["<|endoftext|>"];
		this.repetition_penalty = 1;
      }
 }
