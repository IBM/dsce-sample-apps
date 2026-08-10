import React, { useState, useRef, useEffect } from "react";
import "./issueAnalysisDashboard.scss";
import "carbon-components/css/carbon-components.min.css";
import { ChevronDown } from "@carbon/icons-react";

import PageHeader from "../../components/pageHeader/pageHeader";
import MetricTile from "../../components/metricTile/metricTile";
// import DisplayCSV from '../../components/displayCSV/displayCSV';
// import Upload from '../../components/upload/upload';
import JsonTable from "../../components/dataTable/table";

import { Select, SelectItem, Dropdown } from "carbon-components-react";
import Upload from "./Upload";
import DatasetDivider from "../../components/frequencyChart/category";
import ServiceChart from "../../components/serviceChart/serviceChart";
import SentimentAnalysis from "../../components/sentimentChart/sentimentChart";
import ScatterChart from "../../components/dayScatter/dayScatter";
import DropdownButton from "../../components/displayCSV/displayCSV";
// import Dropdown from '../../components/dropdownFilter/dropdownFilter';
import WordChart from "../../components/wordcloudChart/wordcloudChart";
import MyMap from "../../components/GeoMapLeaflet/MyMap";

import GeoMap from "../../components/GeoMap/GeoMap";

// import TableList from '../../components/tableList/tableList';

// import UtilityService from '../../shared/utilityService';

import { Button } from "@carbon/react";
import RegionalIssues from "../regionalIssues/regionalIssues";
import ServiceDistribution from "../../components/ServiceDistribution/ServiceDistribution";
import DisplayLine from "../../components/lineChart/displayLineChart";
import MultiLineChart from "../../components/lineChart/lineChart";
import StackedServiceChart from "../../components/stackedBarChart/StackedServiceChart.jsx";

export default function IssueAnalysisDashboard() {
  const [selectedFile, setSelectedFile] = useState([]);
  const [headerFile, setHeaderFile] = useState([]);
  const [showcsv, setShowcsv] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [progress, setProgress] = useState(0);
  let head = [],
    newArr = [];
  let parsedData = null;
  const [activeTwitter, setactiveTwitter] = useState(0);
  const handleDivClick = (index) => {
    setactiveTwitter(index);
  };
  const title = "Issue Analysis Dashboard";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState("ComponentA");
  const components_ = [
    { id: 1, text: "ComponentA" },
    { id: 2, text: "ComponentB" },
    { id: 3, text: "ComponentC" },
    { id: 4, text: "ComponentD" },
  ];

  const toggleClassName = () => {
    setIsActive(!isActive);
  };
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectItem = (item) => {
    setSelectedItem(item);
    setIsOpen(false);
  };
  function showAnalytics() {
    // console.log("Displaying Analytics")
    setIsActive(true);
    setShowcsv(false);
  }
  function showCsv() {
    // console.log("Displaying CSV")
    setIsActive(false);
    setShowcsv(true);
  }
  const handleSelectedComponentButtonClick = (e, componentName) => {
    e.preventDefault();
    setSelectedComponent(componentName);
  };
  const handleDropdownInputChange = (event) => {
    setSelectedComponent(event.target.value);
  };
  const components = {
    ComponentA: "All telcos",
    ComponentB: "TelcoA",
    ComponentC: "TelcoB",
    ComponentD: "TelcoC",
  };
  return (
    <div>
      <div
        style={{
          justifyContent: "center",
          display: "flex",
          right: "40%",
          position: "relative",
          top: "-40px",
        }}
      >
        <PageHeader value={title} />
      </div>

      <MetricTile />
      <div style={{ padding: "50px" }}>
        <div className="Title">
          <h4>Comparative Analysis Dashboard</h4>
        </div>
        <div>
          <div style={{ display: "inline-flex" }}>
            <DropdownButton showTable={showTable} setShowTable={setShowTable} />

            {!showTable && (
              <div>
                <Select
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid gray",
                    color: "gray",
                    width: "200px",
                    fontSize: "16px",
                    height: "60px",
                    fontFamily: "IBM Plex Sans",
                    marginLeft: "40px",
                    margin: "12px",
                  }}
                  name="telco"
                  labelText=""
                  id="select-telco"
                  value={selectedComponent}
                  onChange={handleDropdownInputChange}
                >
                  <SelectItem value="" text="" />
                  {Object.entries(components).map(([key, value]) => (
                    <SelectItem
                      key={key}
                      name="component"
                      value={key}
                      text={value}
                    />
                  ))}
                </Select>
              </div>
            )}
          </div>
          {/*<Dropdown/>*/}

          {/* <Button kind="danger--ghost" onClick={(e) => handleSelectedComponentButtonClick(e,'ComponentA')}>Overall</Button>
                 <Button kind="danger--ghost" onClick={(e) => handleSelectedComponentButtonClick(e,'ComponentB')}>TelcoA</Button>
                 <Button kind="danger--ghost" onClick={(e) => handleSelectedComponentButtonClick(e,'ComponentC')}>TelcoB</Button>
                 <Button kind="danger--ghost" onClick={(e) => handleSelectedComponentButtonClick(e,'ComponentD')}>TelcoC</Button> */}

          {/* <Dropdown id="default" titleText="Dropdown label" helperText="This is some helper text" 
                      initialSelectedItem={Object.values(components)[0]} label="All Telcos" items={components} 
                      itemToString={(key,value) => Object.values(component)}
                      onChange={(e) => handleDropdownInputChange(e)}
                      /> */}
          {!showTable && (
            <>
              <div>
                {/* <h3>Issues </h3> */}
                {/* <hr></hr> */}
                <div
                  style={{
                    minWidth: "1450px",
                    width: "98%",
                    marginLeft: "0rem",
                    maxHeight: "800px",
                    maxWidth: "1500px",
                  }}
                >
                  {" "}
                  <DatasetDivider selectedComponent={selectedComponent} />
                </div>
                <br></br>
                <br></br>
                <br></br>
              </div>
              <div
                style={{
                  display: "flex",
                  border: "1px solid lightgray",
                  borderRadius: "4px",
                  marginLeft: "0rem",
                  height: "500px",
                  minWidth: "1450px",
                  width: "98%",
                  paddingTop: "2rem",
                  maxWidth: "1500px",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    left: "2rem",
                    width: "90%",
                    top: "2rem",
                  }}
                >
                  <h5
                    style={{
                      paddingLeft: "5rem",
                      zIndex: -1,
                      fontSize: "12px",
                      width: "120%",
                      position: "relative",
                      bottom: " 2rem",
                    }}
                  >
                    Geographic distribution of tweets{" "}
                  </h5>
                  <MyMap selectedComponent={selectedComponent} />
                </div>
                <div style={{ position: "absolute" }}>
                  <div
                    style={{
                      position: "relative",
                      left: "100%",
                      width: "100%",
                    }}
                  >
                    <h5
                      style={{
                        paddingLeft: "8rem",
                        zIndex: -1,
                        fontSize: "12px",
                        width: "120%",
                      }}
                    >
                      Average number of repeated posts in the past 7 days{" "}
                    </h5>
                    <MultiLineChart selectedComponent={selectedComponent} />
                  </div>
                </div>
                <br></br>
                <div style={{ position: "absolute" }}>
                  <div
                    style={{
                      position: "relative",
                      left: "160%",
                      heigth: "10%",
                      zIndex: -1,
                    }}
                  >
                    <h5
                      style={{
                        paddingLeft: "16rem",
                        zIndex: 2,
                        fontSize: "12px",
                        width: "120%",
                        top: "2rem",
                      }}
                    >
                      {" "}
                      Issues reported
                    </h5>
                    {/* <ServiceDistribution  selectedComponent={selectedComponent}/> */}
                    <StackedServiceChart
                      selectedComponent={selectedComponent}
                    />
                  </div>
                </div>
              </div>
              <br></br>
              <br></br>
              {/* <h3>Sentiment</h3>
                 <hr></hr> */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  border: "1px solid lightgray",
                  borderRadius: "4px",
                  minWidth: "1450px",
                  width: "98%",
                  marginLeft: "0rem",
                  maxWidth: "1500px",
                }}
              >
                <div
                  style={{ position: "relative", bottom: "4rem", zIndex: -1 }}
                >
                  <h5
                    style={{
                      paddingLeft: "3rem",
                      zIndex: 1,
                      fontSize: "12px",
                      width: "120%",
                      fontFamily: "IBM Plex Sans",
                      position: "relative",
                      top: "6rem",
                      marginLeft: "0rem",
                      maxHeight: "100px !important",
                    }}
                  >
                    Sentiment of social media posts
                  </h5>
                  <SentimentAnalysis selectedComponent={selectedComponent} />
                </div>
                <div style={{ marginTop: "2.5rem", marginRight: "2rem" }}>
                  {/* <h5 style={{paddingLeft:'0rem', zIndex:1, fontSize:'12px', width:'120%', position:'relative', top:'1rem', marginLeft:'1rem'}}>Sentiment of social media posts</h5> */}
                  <WordChart selectedComponent={selectedComponent} />
                </div>

                {/**style={{position:'absolute', width:'70%',left:'90%',height:'80%' }} */}
              </div>
            </>
          )}
          <StackedServiceChart />
        </div>
      </div>
    </div>
  );
}

{
  /**<div style={{position:'absolute', width:'70%',height:'80%' }}><GeoMap selectedComponent={selectedComponent}/></div> */
}
