/* <p>Developed by: Ankit Guria</p>
<p>Contact: Blue Partner Labs, IBM India Software Labs, email: ankit.guria@ibm.com</p> */

import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import ChargerCatalog from './components/ChargerCatalog';
import OrderDetail from './components/OrderDetail';
import WatsonOrders from './components/WatsonOrders';
import HelpPage from './components/HelpPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<LandingPage />} />
        <Route path="/ChargerCatalog/*" element={<ChargerCatalog />} />
        <Route path="/OrderDetail/*" element={<OrderDetail />} />
        <Route path="/WatsonOrders/*" element={<WatsonOrders />} />
        HelpPage
        <Route path="/HelpPage/*" element={<HelpPage />} />
      </Routes>
    </Router>
  );
}

export default App;
