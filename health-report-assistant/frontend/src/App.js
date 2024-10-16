import React from "react";
import {
  Content,
  Header,
  HeaderName,
  HeaderGlobalAction,
  HeaderGlobalBar,
  Theme,
} from "@carbon/react";
import "./app.scss";
import Homepage from "./pages/HomePage/Homepage";
import Navigation from "./components/navigation/Navigation";
import { Provider, useSelector } from "react-redux";
import { store } from "./store/Store";
import { PersistGate } from "redux-persist/integration/react";
import { Search, Notification, Switcher } from "@carbon/icons-react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Theme theme="g100"></Theme>
      <Provider store={store}>
        <Content>
          {/* <Header aria-label="Header for Our Skeleton App">
            <HeaderName href="/" prefix="IBM watsonx">
              Generative AI
            </HeaderName>
          </Header> */}
          {/* <Navigation /> */}
          <Routes>
            <Route exact path="/" element={<Navigate to="/homepage" />} />
            <Route path="/homepage" element={<Homepage />} />
          </Routes>
        </Content>
      </Provider>
    </BrowserRouter>
  );
}

export default App;
