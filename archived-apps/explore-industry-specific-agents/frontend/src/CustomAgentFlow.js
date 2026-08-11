import React, { useState, useEffect } from "react";
import { TextArea, Button, ExpandableTile, TileAboveTheFoldContent, TileBelowTheFoldContent, Loading } from "@carbon/react";
import Markdown from 'markdown-to-jsx';
import './App.css';

function CustomAgentFlow({customFrameworkselected}) {

  const [isLoading, setLoading] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [agentOutput, setagentOutput] = useState('');
  const [execution_time, setexecution_time] = useState('');
  const [agentreasondata, setagentreasondata] = useState('');
  const [llmOutput, setllmOutput] = useState('');
  
  
  const fetchAgentresponse = async () => {
    setLoading(true);

    try {
      const reqOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
        body: JSON.stringify({"input_data": inputPrompt}),
      };

      let response;

      if(customFrameworkselected === "Langchain"){
        response = await fetch(`${process.env.REACT_APP_LANGCHAIN_BACKEND}/langchain/generate`, reqOpts);
      }

      else{ // Framework selected is Bee Agent
        response = await fetch(`${process.env.REACT_APP_BEE_BACKEND}/bee-agent-framework/generate`, reqOpts);
      }

      if (response.ok) {
        const respdata = await response.json();

        setagentOutput(respdata["output"]["output"])
        setagentreasondata(respdata["output"]["intermediate_steps"])
        setllmOutput(respdata["output"]["llm_answer"])

      } else {
        console.error('Response status issue');
      }
    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setLoading(false);
    }
  };

  function submitPrompt(){
    fetchAgentresponse()
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '1200px' }}>
          <div style={{ flex: 2, marginRight: '20px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', padding: '20px' }}>
            <h6 style={{ flex: 2, marginBottom: '10px' }}>Input Prompt</h6>
            <TextArea
              id="prompt"
              onChange={(e) => setInputPrompt(e.target.value)}
              style={{
                marginBottom: '20px',
                borderRadius: '4px',
                borderColor: '#dcdcdc',
                padding: '10px',
                backgroundColor: '#f4f4f4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            />
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
            {agentreasondata && <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '16px', padding: '16px', backgroundColor: '#f4f6f9', border: '1px solid #dcdcdc', maxHeight: '1255px', borderRadius: '4px', overflowY: 'auto' }}>
              {agentreasondata.split('\n').map((line, index) => {
                const keywords = ['THOUGHT', 'ACTION', 'OBSERVATION', 'FINAL ANSWER'];
                const colors = {
                  'THOUGHT': 'purple',
                  'ACTION': 'blue',
                  'OBSERVATION': 'red',
                  'FINAL ANSWER': 'green'
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
            </pre>}
          </div>}
        </div>
      </div>
      <Loading active={isLoading} description="Loading" withOverlay />
    </>
  );
}

export default CustomAgentFlow;
