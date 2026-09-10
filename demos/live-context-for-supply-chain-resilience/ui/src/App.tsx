// ui/src/App.tsx – root router
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage, AuthUser } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ActiveRisksPage } from './pages/ActiveRisksPage';
import { RiskDetailPage } from './pages/RiskDetailPage';
import { AgentPage } from './pages/AgentPage';
import { EventsPage } from './pages/EventsPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ConfigurationPage } from './pages/ConfigurationPage';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <AppLayout user={user} onLogout={() => setUser(null)}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/risks" element={<ActiveRisksPage />} />
          <Route path="/risks/:riskId" element={<RiskDetailPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/configuration" element={<ConfigurationPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};
