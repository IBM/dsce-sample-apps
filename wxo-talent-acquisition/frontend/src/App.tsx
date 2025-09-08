// src/App.tsx (minimal wiring)
import React from "react";
import { Header, HeaderName, Content, Theme } from "@carbon/react";
import TalentHubPage from "./pages/TalentHubPage";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';
const App: React.FC = () => (
  <BrowserRouter>
    <Theme theme="g10">
      <Header aria-label="TalentHub">
        <HeaderName href="/" prefix="TA">
          TalentHub
        </HeaderName>
      </Header>
      <Content id="main-content" style={{ marginTop: "3rem" }}>
        <Routes>
          <Route path="/" element={<TalentHubPage />} />
        </Routes>
      </Content>
    </Theme>
  </BrowserRouter>
);

export default App;
