import React, { useState, useCallback, useEffect, useRef } from "react";
import { Header, HeaderName, Theme, ClickableTile, ContentSwitcher, Loading, Switch, Accordion, AccordionItem, Modal } from "@carbon/react";
import { Industry, UserMultiple, Microscope, Finance, StrategyPlay, Departure, FloodWarning } from '@carbon/icons-react';
import './App.css';
import CustomConfiguration from "./CustomConfiguration";
import CustomAgentFlow from "./CustomAgentFlow";
import IndustryAgentFlow from "./IndustryAgentFlow";
// import industryLangChainData from "./industryflow_langchain_config.json";
import industryBeeData from "./industryflow_bee_config.json";

function App() {
  const [selectedCustomconfigurecomp, setselectedCustomconfigurecomp] = useState(true);
  const [selectedCustomagentcomp, setselectedCustomagentcomp] = useState(false);
  const [selectedIndustryconfigurecomp, setselectedIndustryconfigurecomp] = useState(true);
  const [selectedIndustryagentcomp, setselectedIndustryagentcomp] = useState(false);
  const [showIndustryTiles, setShowIndustryTiles] = useState(false);
  const [customFlow, setcustomFlow] = useState(false);
  const [industryFlow, setindustryFlow] = useState(false);
  const [selectedindustry, setselectedindustry] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [customFrameworkselected, setcustomFrameworkselected] = useState('');
  const [industryFrameworkselected, setindustryFrameworkselected] = useState('');

  const customFlowRef = useRef(null);
  const tileContainerRef = useRef(null);
  const industryAgentFlowRef = useRef(null);

  const scrollToCustomFlow = () => {
    customFlowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToTileContainer = () => {
    tileContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToIndustryAgentFlow = () => {
    industryAgentFlowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  useEffect(() => {
    if (selectedindustry) {
      let industry_config = getIndustryConfig(selectedindustry, industryBeeData); // bee is default for all industry usecase
      // `industryLangChainData` can be used here based on industry config
      handleSaveConfiguration(industry_config);
    }
  }, [selectedindustry]);

  const handleSaveConfiguration = async (industryconfigdata) => {
    const savedConfig = industryconfigdata;

    // Use for dynamic configuration from user
    // setLoading(true);

    // try {
    //   const reqOpts = {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
    //     body: JSON.stringify(savedConfig),
    //   };

    //   let response;
    //   if (industryFrameworkselected === "Langchain") {
    //     response = await fetch(`${process.env.REACT_APP_LANGCHAIN_BACKEND}/langchain/save_config`, reqOpts);
    //   } else { // Framework selected is Bee Agent
    //     response = await fetch(`${process.env.REACT_APP_BEE_BACKEND}/bee-agent-framework/save_config`, reqOpts);
    //   }

    //   if (response.ok) {
    //     console.log("Configuration saved")
    //   } else {
    //     console.error('Response status issue');
    //   }
    // } catch (error) {
    //   console.error('Error fetching response:', error);
    // } finally {
    //   setLoading(false);
    // }
  };

  const handleCustomSwitchChange = useCallback((event) => {
    let { index } = event;
    if (index === 0) {
      setselectedCustomconfigurecomp(true);
      setselectedCustomagentcomp(false);
    } else if (index === 1) {
      setselectedCustomconfigurecomp(false);
      setselectedCustomagentcomp(true);
    }
  }, []);

  const handleIndustrySwitchChange = useCallback((event) => {
    let { index } = event;
    if (index === 0) {
      setselectedIndustryconfigurecomp(true);
      setselectedIndustryagentcomp(false);
    } else if (index === 1) {
      setselectedIndustryagentcomp(true);
      setselectedIndustryconfigurecomp(false);
    }
  }, []);

  const handleTileClick = useCallback((industry) => {
    setselectedindustry(industry);
    setindustryFlow(true);
    scrollToIndustryAgentFlow();
  }, []);

  useEffect(() => {
    if (industryFlow) {
      handleIndustrySwitchChange({ index: 1 });
      setTimeout(() => {
        scrollToIndustryAgentFlow();
      }, 100);
    }
  }, [industryFlow]);
  
  const industryTiles = [
    {
      icon: <Departure size={32} />,
      description: "Personalized Travel Planning Assistant",
      industry: "travel",
      detail: "An agent that helps users plan trips by gathering information about destinations, predicting weather conditions, and recommending activities based on real-time data."
    },
    {
      icon: <Microscope size={32} />,
      description: "Research Assistant for Academia and Industry",
      industry: "research",
      detail: "An AI-driven research assistant that can autonomously gather and synthesize information from multiple sources, including Wikipedia, arXiv and web, to generate comprehensive literature reviews or research summaries."
    },
    {
      icon: <Finance size={32} />,
      description: "Financial Market Analysis and Forecasting",
      industry: "financial",
      detail: "Create an agent that autonomously tracks financial news, analyzes historical data, and forecasts future trends. The agent could also compare weather conditions with market trends for agriculture stocks or commodities."
    }
  ];

  useEffect(() => {
    if (customFlow) {
      scrollToCustomFlow();
    }
  }, [customFlow]);

  useEffect(() => {
    if (showIndustryTiles) {
      scrollToTileContainer();
    }
  }, [showIndustryTiles]);

  return (
    <>
      <Theme theme='g90'>
        <Header aria-label="">
          <HeaderName prefix="Explore Industry-specific agents">
            <div style={{ whiteSpace: "nowrap", padding: "16px" }}></div>
          </HeaderName>
        </Header>
      </Theme>

      <div>
        
        <div className="App">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
            
              <Modal
                open={showModal}
                modalHeading="What is an AI Agent?"
                passiveModal
                onRequestClose={() => setShowModal(false)}
              >
                <p style={{
                  fontSize: '16px',
                  fontFamily: 'IBM Plex Sans',
                  padding: '20px'
                }}>
                  <strong>Large Language Models (LLMs)</strong> are becoming highly skilled at reasoning and can now generate coherent plans of action based on complex inputs. By leveraging their ability to process and synthesize information, LLMs can not only develop detailed strategies but also access a set of tools to execute these plans effectively.
                  <br />
                  <br />
                  An <strong>LLM Agent</strong> is essentially a system that harnesses the reasoning capabilities of an LLM to identify the optimal path for accurately answering user queries, making it a powerful tool for solving intricate problems.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={`${process.env.PUBLIC_URL + "/llm-flow.png"}`} alt="LLM Workflow" style={{ width: '60%', height: 'auto', margin: '20px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={`${process.env.PUBLIC_URL + "/agent-flow.png"}`} alt="Agent Workflow" style={{ width: '60%', height: 'auto', margin: '20px' }} />
                </div>
              </Modal>
            
            <br />
            
            <br />
            <div style={{  display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <ClickableTile
                style={{
                  width: '250px',
                  height: '250px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  backgroundColor: '#f4f4f4',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                }}
                onClick={() => { setcustomFlow(true); setindustryFlow(false); setShowIndustryTiles(false); }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <UserMultiple size={32} />
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>Try Custom Usecases</div>
              </ClickableTile>
              <ClickableTile
                style={{
                  width: '250px',
                  height: '250px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  backgroundColor: '#f4f4f4',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                }}
                onClick={() => { setShowIndustryTiles(!showIndustryTiles); setcustomFlow(false); }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Industry size={32} />
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>Explore Industry Usecases</div>
              </ClickableTile>
            </div>

            {showIndustryTiles && (
              <div ref={tileContainerRef} className="tile-container" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px', padding: '20px', justifyContent: 'center' }}>
                {industryTiles.map((tile, index) => (
                  <div key={index} className="tile" onClick={() => { handleTileClick(tile.industry) }}>
                    <div className="tile-inner">
                      <div className="tile-front">
                        <div className="icon-container">
                          {tile.icon}
                        </div>
                        <div className="description">
                          {tile.description}
                        </div>
                      </div>
                      <div className="tile-back">
                        <div className="detail">
                          {tile.detail}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Loading active={isLoading} description="Loading" withOverlay />
          
          {customFlow && (
            <>
        {selectedCustomconfigurecomp && <CustomConfiguration customFrameworkselected={customFrameworkselected} setcustomFrameworkselected={setcustomFrameworkselected} />}

            {/* If you intend to let users customize agents within your app*/}
              {/* <ContentSwitcher onChange={handleCustomSwitchChange}>
                <Switch name="configure-agent" text="Configure Agent" />
                <Switch name="agent-workflow" text="Agent Workflow" />
              </ContentSwitcher>

              <div ref={customFlowRef} style={{ padding: '20px' }}>
                {selectedCustomconfigurecomp && <CustomConfiguration customFrameworkselected={customFrameworkselected} setcustomFrameworkselected={setcustomFrameworkselected} />}
                {selectedCustomagentcomp && <CustomAgentFlow customFrameworkselected={customFrameworkselected} />}
              </div> */}
            </>
          )}

          {industryFlow && (
            <>
              <div ref={industryAgentFlowRef} style={{ padding: '20px' }}>
                {selectedIndustryagentcomp && <IndustryAgentFlow userchoice={selectedindustry} industryFrameworkselected={industryFrameworkselected} setindustryFrameworkselected={setindustryFrameworkselected} />}
              </div>
            </>
          )}
        </div>
      </div>

      <footer><div class="footer">This app is built using the watsonx.ai SDK and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. © Copyright IBM Corporation</div></footer>
    </>
  );
}

export default App;