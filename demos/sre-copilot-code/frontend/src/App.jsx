import React, { useState, useEffect } from 'react';
import { Theme } from '@carbon/react';
import IncidentBoard from './pages/IncidentBoard';
import AdminPanel from './pages/AdminPanel';
import { getAdminConfig } from './services/api';

export default function App() {
  const [isAdminOpen, setIsAdminOpen]     = useState(false);
  const [controlsActive, setControlsActive] = useState(false);
  // boardResetKey — bumping this triggers a board reload in IncidentBoard
  const [boardResetKey, setBoardResetKey] = useState(0);

  // Poll admin config on mount (and after panel closes) for the KPI badge
  useEffect(() => {
    getAdminConfig()
      .then((cfg) => {
        setControlsActive(Object.values(cfg).some(Boolean));
      })
      .catch(() => {});
  }, [isAdminOpen]);

  const handleBoardReset = () => {
    setBoardResetKey((k) => k + 1);
  };

  return (
    <Theme theme="g10">
      <IncidentBoard
        onOpenAdmin={() => setIsAdminOpen(true)}
        controlsActive={controlsActive}
        boardResetKey={boardResetKey}
      />
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onBoardReset={handleBoardReset}
      />
    </Theme>
  );
}
