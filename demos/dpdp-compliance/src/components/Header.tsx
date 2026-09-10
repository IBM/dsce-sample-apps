import React from 'react';

interface HeaderProps {
  currentStage: number;
  totalStages: number;
  guidedMode: boolean;
  onToggleGuidedMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentStage, totalStages, guidedMode, onToggleGuidedMode }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DPDP Compliance Demo</h1>
          <p className="text-sm text-gray-600 mt-1">DPDP Personal Data Journey</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-gray-600">Progress</p>
            <p className="text-lg font-semibold text-ibm-blue">
              Step {currentStage} of {totalStages}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Guided Demo Mode</span>
            <button
              onClick={onToggleGuidedMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                guidedMode ? 'bg-ibm-blue' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  guidedMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

// Made with Bob
