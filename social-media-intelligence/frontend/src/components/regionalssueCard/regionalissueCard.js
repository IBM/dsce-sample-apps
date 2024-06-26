import React, { useState, useEffect } from 'react';
import { ClickableTile, RadioButton, RadioButtonGroup, Tile, Slider, Loading, IconButton, Tag} from '@carbon/react';
import { Checkmark, AiLaunch  } from '@carbon/icons-react';
import './issueCard.scss'
import local_jsonData from './data.json';



function DataCards() {
  const [sentiment, setSentiment] = useState('frustration, disappointment, urgency')
  const [copy_element, SetCopy_element] = useState("Experience fast and reliable internet with TelcoX. Say goodbye to slow speeds and unreliable service. Switch now and get a special offer!,Don't let slow internet hold you back. Upgrade to TelcoX and enjoy fast and reliable speeds. Contact us today to learn more!,Tired of dealing with unreliable internet? TelcoX has got you covered. Our internet services are designed to provide you with a seamless and efficient experience. Switch now and see the difference for yourself!")
  useEffect(() => {
    // Fetch and set JSON data when the component mounts
    setData(local_jsonData);

  }, []); 
  let sortedData = local_jsonData
  sortedData.sort((a, b) => b.count_adj - a.count_adj);
  sortedData = sortedData.filter(obj => obj.carrier !== "TelcoA");
  sortedData = sortedData.slice(0, 200);
  const [submitted, setSubmitted] = useState(false);

  // console.log("This is the sorted data")
  // console.log(sortedData)
  const [selectedCard, setSelectedCard] = useState(sortedData[0]);
  const [isSelected, setIsSelected] = useState(false);
  const [activeDiv, setActiveDiv] = useState(1);
  const [sliderValue, setSliderValue] = useState(0);
  const [responseData, setResponseData] = useState(null);
  const [data, setData] = useState(null);
  
  const handleChange = (event) => {
    setSliderValue(event.value);
  };
  
  useEffect(() => {
    setResponseData(null)
    const fetchData = async () => {
      try {
        
        let requestBody;
        if (selectedCard){
            // console.log(selectedCard) 
            requestBody = {
              "city": String(selectedCard.City),
              "province": String(selectedCard.Province),
              "affected_services": String(selectedCard.Affected_Service_llama),
              "concern": String(selectedCard.Concern_llama),
              "tweets": String(selectedCard.tweets),
              "competitor": String(selectedCard.carrier)
            }
            //  requestBody = {"prompt":"Test"}
            // console.log(requestBody)
        }
		// setSentiment(responseData["campaign"]["tweets_analysis"]['customer_sentiments'].join(', '))
        // console.log(responseData["campaign"]["tweets_analysis"]['customer_sentiments'].join(', '))
        const response = await fetch(process.env.REACT_APP_BACKEND_URL+'/regional_summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        console.log(response)


        if (!response.ok) {
           setResponseData(null)
          throw new Error('Network response was not ok');
          
        }
        const jsonData = await response.json();
        setResponseData(jsonData);
         console.log(jsonData)  
         SetCopy_element (
          String(responseData["campaign"]['messaging'])
          )
		  
		setSentiment(responseData["campaign"]["tweets_analysis"]['customer_sentiments'].join(', '))
        console.log(responseData["campaign"]["tweets_analysis"]['customer_sentiments'].join(', '))
          
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [selectedCard]);
  const handleSubmit = () => {
    // Your submission logic goes here
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false); // Reset submitted state after some time
    }, 2000); // Reset after 2 seconds
    console.log("This is copied!")
    navigator.clipboard.writeText(copy_element)
    console.log(copy_element)
  };
  
  const handleCardClick = (cardData) => {
    setSelectedCard(cardData);
    setActiveDiv(cardData.id);
  };

  return (
    <div id="cssportal-grid">
      <div className="cards-container">
      {/* <p>Select an issue to view analysis by <span class="black-text">Watson</span>
      <span style={{color: "#18469c", fontWeight: "700", fontFamily:"IBM Plex Sans"}}>x &trade;</span></p> */}
      <br/>
      <br/>
      <div className='cardDiv' style={{borderRadius: "3px"}}>

        {sortedData.map((cardData) => (
          
          <ClickableTile key={cardData.id} onClick={() => handleCardClick(cardData)} style={{
            background: isSelected ? '#0f62fe' : '#8d8d8d@ 20%',  alignItems: "stretch", alignContent: "space-between", width: "97.5%", padding:'4px 1rem', justifyContent: "space-between", borderRadius: "0px !important"
          }} className={`clickable-div ${activeDiv === cardData.id ? ('Card','active-blue') : ('Card', 'inactive-grey')}`}>
            <h4 style={{fontSize:'16px', fontWeight:'400', marginTop:'0.7rem'}}>{cardData.title}</h4>
            <br></br>
            {/* <br style={{display: "flex", minWidth: "20px"}}></br> */}
            
            <div style={{ display: 'flex', paddingBottom: "8px" , alignContent: "space-between", justifyContent: "space-between"}}>
            <Tag className="some-class" type="blue" title="Clear Filter">
                  Carrier: {cardData.carrier}
                </Tag>
                <span>
            <Tag className="some-class" type="blue" title="Clear Filter" style={{width:'140px'}}>
                  # of Messages: {cardData.count_adj}
                </Tag>
        
        <Tag className="some-class" type="blue" title="Clear Filter" style={{width:'175px'}}>
        Severity Level: {cardData.relative}
                </Tag>
                </span>
      </div>
      {/* <Tag className="some-class" type="blue" title="Clear Filter">
      {cardData.date}
      </Tag> */}
            
          </ClickableTile>
        ))}
        </div>
      </div>

      <div className="result-container">
      {/* <div style={{position: 'relative', top: '0.0rem'}}> 
      <h2 className='Watsonx-Heading'>
      <span class="black-text">watson</span>
      <span style={{color: "#18469c", fontWeight: "700", fontFamily:"IBM Plex Sans"}}>x &trade;</span>
      <span > Insight</span>     
      </h2>
      <br></br>
      <h4>Post Analysis</h4>
      </div> */}
        {selectedCard && responseData &&(
          <div>
            <div className='analysisDiv' style={{ marginTop: '1.5rem',fontSize:'16px' }}>
              <p>{selectedCard.content}</p>
              <div className="sentiment-buttons">

                <div>
                
                  <h4 style={{fontWeight:'700', fontSize:'16px'}}> Message Analysis </h4>
                  <div style={{ paddingLeft: '0.5rem' }}>
                  <h4 style={{ fontWeight: '500', fontSize:'16px' }}>Title: <span style={{ fontWeight: '400', fontSize:'16px' }}>{selectedCard.title}</span></h4>
                  <h4 style={{fontWeight: '500', fontSize: "16px"}}>Issue Summary: <span style={{ fontWeight: '400', fontSize:'16px' }}>{responseData.campaign['issue_summary']}</span></h4>
                  </div>
                  <br></br>
                  <h4 style={{ fontWeight: '700', fontSize:'16px' }}>Entities</h4>
                  <div style={{ paddingLeft: '0.5rem' }}>
                    <h4 style={{fontWeight: '500', fontSize: "16px"}}>Affected Services: <span style={{ fontWeight: '400', fontSize:'16px' }}>{responseData.campaign.affected_service}</span></h4>
                    <h4 style={{fontWeight: '500', fontSize: "16px"}}>Concern Type: <span style={{ fontWeight: '400', fontSize:'16px' }}>{responseData.campaign.concern_type}</span></h4>
                    <h4 style={{fontWeight: '500', fontSize: "16px"}}>Key Themes: <span style={{ fontWeight: '400', fontSize:'16px' }}>{responseData.campaign.tweets_analysis.key_themes[0]}</span></h4>
                    <h4 style={{fontWeight: '500', fontSize: "16px"}}>Customer Sentiments: <span style={{ fontWeight: '400', fontSize:'16px' }}>                    {sentiment}  </span></h4>
				  </div>                    
                  
                  {/* <h5 style={{ fontWeight: '700' }}>Applicable AIOps Alert:</h5>
                  <br></br>
                  <div style={{ paddingLeft: '0.5rem' }}>
                    <p><span style={{ fontWeight: '700' }}>Hub Performace: </span> 20% below average</p>
                    <p><span style={{ fontWeight: '700' }}>Server Status: </span> 22B down, 22A down</p>
                  </div>
                */}
                  <div style={{ display: 'flex', justifyContent: 'end' }}>
                    {/*}  <ClickableTile style={{borderRadius:'1rem', background:'#1a56c4', color:'#f4f4f4', margin:'0.5rem'}}>Ask about this</ClickableTile> */}
                  </div> 


                </div>
              </div>

            </div>
         
                <br></br>
                
                



                <div style={{ width: '100%', display: "flex", justifyContent:"space-between" }}>
                <h4 style={{position: "relative", paddingBottom:'0rem', fontSize:'22px', color:'#545454', fontWeight:'600'}}>Suggested Micro Campaigns</h4> 
                
              {/*  <div style={{display:'flex'}}>
                <Slider style={{position:'relative', bottom:'0.5rem'}}
                hideTextInput
                  id="mySlider"
                  min={0}
                  max={100}
                  step={1}
                  labelText="Creativity"
                  value={sliderValue}
                  onChange={handleChange}
                />
                <div style={{display:'flex', justifyContent:'end', margin:'1rem 1 rem 1rem 1rem'}}>
                  <IconButton label="label" style={{marginRight:'1rem', postition:'relative', top:'0.5rem'}}>
                    <Checkmark />
                  </IconButton>

                </div>
              
                
                
              </div> 
               */}
              </div>


          <div style={{marginTop:'1.25rem', fontSize:'large', maxHeight: "300px", minHeight: "200px"}} className='analysisDiv campaignTile'>
			
  
             {/*} {responseData.messaging.map(textItem=> (
                <Tile style={{marginBottom: "10px"}}>{textItem}</Tile>
             ))} */}
              
               {responseData["campaign"]['messaging'].map(textItem=> (
                        <ClickableTile style={{marginBottom: "10px", fontSize: "16px" }} className='suggestion'>{textItem}</ClickableTile>
                     ))} 

            </div>
            <div>
            <br></br>
            <ClickableTile id="button" style={{ fontWeight: '600' }} className={`submit-button1 ${submitted ? 'submitted1' : ''}`} onClick={handleSubmit}>{submitted ? '' : 'Send Campaign'}</ClickableTile>
          </div>
              
          </div>
        )}
        {(!selectedCard || !responseData) &&(
          <div>
          <Loading withOverlay={false} style={{position:"relative", left:'40%', top:'15rem'}}/>
          <h2 className='Watsonx-Heading' style={{display:'flex', position:"relative", top:'15rem', left:'23%'}}>
          <span className="black-text">watson</span>
          <span style={{ color: "#18469c", fontWeight: "700", fontFamily: "IBM Plex Sans" }}>x &trade;</span>
          <span > is Analysing</span>
        </h2>
        </div>
        ) }
        {(!selectedCard || !data) &&(
          <div>
          <Loading withOverlay={false} style={{position:"relative", left:'45%', top:'15rem'}}/>
          <h3 style={{justifyContent: 'center', width:"100%", display:'flex', position:"relative", top:'15rem'}}>Watsonx is Analysing</h3>
        </div>) }
      </div>
    </div>
  );
}

export default DataCards;

