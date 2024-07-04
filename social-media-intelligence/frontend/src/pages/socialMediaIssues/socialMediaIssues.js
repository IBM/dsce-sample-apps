import React, { useEffect, useState } from "react";
import {
  ClickableTile,
  RadioButton,
  RadioButtonGroup,
  Tile,
  Slider,
  Loading,
  IconButton,
  Tag,
} from "@carbon/react";
import { Checkmark, AiLaunch } from "@carbon/icons-react";
import "./../../components/regionalssueCard/issueCard.scss";
import local_jsonData from "./csvjson.json";
import PageHeader from "../../components/pageHeader/pageHeader";

function DataCards() {
  const [selectedTelco, setSelectedTelco] = useState("All Telco");
  const [activeDiv, setActiveDiv] = useState(0);
  const [filteredData, setFilteredData] = useState(local_jsonData);
  const [submitted, setSubmitted] = useState(false);

  // let filteredData = local_jsonData;

  const [selectedCard, setSelectedCard] = useState(null);
  const [copy_element, SetCopy_element] = useState(
    "Sorry to hear about your frustrating experience with TelcoC, @JamesBa88536194. 😔 At TelcoA, we understand the importance of reliable internet and top-notch customer support. We'd love to discuss personalized options for a seamless transition! DM us! 🌐🔧\n@JamesBa88536194 - We're sorry to hear about the issues you're facing with TelcoC. 😞 At TelcoA, we prioritize customer satisfaction. Ready for a change? Let's explore tailored solutions for reliable internet and exceptional support. DM us! 📺💻\nHi @JamesBa88536194! 👋 We're sorry to hear about your experience with TelcoC. 😓 TelcoA aims for excellent service. Considering alternatives? DM us to explore reliable options and personalized support! 🌐💬"
  );

  useEffect(() => {
    if (selectedTelco !== "All Telco") {
      const new_filteredData = local_jsonData.filter(
        (item) => item.carrier === selectedTelco
      );
      setFilteredData(new_filteredData);

      setActiveDiv(new_filteredData[0].id);
      setSelectedCard(new_filteredData[0]);
      // useEffect(()=>{
      //   if(selectedTelco === 'TelcoA'){
      //     console.log(selectedTelco);
      //     setActiveDiv(7);

      //   }

      // })
      // if(selectedTelco === 'TelcoA'){
      //   console.log(selectedTelco);
      //   console.log(filteredData[0].id);
      //   // setActiveDiv(7);

      //   id_select= 7;
      // }
      // else if(selectedTelco === 'TelcoB'){
      //   id_select= 3;
      //   // setActiveDiv(3);
      // }
      // else{
      //   id_select= 0;
      //   // setActiveDiv(0);
      // }
    }
  }, [selectedTelco]);

  const handleDropdownChange = (event) => {
    setSelectedTelco(event.target.value);
    console.log(event.target.value);
  };
  const [data, setData] = useState(null);
  useEffect(() => {
    // Fetch and set JSON data when the component mounts
    let sortedData = local_jsonData;
    sortedData.sort((a, b) => b.message_count - a.message_count);
    setSelectedCard(sortedData[0]);
    setData(sortedData);
  }, []);

  const [isSelected, setIsSelected] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [keyValue, setKeyValue] = useState("default");

  const handleCardClick = (cardData) => {
    setSelectedCard(cardData);
    setActiveDiv(cardData.id);
  };

  const [sliderValue, setSliderValue] = useState(0);

  const handleChange = (event) => {
    setSliderValue(event.value);
  };

  useEffect(() => {
    // Fetch and set JSON data when the component mounts
    let sortedData = local_jsonData;
    sortedData.sort((a, b) => b.message_count - a.message_count);
    setData(sortedData);
  }, []);
  useEffect(() => {
    setResponseData(null);
    const fetchData = async () => {
      try {
        let requestBody;
        if (selectedCard) {
          // console.log(selectedCard)
          requestBody = {
            prompt: String(selectedCard.text),
            username: String(selectedCard.username),
            carrier: String(selectedCard.carrier),
          };
          console.log(requestBody);
        }
        const response = await fetch(
          process.env.REACT_APP_BACKEND_URL + "/summary",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );
        if (!response.ok) {
          setResponseData(null);
          throw new Error("Network response was not ok");
        }
        const jsonData = await response.json();
        setResponseData(jsonData);
        console.log(jsonData);
        await SetCopy_element(
          String(responseData["Generated Response"]["Response 1"]) +
            "\n" +
            String(responseData["Generated Response"]["Response 2"]) +
            "\n" +
            String(responseData["Generated Response"]["Response 3"])
        );
      } catch (error) {
        console.error("Error fetching data:", error);
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
    console.log("This is copied!");
    navigator.clipboard.writeText(copy_element);
    console.log(copy_element);
  };
  const title = "Individual Social Media Issues";
  return (
    <div>
      <div
        style={{
          justifyContent: "center",
          display: "flex",
          right: "38%",
          position: "relative",
          top: "-42px",
        }}
      >
        <PageHeader value={title} />
      </div>
      <select
        value={selectedTelco}
        onChange={handleDropdownChange}
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid gray",
          color: "gray",
          width: "200px",
          fontSize: "16px",
          height: "60px",
          fontFamily: "Helvetica Neue",
          padding: "10px",
          marginTop: "20px",
        }}
      >
        <option value="All Telco">All Telco</option>
        <option value="TelcoA">TelcoA</option>
        <option value="TelcoB">TelcoB</option>
        <option value="TelcoC">TelcoC</option>
      </select>
      <div id="cssportal-grid" style={{ padding: "0px" }}>
        <div className="cards-container">
          {/* <h5 style={{fontWeight:'normal'}}>Select an issue to view analysis by <span class="black-text">Watson</span>
      <span style={{color: "#18469c", fontWeight: "700", fontFamily:"IBM Plex Sans"}}>x &trade;</span></h5> */}
          <br />
          <br />
          <div className="cardDiv">
            {filteredData.map((cardData) => (
              <ClickableTile
                key={cardData.id}
                onClick={() => handleCardClick(cardData)}
                style={{
                  borderRadius: "1px",
                  fontSize: "16px",
                  fontWeight: "400",
                }}
                className={`clickable-div ${
                  activeDiv === cardData.id
                    ? ("Card", "active-blue")
                    : ("Card", "inactive-grey")
                }`}
              >
                {cardData.text}
                {/*    <span style={{fontWeight:'550', fontSize:'small', position:'relative', left:'35%', top:'10%', border:'1px solid black', borderRadius:'1rem'}}># of messages {cardData.message_count}</span> */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "0rem",
                    }}
                  >
                    <Tag
                      className="some-class"
                      type="blue"
                      title="Clear Filter"
                      style={{ minWidth: "140px" }}
                    >
                      {cardData.username}
                    </Tag>
                    <Tag
                      style={{ fontSize: "12.8px", marginLeft: "5px" }}
                      className="some-class"
                      type="blue"
                      title="Clear Filter"
                    >
                      {cardData.timestamp}
                    </Tag>
                  </div>

                  <Tag
                    stclassName="some-class"
                    type="blue"
                    title="Clear Filter"
                    style={{ width: "125px" }}
                  >
                    # of Messages: {cardData.message_count}
                  </Tag>
                </div>
              </ClickableTile>
            ))}
          </div>
        </div>

        <div className="result-container">
          {selectedCard && responseData && (
            <div style={{ marginTop: "1.8rem" }}>
              {
                <div className="analysisDiv">
                  <br></br>
                  <div className="sentiment-buttons">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "16px",
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <p style={{ fontSize: "16px" }}>
                          <span style={{ fontWeight: "700" }}>Sentiment: </span>
                          {responseData.Sentiment}
                        </p>
                      </div>
                    </div>

                    {/*  <RadioButtonGroup  name="radio-button-group1"  style={{ display: "flex", alignItems: "stretch", alignContent: "space-between", width: "100%", justifyContent: "space-between", color:'black'}}
                                      >
                                          <RadioButton name ='radio-button-group' labelText="Positive" value="Positive" id="s-radio-1" disabled={ responseData.Sentiment != 'Positive'} checked= {responseData.Sentiment === "Positive"} color='#1a56c4'/>
                                          <RadioButton name ='radio-button-group' labelText="Negative" value="negative-button" id="s-radio-2" disabled={ responseData.Sentiment !== 'Negative'} checked= {responseData.Sentiment == 'Negative'}/>
                                          <RadioButton name ='radio-button-group' labelText="Neutral" value="neutral-button" id="s-radio-3" disabled={ responseData.Sentiment != 'Neutral'} checked= {responseData.Sentiment === 'Neutral'} />
                                  </RadioButtonGroup>  
              */}
                    <div>
                      <br></br>
                      <h5 style={{ fontSize: "16px" }}>Entities</h5>
                      <div style={{ position: "relative", left: "0.5rem" }}>
                        <p style={{ fontSize: "16px" }}>
                          <span style={{ fontWeight: "700" }}>
                            Service Affected:{" "}
                          </span>{" "}
                          {responseData.Entity["Affected Services"]}
                        </p>
                        <p style={{ fontSize: "16px" }}>
                          <span style={{ fontWeight: "700" }}>Area: </span>
                          {responseData.Entity["Area"]}
                        </p>
                        <p style={{ fontSize: "16px" }}>
                          <span style={{ fontWeight: "700" }}>Duration: </span>
                          {responseData.Entity["Duration"]}
                        </p>
                        <p style={{ fontSize: "16px" }}>
                          <span style={{ fontWeight: "700" }}>Device: </span>
                          {responseData.Entity["Device"]}
                        </p>
                      </div>
                    </div>
                    <br></br>
                    <h5 style={{ fontSize: "16px" }}></h5>
                    <div style={{ position: "relative" }}>
                      <p style={{ fontSize: "16px" }}>
                        <span style={{ fontWeight: "700" }}>Tone: </span>
                        {responseData.Tone}
                      </p>
                    </div>

                    {/*   <RadioButtonGroup  name="radio-button-group"  style={{ display: "flex", alignItems: "stretch", alignContent: "space-between", width: "100%", justifyContent: "space-between"}}
                                  >
                                      <RadioButton name ='radio-button-group' labelText="Angry" value="Angry" id="s-radio-1" disabled={responseData.Tone != 'Angry'} checked= {responseData.Tone === 'Angry'}/>
                                      <RadioButton name ='radio-button-group' labelText="Excitment" value="Excitment" id="s-radio-2" disabled={responseData.Tone != 'Excitment'} checked= {responseData.Tone === 'Excitment'}/>
                                      <RadioButton name ='radio-button-group' labelText="Offensive" value="Offensive" id="s-radio-3" disabled={responseData.Tone != 'Offensive'} checked= {responseData.Tone === 'Offensive'}/>
                                      <RadioButton name ='radio-button-group' labelText="Happy" value="Happy" id="s-radio-4" disabled={responseData.Tone != 'Happy'} checked= {responseData.Tone === 'Happy'}/>
                                      <RadioButton name ='radio-button-group' labelText="Frustration" value="Frustration" id="s-radio-5" disabled={responseData.Tone != 'Frustration'} checked= {responseData.Tone === 'Frustration'}/>
                                      <RadioButton name ='radio-button-group' labelText="Concerned" value="Concerned" id="s-radio-6" disabled={responseData.Tone != 'Concerned'} checked= {responseData.Tone === 'Concerned'}/>
                                      <RadioButton name ='radio-button-group' labelText="Neutral" value="Neutral" id="s-radio-7" disabled={responseData.Tone != 'Neutral'} checked= {responseData.Tone === 'Neutral'} />
                                  </RadioButtonGroup> 
            */}
                  </div>
                </div>
              }

              <br></br>

              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <h4
                  style={{
                    position: "relative",
                    paddingBottom: "0rem",
                    fontSize: "22px",
                    color: "#545454",
                    fontWeight: "600",
                  }}
                >
                  Suggested Response
                </h4>

                {/*<div style={{display:'flex'}}>
                      <Slider style={{position:'relative', bottom:'0.3rem'}}
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

              <br></br>
              <div
                className="analysisDiv campaignTile"
                style={{ height: "350px" }}
              >
                {/* {selectedCard["Generated Response"].map(textItem=> (
                        <Tile style={{marginBottom: "10px"}}>{textItem}</Tile>
                     ))} */}
                <ClickableTile
                  style={{ marginBottom: "1rem", fontSize: "16px" }}
                  className="response"
                >
                  {responseData["Generated Response"]["Response 1"]}
                </ClickableTile>
                <ClickableTile
                  style={{ marginBottom: "1rem", fontSize: "16px" }}
                  className="response"
                >
                  {responseData["Generated Response"]["Response 2"]}
                </ClickableTile>
                <ClickableTile
                  style={{ marginBottom: "0rem", fontSize: "16px" }}
                  className="response"
                >
                  {responseData["Generated Response"]["Response 3"]}
                </ClickableTile>
              </div>
              <br></br>
              <div>
                <ClickableTile
                  id="button"
                  style={{ fontWeight: "600" }}
                  className={`submit-button1 ${submitted ? "submitted1" : ""}`}
                  onClick={handleSubmit}
                >
                  {submitted ? "" : "Send Campaign"}
                </ClickableTile>
              </div>
            </div>
          )}
          {(!selectedCard || !responseData) && (
            <div>
              <Loading
                withOverlay={false}
                style={{ position: "relative", left: "40%", top: "15rem" }}
              />
              <h2
                className="Watsonx-Heading"
                style={{
                  display: "flex",
                  position: "relative",
                  top: "15rem",
                  left: "23%",
                }}
              >
                <span className="black-text">watson</span>
                <span
                  style={{
                    color: "#18469c",
                    fontWeight: "700",
                    fontFamily: "IBM Plex Sans",
                  }}
                >
                  x &trade;
                </span>
                <span> </span>
                <span> is Analysing</span>
              </h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataCards;
