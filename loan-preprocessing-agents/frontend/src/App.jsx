import React, { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Header, HeaderName, HeaderNavigation, HeaderMenuItem, HeaderGlobalBar, HeaderGlobalAction } from '@carbon/react';
import SidePanel from "./components/SidePanel/SidePanel";
import { Logout } from '@carbon/react/icons';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage'; // You will need to create this
import ProtectedRoute from './components/ProtectedRoute';

// Your existing page components
import LoanApplication from './components/LoanApplication/LoanApplication';
import MyApplications from './components/MyApplications/MyApplications';
import LoanCalculator from './components/LoanCalculator/LoanCalculator';

import './App.css';

export const PanelContext = React.createContext();

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelContent, setPanelContent] = useState(null);
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <PanelContext.Provider value={{ setIsPanelOpen, setPanelContent }}>
    <div className="app-wrapper">
      <Header aria-label="Loan Application Platform">
        <HeaderName as={Link} to={token ? "/apply" : "/login"} prefix="Financial">
          LoanHub
        </HeaderName>
        {token && (
          <HeaderNavigation aria-label="Main Navigation">
            <HeaderMenuItem as={Link} to="/apply">Apply</HeaderMenuItem>
            <HeaderMenuItem as={Link} to="/my-applications">My Applications</HeaderMenuItem>
            <HeaderMenuItem as={Link} to="/calculator">Loan Calculator</HeaderMenuItem>
          </HeaderNavigation>
        )}
        <HeaderGlobalBar>
          {token && (
            <HeaderGlobalAction aria-label="Logout" onClick={handleLogout}>
              <Logout size={20} />
            </HeaderGlobalAction>
          )}
        </HeaderGlobalBar>
      </Header>

      <main className="page-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/apply" element={<LoanApplication />} />
            <Route path="/my-applications" element={<MyApplications />} />
            <Route path="/calculator" element={<LoanCalculator />} />
            {/* Redirect root to /apply if logged in */}
            <Route path="/" element={<LoanApplication />} />
          </Route>
        </Routes>
      </main>
      <SidePanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)}>
        {panelContent}
      </SidePanel>
    </div>
    </PanelContext.Provider>
  );
}

export default App;