import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import Navigation from './components/Navigation';
import BobAssistant from './components/BobAssistant';
import { stages as initialStages } from './data';
import { Stage } from './types';

function App() {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [guidedMode, setGuidedMode] = useState(true);
  const [stages, setStages] = useState<Stage[]>(initialStages);

  // Update stage statuses based on current stage
  useEffect(() => {
    const updatedStages = initialStages.map((stage, index) => ({
      ...stage,
      status: index < currentStageIndex
        ? 'completed'
        : index === currentStageIndex
        ? 'active'
        : 'upcoming'
    })) as Stage[];
    
    setStages(updatedStages);
  }, [currentStageIndex]);

  const handleNext = () => {
    if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
    }
  };

  const handleToggleGuidedMode = () => {
    setGuidedMode(!guidedMode);
  };

  return (
    <div className="h-screen flex flex-col bg-ibm-bg">
      <Header
        currentStage={currentStageIndex + 1}
        totalStages={stages.length}
        guidedMode={guidedMode}
        onToggleGuidedMode={handleToggleGuidedMode}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel stages={stages} />
        <RightPanel stage={stages[currentStageIndex]} />
      </div>
      
      <Navigation
        currentStage={currentStageIndex + 1}
        totalStages={stages.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
      
      {/* IBM BOB SDLC Assistant */}
      <BobAssistant />
    </div>
  );
}

export default App;

// Made with Bob
