import dotenv from "dotenv";
dotenv.config();

import { WatsonXChatLLM } from "bee-agent-framework/adapters/watsonx/chat";
import { BaseMessage, Role } from "bee-agent-framework/llms/primitives/message";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { PromptTemplate } from "bee-agent-framework";
import { z } from "zod";
import { SlidingCache } from "bee-agent-framework/cache/slidingCache";
import { LLMChatTemplates } from "./llmChatTemplates";
// Tools
import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";
import { ArXivTool } from "bee-agent-framework/tools/arxiv";
import { WebCrawlerTool } from "bee-agent-framework/tools/web/webCrawler";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";
// Memory
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { SummarizeMemory } from "bee-agent-framework/memory/summarizeMemory";
import { SlidingMemory } from "bee-agent-framework/memory/slidingMemory";
// LLM
import { WatsonXLLM } from "bee-agent-framework/adapters/watsonx/llm";
import { OpenAIChatLLM } from "bee-agent-framework/adapters/openai/chat";

class AgentService {
  private config: any;
  private llm: WatsonXLLM | OpenAIChatLLM;
  private chatLLM: WatsonXChatLLM | OpenAIChatLLM;
  private agent: BeeAgent;
  private parameters: any;
  private global_config: any;

  constructor() { }

  public async runAgent(input_data: string): Promise<any> {
    const startTime = new Date();
    console.info("Prompt: " + input_data);

    let intermediateSteps = "";
    const response = await this.agent
      .run({ prompt: input_data })
      .observe((emitter) => {
        emitter.on("update", async ({ data, update, meta }) => {
          if (update.key === "thought") {
            intermediateSteps += `THOUGHT : ` + update.value + "\n\n";
            console.log(`Agent (${update.key}) : `, update.value);
          }
          else if (update.key === "tool_name") {
            intermediateSteps += `ACTION : Invoking tool - ` + update.value + " ";
            console.log(`Agent (${update.key}) : `, update.value);
          }
          else if (update.key === "tool_input") {
            intermediateSteps += `with input - ` + update.value + "\n\n";
            console.log(`Agent (${update.key}) : `, update.value);
          }
          else if (update.key === "tool_output") { 
            intermediateSteps += `OBSERVATION : The agent got the relevant information from the tool invoked.` + "\n\n";
            console.log(`Agent (${update.key}) : `, update.value);
          }
          else if (update.key === "final_answer") { 
            intermediateSteps += `FINAL ANSWER : ` + update.value + "\n\n";
            console.log(`Agent (${update.key}) : `, update.value);
          } else {
            // intermediateSteps += `Agent (${update.key}) : ` + update.value + "\n";
            console.log(`Agent (${update.key}) : `, update.value);
          }
        });
      });
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();
    console.log(`Execution time: ${executionTime/1000} seconds`);
    console.log(`Agent 🤖 : `, response.result.text);
    const responseLLM = await this.runLLM(input_data);
    const llmAnswer = responseLLM["results"][0]["generated_text"];
    const output : any = {
      output: response.result.text,
      intermediate_steps: intermediateSteps,
      execution_time: `${executionTime/1000} sec`,
      llm_answer: llmAnswer
    }

    return Promise.resolve(output);
  }

  private async fetchToken() {
    const FETCH_TOKEN_ENDPOINT = 'https://iam.cloud.ibm.com/identity/token';
    const payload = {
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: process.env.IBM_CLOUD_API_KEY || ''
    };
    
  
    const response = await fetch(FETCH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload),
    });
  
    const tokenJson = await response.json();
    return tokenJson["access_token"];
  };

  public async runLLM(input_data: string): Promise<any> {
    const url = process.env.WX_ENDPOINT + "/ml/v1/text/generation?version=2023-05-29";
    
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Bearer " + await this.fetchToken()
    };
    const body = {
      input: input_data,
      parameters: {
        decoding_method: this.global_config.llm_providers.config[0].parameters.decoding_method,
        max_new_tokens: parseInt(this.global_config.llm_providers.config[0].parameters.max_new_tokens),
        min_new_tokens: parseInt(this.global_config.llm_providers.config[0].parameters.min_new_tokens),
        stop_sequences: [],
        repetition_penalty: 1
      },
      model_id: this.global_config.llm_providers.config[0].model_id,
      project_id: process.env.WX_PROJECT_ID
    };
  
    const response = await fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(body)
    });
  
    if (!response.ok) {
      throw new Error("Non-200 response");
    }
  
    return await response.json();
  }

  public setAgentConfig(configPayload: any): Promise<{ output: string }> {
    try {
      console.log("Setting agent configuration with: ", configPayload);
      this.global_config = configPayload;
      const model_id = configPayload.llm_providers.config[0].model_id;
      if (model_id.includes("granite")) {
        const { template, parameters, messagesToPrompt } = LLMChatTemplates.get("granite3Instruct");
        this.config = {
          messagesToPrompt: messagesToPrompt(template),
        }
        this.parameters = parameters;
      } else if (model_id.includes("llama-3-1")) {
        const { template, parameters, messagesToPrompt } = LLMChatTemplates.get("llama3");
        this.config = {
          messagesToPrompt: messagesToPrompt(template),
        }
        this.parameters = parameters;
      } else if (model_id.includes("llama-3-2")) {
        const { template, parameters, messagesToPrompt } = LLMChatTemplates.get("llama3.1");
        this.config = {
          messagesToPrompt: messagesToPrompt(template),
        }
        this.parameters = parameters;
      } else if (model_id.includes("llama-3-3")) {
        const { template, parameters, messagesToPrompt } = LLMChatTemplates.get("llama3.3");
        this.config = {
          messagesToPrompt: messagesToPrompt(template),
        }
        this.parameters = parameters;
      } else if (model_id.includes("llama-3")) {
        const { template, parameters, messagesToPrompt } = LLMChatTemplates.get("llama3");
        this.config = {
          messagesToPrompt: messagesToPrompt(template),
        }
        this.parameters = parameters;
      } else {
        this.parameters = LLMChatTemplates.get("granite3Instruct").parameters;
        const template = new PromptTemplate({
          schema: z.object({
            messages: z.array(z.record(z.array(z.string()))),
          }),
          template: `{{#messages}}{{#system}}<|begin_of_text|><|start_header_id|>system<|end_header_id|>
  
    {{system}}<|eot_id|>{{/system}}{{#user}}<|start_header_id|>user<|end_header_id|>
  
    {{user}}<|eot_id|>{{/user}}{{#assistant}}<|start_header_id|>assistant<|end_header_id|>
  
    {{assistant}}<|eot_id|>{{/assistant}}{{#ipython}}<|start_header_id|>ipython<|end_header_id|>
  
    {{ipython}}<|eot_id|>{{/ipython}}{{/messages}}<|start_header_id|>assistant<|end_header_id|>
    `,
        });
        this.config = { 
          messagesToPrompt: (messages: BaseMessage[]) => {
            return template.render({
              messages: messages.map((message) => ({
                system: message.role === "system" ? [message.text] : [],
                user: message.role === "user" ? [message.text] : [],
                assistant: message.role === "assistant" ? [message.text] : [],
                ipython: message.role === "ipython" ? [message.text] : [],
              })),
            });
          },
        }
      }

      // Tools
      const tools = configPayload.tools;
      console.log("Tools: ", tools);

      const toolsArray: any[] = [];

      if (tools.includes("WikipediaTool")) {
        toolsArray.push(new WikipediaTool() as any);
      }
      if (tools.includes("WebCrawlerTool")) {
        toolsArray.push(new WebCrawlerTool() as any);
      }
      if (tools.includes("ArXivTool")) {
        toolsArray.push(new ArXivTool() as any);
      }
      if (tools.includes("DuckDuckGoTool")) {
        toolsArray.push(new DuckDuckGoSearchTool() as any);
      }
      if (tools.includes("OpenMeteoTool")) {
        toolsArray.push(new OpenMeteoTool() as any);
      }

      // LLM
      const llmProviders = configPayload.llm_providers;
      console.log("LLM Providers: ", llmProviders);

      if (llmProviders.name === "watsonx.ai") {
        this.llm = new WatsonXLLM({
          modelId: llmProviders.config[0].model_id,
          projectId: process.env.WX_PROJECT_ID,
          apiKey: process.env.IBM_CLOUD_API_KEY,
          parameters: {
            decoding_method: llmProviders.config[0].parameters.decoding_method,
            max_new_tokens: parseInt(llmProviders.config[0].parameters.max_new_tokens), 
            min_new_tokens: parseInt(llmProviders.config[0].parameters.min_new_tokens),
            stop_sequences: [...this.parameters.stop_sequence]
          },
        });

        this.chatLLM = new WatsonXChatLLM({
          llm: this.llm,
          config: this.config,
        });
      } else if (llmProviders.name === "OpenAI") {
        this.chatLLM = new OpenAIChatLLM({
          modelId: llmProviders.config[0].model_id,
          parameters: {
            max_tokens: parseInt(llmProviders.config[0].parameters.max_tokens),
            stop: llmProviders.config[0].parameters.stop,
          },
        });
      }

      // Memory
      const memory = configPayload.memory;
      console.log("Memory: ", memory);

      let memoryArray: any = null;

      if (memory === "Token Memory") {
        memoryArray = new TokenMemory({ llm: this.chatLLM }) as any;
      }
      if (memory === "Unconstrained Memory") {
        memoryArray = new UnconstrainedMemory() as any;
      }
      if (memory === "Summarize Memory") {
        memoryArray = new SummarizeMemory({ llm: this.chatLLM }) as any;
      }
      if (memory === "Sliding Memory") {
        memoryArray = new SlidingMemory({
          size: 3,
          handlers: {
            removalSelector: (messages) =>
              messages.find((msg) => msg.role !== "system")!,
          },
        }) as any;
      }

      console.log("testing llm...");
      try {
        console.log(this.chatLLM.generate([
          BaseMessage.of({
          role: Role.USER,
          text: "Hello",  
          }),
        ]));
      } catch (error) {
        console.error("Error during LLM generation: ", error);
        return Promise.reject({ output: "Failed to Initialize Agent" });
      }

      this.agent = new BeeAgent({
        llm: this.chatLLM,
        memory: memoryArray,
        tools: toolsArray,
      });

      console.log("Agent: ", this.agent);

      const response = "Agent initialized with tools: " + tools + " and memory: " + memory + " and llm: " + llmProviders.name;

      console.log(response);

      return Promise.resolve({ output: response });

    } catch (error) {
      console.error("Error setting agent configuration: ", error);
      return Promise.reject({ output: "Failed to Initilize Agent" });
    }
  }
}

export default AgentService;