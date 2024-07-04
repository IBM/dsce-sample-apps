import React, { useEffect, useState } from 'react';
import { ClickableTile, RadioButton, RadioButtonGroup, Tile, Slider, Tag, IconButton, Button, Loading } from '@carbon/react';
import { Checkmark, AiLaunch } from '@carbon/icons-react';
import './issueTrendsCard.scss';
import jsonData from './data.json';
import logo from './Screenshot 2024-02-15 at 12.02.07 PM.png';



function TrendsDataCards() {
  const [submitted, setSubmitted] = useState(false);
  const [data,setData] = useState(null)

  const [selectedCard, setSelectedCard] = useState(null);
  const [isSelected, setIsSelected] = useState(false);
  const [responseData, setResponseData] = useState(null);

  const [activeDiv, setActiveDiv] = useState(1);
  // const [sliderValue, setSliderValue] = useState(0);

  // const handleChange = (event) => {
  //   setSliderValue(event.value);
  // };
  const handleCardClick = (cardData) => {
    setSelectedCard(cardData);
    
    setActiveDiv(cardData.id);

  };
  const [sentiment, setSentiment] = useState('frustrated, dissatisfied, angry')

  const [copy_element, SetCopy_element] = useState("Location: Brampton Northwest, Ontario\nDate: Febrary 7th, 2024\nShort Description: Many customers in Surrey Upper West are experiencing slow internet speeds and unreliable service, with some reporting poor customer service. Competitor TelcoA is mentioned in some tweets, highlighting their faster speeds and better service.\nSevOne Data: Over the past 6 hours in Brampton Northwest, Ontario, call and video quality jitter scores have been above desired threshold (>30ms) 29% of the time.\n- Average Call Performance Jitter Score: 32ms\- Average Video Performance Jitter Score: 29msSoical Media Volume: 32 Estimated Urgency Level: High")

  useEffect(()=>{
    let newData = jsonData;
    newData.sort((a, b) => b.count_adj - a.count_adj);
    // newData = newData.filter(obj => obj.carrier === "TelcoC");
    newData = newData.slice(0, 200);
    
    setData(newData);
    setSelectedCard(newData[0])
  },[]);
  
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
              "tweets": selectedCard.tweets,
              "competitor": String(selectedCard.carrier)
            }
            //  requestBody = {"prompt":"Test"}
            // console.log(requestBody)
        }
         const response = await fetch(process.env.REACT_APP_BACKEND_URL+'/regional_summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        //console.log(response)


        if (!response.ok) {
           setResponseData(null)
          throw new Error('Network response was not ok');
          
        }
        const jsonData = await response.json();
        setResponseData(jsonData);
        console.log("This is jsonData")
         console.log(jsonData)  
         SetCopy_element ( "Location: " +  String(selectedCard.City)+', ' +String(selectedCard.Province) + "\nDate: Febrary 7th, 2024\nShort Description: "+ String(responseData.campaign.issue_summary) + "\nSevOne Data: "+ String(selectedCard.secone_data)+ "Soical Media Volume: " + String(selectedCard.count_adj) + "\nEstimated Urgency Level: "+ String(selectedCard.relative))
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

  return (
    
    <div id="cssportal-grid">
      {data && <>
      <div className="cards-container">
        {/* <p>Select an issue to view analysis by <span class="black-text">Watson</span>
      <span style={{color: "#18469c", fontWeight: "700", fontFamily:"IBM Plex Sans"}}>x &trade;</span></p> */}
        <br></br>
        <br></br>
        <div className='cardDiv'>

    {data.map((cardData) => (
      <>
           
            <ClickableTile key={cardData.id} className={`clickable-div ${activeDiv === cardData.id ? ('Card', 'active-blue') : ('Card', 'inactive-grey')}`} onClick={() => handleCardClick(cardData)} style={{
              background: isSelected ? '#0f62fe' : '#8d8d8d@ 20%', alignItems: 'center', alignContent: "space-between", width: "98%", justifyContent: "space-between", padding: "1rem", margin: '0.5rem', marginBottom: '0.5rem', fontSize: 'medium'
            }}>

              <div className='Content' style={{ fontWeight: "400", fontSize:'16px', display:'flex', justifyContent:'space-between' }}>{cardData.regional_title}</div>
              <br></br>
              <div style={{ display: 'flex', justifyContent: "flex-end", alignContent: "flex-end" , alignItems: "flex-end"}}>
                <Tag className="some-class" type="blue" title="Clear Filter" style={{width:'140px'}}>
                  # of Messages: {cardData.count_adj}
                </Tag>
                <Tag className="some-class" type="blue" title="Clear Filter" style={{width:'175px'}}>
                  Severity Level: {cardData.relative}
                </Tag>
              </div>

            </ClickableTile>
            </>
          ))}
        </div>
      </div>

      <div className="result-container">
        {/* <h2 className='Watsonx-Heading'>
          <span className="black-text">watson</span>
          <span style={{ color: "#18469c", fontWeight: "700", fontFamily: "IBM Plex Sans" }}>x &trade;</span>
          <span > Insight</span>
        </h2> */}
        <br></br>
        {/* <h4 style={{ marginTop: "0rem", marginBottom: '0.5rem' }}>Issue Analysis</h4> */}


        {selectedCard && responseData && (
          <div>
            <div className='analysisDiv' style={{ marginTop: '0.65rem',fontSize:'16px' }}>
              <p>{selectedCard.content}</p>
              <div className="sentiment-buttons">

                <div>
                
                  <h4 style={{fontWeight:'700', fontSize:'16px'}}> Message Analysis </h4>
                  <div style={{ paddingLeft: '0.5rem' }}>
                  <h4 style={{ fontWeight: '500', fontSize:'16px' }}>Title: <span style={{ fontWeight: '400', fontSize:'16px' }}>{selectedCard.regional_title}</span></h4>
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
            <div style={{ width: '100%', display: "flex", justifyContent: "space-between", marginBottom: '1rem' }}>
            <h4 style={{position: "relative", top:"1rem", fontSize:'22px', color:'#545454', fontWeight:'600'}}>Suggested Trouble Ticket:</h4> 
            <br></br>

            </div>
            <br></br>
            <br></br>


            <div className='analysisDiv-2 ' >
              <div className='trouble-ticket-container'>

                <ul className='tickets'>
                  {/*  {selectedCard.SuggestedResponse.map(textItem=> (
                <li style={{fontSize:'large'}}>{textItem}</li>
            ))} */}

                  <h4 style={{ lineHeight: '1.2rem',fontSize: "16px" }}><span style={{ fontWeight: '700', fontSize:'16px', color: '#5454545'  }}>Location:</span> {selectedCard.City}, {selectedCard.Province}</h4>
                  <br></br>

                  <h4 style={{ lineHeight: '1.2rem' ,fontSize: "16px"}}><span style={{ fontWeight: '700', fontSize:'16px', color: '#5454545'  }}>Short Description:</span> {responseData.campaign.issue_summary}</h4>
                  <br></br>
                  <h4 style={{ lineHeight: '1.2rem',fontSize: "16px" }}><span style={{ fontWeight: '700', fontSize:'16px' }}>SevOne Data:</span> {selectedCard.secone_data}
               
                  </h4>
                  <br></br>
                  <h4 style={{ lineHeight: '1.2rem',fontSize: "16px" }}><span style={{ fontWeight: '700', fontSize:'16px' }}>Social Media Volume: </span>{selectedCard.count_adj}</h4>
                  <h4 style={{ lineHeight: '1.2rem' ,fontSize: "16px"}}><span style={{ fontWeight: '700', fontSize:'16px' }}>Estimated Urgency Level: </span> {selectedCard.relative}</h4>

                </ul>
              </div>
              <br></br>
              <div>
                <ClickableTile id="button" style={{ fontWeight: '600' }} className={`submit-button ${submitted ? 'submitted' : ''}`} onClick={handleSubmit}>{submitted ? '' : 'Copy Analysis'}</ClickableTile>
              </div>
            </div>
          </div>
        )} {(!selectedCard || !responseData) &&(
          <div>
          <Loading withOverlay={false} style={{position:"relative", left:'40%', top:'15rem'}}/>
          <h2 className='Watsonx-Heading' style={{display:'flex', position:"relative", top:'15rem', left:'23%'}}>
          <span className="black-text">watson</span>
          <span style={{ color: "#18469c", fontWeight: "700", fontFamily: "IBM Plex Sans" }}>x &trade;</span>
          <span > is Analysing</span>
        </h2>
        </div>) }
      </div>
      </>
        }
    </div>
  );
}

export default TrendsDataCards;
