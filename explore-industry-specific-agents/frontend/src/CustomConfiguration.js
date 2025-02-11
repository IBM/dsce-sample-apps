import React, { useState, useEffect } from "react";
import { CheckboxGroup, Dropdown, Checkbox, TextInput, Tooltip, Button, Loading, ToastNotification } from "@carbon/react";
import { Information } from '@carbon/icons-react';
import './App.css';

function CustomConfiguration({customFrameworkselected, setcustomFrameworkselected}) {
  const [beeConfig, setBeeConfig] = useState({
    tools: [],
    memory: [],
    llm_providers: []
  });
  const [langchainConfig, setLangchainConfig] = useState({
    tools: [],
    memory: [],
    llm_providers: []
  });
  const [configparams, setConfigParams] = useState({
    tools: [],
    memory: [],
    llm_providers: []
  });
  const [selectedLLMProvider, setSelectedLLMProvider] = useState(null);
  const [frameworkSelected, setFrameworkSelected] = useState('');
  const [selectedMemory, setSelectedMemory] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [notifstatus, setnotifstatus] = useState(false);
  const [notifmsg, setnotifmsg] = useState('');
  const [notiftype, setnotiftype] = useState('');
  const [wxprojectid, setwxprojectid] = useState('');

  useEffect(() => {
   getConfigParams();
  }, []);

  const getConfigParams = async() => {
    setLoading(true);
    try {
      const reqOpts = {
        method: 'GET',
        headers: { 'accept': 'application/json', 'X-API-Key': 'test' }
      };

      let response_bee = await fetch(`${process.env.REACT_APP_BEE_BACKEND}/bee-agent-framework/get_config_params`, reqOpts);

      if (response_bee.ok) {
        const respbeedata = await response_bee.json();
        setBeeConfig(respbeedata)
      } else {
        console.error('Response status issue with bee backend to get config params');
      }

    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setLoading(false);
    }
  }


  const handleDropdownChange = (e) => {
    const selectedItem = e.selectedItem ? e.selectedItem.text : '';
    if (selectedItem === 'LangChain') {
      setConfigParams(langchainConfig);
      setcustomFrameworkselected("Langchain");
    } else {
      setConfigParams(beeConfig);
      setcustomFrameworkselected("Bee");
    }
    setFrameworkSelected(selectedItem);
  };

  const handleLLMProviderChange = (e) => {
    const selectedItem = e.selectedItem ? e.selectedItem.text : '';
    const provider = configparams.llm_providers.find(p => p.name === selectedItem);
    setSelectedLLMProvider(provider || null);
  };

  const handleMemoryChange = (value) => {
    setSelectedMemory(value);
  };

  const handleConfigChange = (key, subKey, index, event) => {
    const newConfig = [...selectedLLMProvider.config];
    const value = event.target.value;

    if (subKey) {
      newConfig[index][key][subKey] = value;
    } else {
      newConfig[index][key] = value;
    }

    setSelectedLLMProvider({
      ...selectedLLMProvider,
      config: newConfig
    });
  };

  const sanitizeData = (data) => {
    if (data && typeof data === 'object') {
      if (data.nodeType || (data.$$typeof && data.props)) {
        return undefined;
      }
      if (Array.isArray(data)) {
        return data.map(sanitizeData).filter(x => x !== undefined);
      }
      return Object.fromEntries(
        Object.entries(data)
          .map(([key, value]) => [key, sanitizeData(value)])
          .filter(([key, value]) => value !== undefined)
      );
    }
    return data;
  };

  const handleSaveConfiguration = async () => {
    const rawConfig = {
      "framework": frameworkSelected || 'Bee Agent Framework',
      "tools": configparams.tools
        .filter(tool => document.getElementById(tool.name)?.checked)
        .map(tool => tool.name),
      "memory": selectedMemory || 'Unconstrained Memory',
      "llm_providers": selectedLLMProvider ? {
        "name": selectedLLMProvider.name,
        "config": selectedLLMProvider.config.map(cfg => {
          const configCopy = { ...cfg };
          if (configCopy.parameters) {
            configCopy.parameters = { ...configCopy.parameters };
          }
          return configCopy;
        })
      } : {}
    };

    const sanitizedConfig = sanitizeData(rawConfig);

    setLoading(true);
    try {
      const reqOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
        body: JSON.stringify(sanitizedConfig),
      };


      let response;
      if(customFrameworkselected === "Langchain"){
        response = await fetch(`${process.env.REACT_APP_LANGCHAIN_BACKEND}/langchain/save_config`, reqOpts);
      }

      else{ // Framework selected is Bee Agent
        response = await fetch(`${process.env.REACT_APP_BEE_BACKEND}/bee-agent-framework/save_config`, reqOpts);
      }

      if (response.ok) {
        setnotifstatus(true);
        setnotifmsg("Agent Configuration saved!");
        setnotiftype('success')
      } else {
        console.error('Response status issue');
        setnotifstatus(true);
        setnotifmsg("Configuration could not be saved. Try again");
        setnotiftype('error')
      }
    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setLoading(false);
    }
  };

  const items = [
    { text: 'Bee Agent Framework' }
  ];

  const llmProviderItems = configparams.llm_providers.map(provider => ({
    text: provider.name
  }));

  return (
    <div style={{ padding: '20px' }}>
      <br />

      <h5><strong>Enter your watsonx.ai project ID to open Agent Lab</strong></h5>
      <br/>
      <TextInput id="wx-project-id" value={wxprojectid} onChange={(event) => { setwxprojectid(event.target.value)}} placeholder="watsonx.ai project ID" size="md" type="text"/>

          <Button kind="primary" style={{ marginBottom: '20px', marginTop: '20px' }} onClick={()=>{window.location.href = `https://dataplatform.cloud.ibm.com/wx/agents?context=wx&project_id=${wxprojectid}`;}}>
          Goto Agent Lab on watsonx.ai
          </Button>

      {/* <h5><strong>Configure your Agentic Framework!</strong></h5>
      <br />
      <div style={{ marginBottom: '20px' }}>
        <Dropdown
          id="framework"
          titleText="Select Agentic Framework"
          items={items}
          label="Select an option..."
          itemToString={item => item ? item.text : ''}
          onChange={handleDropdownChange}
        />
      </div> */}

      <Loading active={isLoading} description="Loading" withOverlay />
      {notifstatus &&
                <ToastNotification
                  iconDescription="Close notification"
                  subtitle={<span>{notifmsg}</span>}
                  timeout={6000}
                  onClose={() => setnotifstatus(false)}
                  title="Tool Notification"
                  kind={notiftype}
                />
             } 

      {/* {frameworkSelected && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ flex: 1, marginRight: '10px' }}>
              <h6>Tools</h6>
              <CheckboxGroup legendText="Select Tools">
                {configparams.tools.map((tool) => (
                  <div key={tool.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Checkbox
                      id={tool.name}
                      labelText={
                        <>
                          {tool.name}
                          <Tooltip align="right" label={tool.description}>
                            <Information style={{ marginLeft: '8px', cursor: 'pointer' }} />
                          </Tooltip>
                        </>
                      }
                    />
                  </div>
                ))}
              </CheckboxGroup>
            </div> */}

            {/* <div style={{ flex: 1, marginLeft: '10px' }}>
              <h6>Memory</h6>
              <legend class="cds--label">Select Memory</legend>
              {configparams.memory.map((mem) => (
                <div key={mem.name} className="custom-radio-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="radio"
                    id={mem.name}
                    name="memory"
                    value={mem.name}
                    className="custom-radio-button"
                    checked={selectedMemory === mem.name}
                    onChange={(e) => handleMemoryChange(e.target.value)}
                  />
                  <label htmlFor={mem.name} className="custom-radio-button__label">
                    <span className="custom-radio-button__appearance"></span>
                    <span className="custom-radio-button__label-text">
                      {mem.name}
                      <span className="cds--popover-container cds--tooltip">
                        <div className="cds--tooltip-trigger__wrapper">
                          <svg focusable="false" preserveAspectRatio="xMidYMid meet" fill="currentColor" aria-labelledby="tooltip" width="16" height="16" viewBox="0 0 16 16" role="img">
                            <path d="M8.5 11L8.5 6.5 6.5 6.5 6.5 7.5 7.5 7.5 7.5 11 6 11 6 12 10 12 10 11zM8 3.5c-.4 0-.8.3-.8.8S7.6 5 8 5c.4 0 .8-.3 .8-.8S8.4 3.5 8 3.5z"></path>
                            <path d="M8,15c-3.9,0-7-3.1-7-7s3.1-7,7-7s7,3.1,7,7S11.9,15,8,15z M8,2C4.7,2,2,4.7,2,8s2.7,6,6,6s6-2.7,6-6S11.3,2,8,2z"></path>
                          </svg>
                        </div>
                        <span className="cds--popover-content">{mem.description}</span>
                      </span>
                    </span>
                  </label>
                </div>
              ))}
            </div>

          </div>

          <div style={{ marginBottom: '20px' }}>
            <h6>LLM Providers</h6>
            <Dropdown
              id="llm-provider-dropdown"
              titleText="Select LLM Provider"
              items={llmProviderItems}
              itemToString={item => item ? item.text : ''}
              label="Select an option..."
              onChange={handleLLMProviderChange}
            />

            {selectedLLMProvider && (
              <div style={{ marginTop: '20px' }}>
                <h6>{selectedLLMProvider.name}</h6>
                {selectedLLMProvider.config.map((cfg, index) => (
                  <div key={index} style={{ marginBottom: '1rem' }}>
                    {Object.entries(cfg).map(([key, value]) => (
                      typeof value === 'object' ? (
                        Object.entries(value).map(([subKey, subValue]) => (
                          <TextInput
                            key={`${key}-${subKey}-${index}`}
                            id={`${key}-${subKey}-${index}`}
                            labelText={`${subKey.replace(/_/g, ' ').toUpperCase()}`}
                            value={subValue}
                            onChange={(e) => handleConfigChange(key, subKey, index, e)}
                            style={{ marginBottom: '10px',  marginTop:'5px'  }}
                          />
                        ))
                      ) : (
                        <TextInput
                          key={`${key}-${index}`}
                          id={`${key}-${index}`}
                          labelText={key.replace(/_/g, ' ').toUpperCase()}
                          value={value}
                          onChange={(e) => handleConfigChange(key, null, index, e)}
                          style={{ marginBottom: '10px',  marginTop:'5px'  }}
                        />
                      )
                    ))}
                  </div>
                ))}
                <Button kind="primary" style={{ marginBottom: '20px' }} onClick={handleSaveConfiguration}>
                  Save Configuration
                </Button>
              </div>
            )}
          </div>
        </>
      )}*/}
    </div>
  );
}

export default CustomConfiguration;
