import logo from "./logo.svg";
import "./App.css";
import "./App.scss";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
// import { Provider } from 'react-redux';

import telcoLlogo from "./telco-logo.png";

import { Button } from "@carbon/react";

import IssueAnalysisDashboard from "./pages/issueAnalysisDashboard/issueAnalysisDashboard";
import IssuesTrends from "./pages/issuesTrends/issuesTrends";
import RegionalIssues from "./pages/regionalIssues/regionalIssues";
import SocialMediaIssues from "./pages/socialMediaIssues/socialMediaIssues";

function App() {
  return (
    <div className="App">
      <a href="/">
        <img
          style={{ marginTop: "0.9rem", zIndex: "10000" }}
          className="Logo-Telco"
          src={telcoLlogo}
          alt="Logo"
        />
      </a>
      {/* <h5 className='Watsonx-Heading' style={{display:'flex', position:"relative", top:'0.9rem', left:'88%', zIndex: "100"}}> 
          <span className="black-text"> Powered by Watson</span>
          <span style={{ color: "#18469c", fontWeight: "700", fontFamily: "IBM Plex Sans" }}>x &trade;</span>
          </h5> */}

      {/* <a href="/" ><img style={{marginTop:'0.9rem'}} className='Logo-Telco' src={telcoLlogo} alt="Logo"/></a> */}

      <img
        style={{
          marginTop: "0.9rem",
          display: "flex",
          position: "relative",
          top: "1.2rem",
          left: "88%",
          zIndex: "100",
          width: "150px",
          visibility: "hidden",
          height:"49.09px",
          minHeight:"49.09px"
        }}
        className="Logo-Watsonx"
        alt="Logo"
      />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IssueAnalysisDashboard />} />
          <Route path="issue-trends" element={<IssuesTrends />} />
          <Route path="regional-issues" element={<RegionalIssues />} />
          <Route path="social-media-issues" element={<SocialMediaIssues />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
