import React, { useState, useEffect } from "react";
import { TextArea, Button, Loading } from "@carbon/react";
import './App.css';
import industryData from "./industryflow_prompts.json";
import Markdown from 'markdown-to-jsx';
import { CheckboxGroup, Dropdown, Checkbox, RadioButtonGroup, RadioButton, TextInput, Tooltip, ToastNotification } from "@carbon/react";
import { Information } from '@carbon/icons-react';
import './App.css';
import industryLangChainData from "./industryflow_langchain_config.json";
import industryBeeData from "./industryflow_bee_config.json";

function IndustryAgentFlow({ userchoice, industryFrameworkselected, setindustryFrameworkselected }) {

  const [isLoading, setLoading] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [agentOutput, setagentOutput] = useState('');
  const [agentreasondata, setagentreasondata] = useState('');
  const [llmOutput, setllmOutput] = useState('');
  const [execution_time, setexecution_time] = useState('');
  const [selectedTools, setSelectedTools] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState('');
  const [selectedLLMProvider, setSelectedLLMProvider] = useState(null);
  const [frameworkSelected, setFrameworkSelected] = useState(false);
  const [providerConfig, setProviderConfig] = useState({});
  const [selectedFramework, setSelectedFramework] = useState('');
  const [defaultConfig, setdefaultConfig] = useState({});


  function getIndustryPrompt(userChoice) {
    const industryjson = industryData.find(
      (item) => item.industry.toLowerCase() === userChoice.toLowerCase()
    );

    if (industryjson) {
      return industryjson.input_prompt;
    } else {
      return `Industry '${userChoice}' not found`;
    }
  }

  function getIndustryModel(userChoice) {
    const industryjson = industryData.find(
      (item) => item.industry.toLowerCase() === userChoice.toLowerCase()
    );

    if (industryjson) {
      return industryjson.model;
    } else {
      return `Model for '${userChoice}' not found`;
    }
  }

  const items = [
    { text: 'Bee Agent Framework' },
    { text: 'LangChain' },
    { text: 'Llamaindex', disabled: true }
  ];

  useEffect(() => {
    setagentOutput('');
    setagentreasondata('');
    setexecution_time('');
    let industry_inputprompt = getIndustryPrompt(userchoice);
    let industry_model = getIndustryModel(userchoice);
    setInputPrompt(industry_inputprompt);
    setSelectedModel(industry_model);
  }, [userchoice]);

  useEffect(() => {
    // Initialize state with default values
    setConfigParams(beeConfig);
    console.log(beeConfig);
    // Initialize selectedTools and selectedMemory
    setSelectedTools(defaultConfig?.tools || []);
    setSelectedMemory(defaultConfig?.memory || []);

    // Check if llm_providers and defaultConfig.llm_providers exist
    const defaultLLMProvider = beeConfig.llm_providers.find(
      p => p.name === defaultConfig?.llm_providers?.name
    );

    setSelectedLLMProvider(defaultLLMProvider || null);

    // Initialize providerConfig with the first config or an empty object
    setProviderConfig(defaultLLMProvider?.config[0] || {});
    setFrameworkSelected(true);
    setSelectedFramework(defaultConfig["framework"] || "Bee Agent Framework");
  }, [defaultConfig]);

  // Display config of a given industry
  const [configparams, setConfigParams] = useState({
    framework: null,
    model: null,
    tools: [],
    memory: [],
    llm_providers: []
  });

  const beeConfig = {
    tools: [
      { name: "WikipediaTool", description: "A tool for retrieving information from Wikipedia." },
      { name: "DuckDuckGoTool", description: "A tool for searching the web using DuckDuckGo." },
      { name: "ArXivTool", description: "A tool for retrieving academic papers from ArXiv." },
      { name: "WebCrawlerTool", description: "A tool for crawling the web and extracting data." },
      { name: "OpenMeteoTool", description: "A tool for retrieving weather data from OpenMeteo." }
    ],
    memory: [
      { name: "Unconstrained Memory", description: "Unlimited size. It is suitable if your context window is huge." },
      { name: "Sliding Window Memory", description: "Keeps last k messages in the memory. The oldest ones are deleted." },
      { name: "Token Memory", description: "Ensures that the number of tokens of all messages is below the given threshold. The oldest are removed." },
      { name: "Summarize Memory", description: "Only a single summarization of the conversation is preserved. Summarization is updated with every new message." }
    ],
    llm_providers: [
      {
        "name": "OpenAI",
        "description": "OpenAI's foundation models",
        "config": [
          {
            "model_id": "gpt-4o",
            "parameters": {
              "max_new_tokens": "10",
              "stop": [
                "post"
              ]
            }
          }
        ]
      },
      {
        name: "watsonx.ai",
        description: "IBM's watsonx.ai foundation models",
        config: [
          {
            model_id: "ibm/granite-3-8b-instruct",
            parameters: {
              max_new_tokens: "500",
              min_new_tokens: "10",
              decoding_method: "greedy"
            }
          }
        ]
      }
    ]
  };

  const langchainConfig = {
    tools: [
      { name: "WikipediaTool", description: "A tool for retrieving information from Wikipedia." },
      { name: "DuckDuckGoTool", description: "A tool for searching the web using DuckDuckGo." },
      { name: "ArXivTool", description: "A tool for retrieving academic papers from ArXiv." },
      { name: "WebCrawlerTool", description: "A tool for crawling the web and extracting data." },
      { name: "OpenMeteoTool", description: "A tool for retrieving weather data from OpenMeteo." }
    ],
    memory: [
      {
        name: "Chat history memory",
        description: "Stores the entire conversation history for context."
      },
      {
        name: "Conversation buffer memory",
        description: "Maintains a buffer of recent messages for limited context."
      }
    ],
    llm_providers: [
      {
        name: "watsonx.ai",
        description: "A framework for developing applications powered by language models, providing tools for agents, chains, and memory management.",
        config: [
          {
            ibm_cloud_api_key: "IBM Cloud API Key",
            model_id: "meta-llama/llama-3-3-70b-instruct",
            parameters: {
              max_new_tokens: "10",
              min_new_tokens: "10",
              decoding_method: "greedy"
            },
            wx_project_id: "watsonx.ai project ID"
          }
        ]
      }
    ]
  };


  useEffect(() => {
    let industry_config = getIndustryConfig(userchoice, industryBeeData);
    setdefaultConfig(industry_config)
  }, [userchoice]);

  function getIndustryConfig(userChoice, industrydatajson) {
    const industryConfig = industrydatajson.find(
      (item) => item.industry.toLowerCase() === userChoice.toLowerCase()
    );

    if (industryConfig) {
      return industryConfig.config;
    } else {
      return `Industry '${userChoice}' not found`;
    }
  }

  ///

  const fetchAgentresponse = async () => {
    setLoading(true);
    try {
      const reqOpts = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' }
      };
      
      let response;

      if (industryFrameworkselected === "Langchain") {
        response = await fetch(`${process.env.REACT_APP_LANGCHAIN_BACKEND}/langchain/generate`, reqOpts);
      }

      // else { // Framework selected is Bee Agent
      //   response = await fetch(`${process.env.REACT_APP_BEE_BACKEND}/bee-agent-framework/generate`, reqOpts);
      // }
      else { // Framework selected is LangGraph
        response = await fetch(`${process.env.REACT_APP_LANGGRAPH_BACKEND}/ai-agent?agent=${userchoice}_agent`, reqOpts);
      }

      if (response.ok) {
        const respdata = await response.json();
        setagentOutput(respdata["llm_response"])
        setagentreasondata(respdata["llm_reasoning"])
        setllmOutput(respdata["standalone_llm_response"])
        setexecution_time(respdata["exec_time"])
      } else {
        console.error('Response status issue');
      }

    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setLoading(false);
    }
  };


  function submitPrompt() {
    fetchAgentresponse()
  }


  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '1200px' }}>
          <div style={{ flex: 2, marginRight: '20px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', padding: '20px' }}>
            <h6 style={{ flex: 2, marginBottom: '10px' }}>Input Prompt</h6>
            <div
              id="prompt"
              style={{
                marginBottom: '20px',
                borderRadius: '4px',
                borderColor: '#dcdcdc',
                padding: '10px',
                backgroundColor: '#f4f4f4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {inputPrompt}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Button kind="primary" style={{ marginBottom: '20px', width: '100%' }} onClick={() => { submitPrompt() }}>
                Submit
              </Button>
              {execution_time && <p><b>Execution Time:</b> {execution_time}</p>}
            </div>
            {agentOutput && <div>
              <h6 style={{ flex: 2, marginBottom: '10px' }}>Agent Output</h6>
              <div style={{ borderRadius: '4px', borderColor: '#dcdcdc', marginBottom: '20px', backgroundColor: '#f4f4f4', padding: '2rem', maxHeight: '500px', overflowY: 'auto' }}>
                <Markdown>{agentOutput}</Markdown>
              </div>
              <br />
              <h6 style={{ flex: 2, marginBottom: '10px' }}>Standalone LLM output for comparison</h6>
              <div style={{ borderRadius: '4px', borderColor: '#dcdcdc', marginBottom: '20px', backgroundColor: '#f4f4f4', padding: '2rem', maxHeight: '500px', overflowY: 'auto' }}>
                <Markdown>{llmOutput}</Markdown>
              </div>
            </div>}
          </div>
          {agentreasondata && <div style={{ flex: 2, backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', padding: '20px' }}>
            <h6>Agent reasoning steps</h6>
            <div style={{ borderRadius: '4px', borderColor: '#dcdcdc', marginBottom: '20px', backgroundColor: '#f4f4f4', padding: '2rem', maxHeight: '1800px', overflowY: 'auto' }}>
            <Markdown>{agentreasondata}</Markdown>
            </div>
            {/* {agentreasondata && <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '16px', padding: '16px', backgroundColor: '#f4f6f9', border: '1px solid #dcdcdc', maxHeight: '1255px', borderRadius: '4px', overflowY: 'auto' }}>
              {agentreasondata.split('\n').map((line, index) => {
                const keywords = ['User', 'Tool Call', 'Arguments', 'AI Agent'];
                const colors = {
                 'User': 'purple',
                  'Tool Call': 'blue',
                  'Arguments': 'red',
                  'AI Agent': 'green'
                };

                let formattedLine = line;
                keywords.forEach(keyword => {
                  if (line.includes(keyword)) {
                    const regex = new RegExp(`(${keyword})`, 'g');
                    formattedLine = formattedLine.replace(regex, `<br/><br/><span style="color: ${colors[keyword]}">$1</span>`);
                  }
                });

                return <span key={index} dangerouslySetInnerHTML={{ __html: formattedLine }}></span>;
              })}
            </pre>} */}
          </div>}
        </div>

        <br />
        <br />

        <div style={{ marginBottom: '20px', borderRadius: '8px', userSelect: 'none', pointerEvents: 'none', opacity: 0.8, boxShadow: '0 4px 8px rgba(0,0,0,0.1)', padding: '20px', width: '80%' }}>


          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ flex: 1, marginRight: '10px', userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
              <h6>Foundation model</h6>
              <p>{selectedModel}</p>
            </div>
            
            <div style={{ flex: 1, marginRight: '10px', userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
              <h6>Decoding Method</h6>
              <p>Greedy</p>
            </div>

            <div style={{ flex: 1, marginRight: '10px', userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
              <h6>MAX NEW TOKENS</h6>
              <p>1000</p>
            </div>

            <div style={{ flex: 1, marginLeft: '10px', userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
              <h6>MIN NEW TOKENS</h6>
              <p>10</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ flex: 1, marginRight: '0' }}>
                <h6 style={{ marginBottom: '10px' }}>Agent Framework</h6>
                <p>{selectedFramework}</p>
              </div>

              <div style={{ flex: 1, userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
                <h6>Tools</h6>
                <CheckboxGroup legendText="Selected Tools" readOnly={true}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {configparams.tools && configparams.tools.map((tool) => (
                      <div key={tool.name} style={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox
                          id={tool.name}
                          labelText={
                            <div style={{ pointerEvents: 'auto' }}>
                              {tool.name}
                              <Tooltip align="right" label={tool.description}>
                                <Information style={{ marginLeft: '8px', cursor: 'pointer' }} />
                              </Tooltip>
                            </div>
                          }
                          checked={selectedTools.includes(tool.name)}
                        />
                      </div>
                    ))}
                  </div>
                </CheckboxGroup>
              </div>

            {/* <div style={{ flex: 1, marginLeft: '10px', userSelect: 'none', pointerEvents: 'none', opacity: 0.9 }}>
              <h6>Memory</h6>
              <RadioButtonGroup name="memory" legendText="Selected Memory Type" orientation="vertical" readOnly={true}>
                {configparams.memory && configparams.memory.map((mem) => (
                  <div key={mem.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <RadioButton
                      id={mem.name}
                      value={mem.name}
                      labelText={
                        <div style={{ pointerEvents: 'auto' }}>
                          {mem.name}
                          <Tooltip align="right" label={mem.description}>
                            <Information style={{ marginLeft: '8px', cursor: 'pointer' }} />
                          </Tooltip>
                        </div>
                      }
                      checked={selectedMemory === mem.name}
                    />
                  </div>
                ))}
              </RadioButtonGroup>
            </div> */}
          </div>

        </div>
      </div>
      <Loading active={isLoading} description="Loading" withOverlay />
    </>
  );
}

export default IndustryAgentFlow;