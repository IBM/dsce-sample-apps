import React from 'react';

interface NavigationProps {
  currentStage: number;
  totalStages: number;
  onPrevious: () => void;
  onNext: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentStage, totalStages, onPrevious, onNext }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onPrevious}
          disabled={currentStage === 1}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            currentStage === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ← Previous
        </button>
        
        <button
          onClick={onNext}
          disabled={currentStage === totalStages}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            currentStage === totalStages
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-ibm-blue text-white hover:bg-blue-700'
          }`}
        >
          Next Step →
        </button>
      </div>
    </div>
  );
};

export default Navigation;

// Made with Bob
