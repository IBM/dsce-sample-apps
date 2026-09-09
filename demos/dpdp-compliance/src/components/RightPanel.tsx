import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage } from '../types';
import Stage1Consent from './stages/Stage1Consent';
import Stage2Discovery from './stages/Stage2Discovery';
import Stage3Protection from './stages/Stage3Protection';
import Stage4Encryption from './stages/Stage4Encryption';
import Stage5Breach from './stages/Stage5Breach';
import Stage6Compliance from './stages/Stage6Compliance';
import Stage7AgenticAI from './stages/Stage7AgenticAI';

interface RightPanelProps {
  stage: Stage;
}

const RightPanel: React.FC<RightPanelProps> = ({ stage }) => {
  const renderStageContent = () => {
    switch (stage.id) {
      case 1:
        return <Stage1Consent />;
      case 2:
        return <Stage2Discovery />;
      case 3:
        return <Stage3Protection />;
      case 4:
        return <Stage4Encryption />;
      case 5:
        return <Stage5Breach />;
      case 6:
        return <Stage6Compliance />;
      case 7:
        return <Stage7AgenticAI />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 bg-ibm-bg p-8 overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          {/* Stage Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-ibm-blue text-white rounded-full font-semibold text-sm">
                Stage {stage.id}: {stage.name}
              </span>
              <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-semibold text-sm">
                {stage.story.dpdpSection}
              </span>
            </div>
          </div>

          {/* Interactive Stage Content */}
          {renderStageContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RightPanel;

// Made with Bob
