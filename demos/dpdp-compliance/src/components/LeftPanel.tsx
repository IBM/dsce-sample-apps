import React from 'react';
import { motion } from 'framer-motion';
import { Stage } from '../types';

interface LeftPanelProps {
  stages: Stage[];
}

const LeftPanel: React.FC<LeftPanelProps> = ({ stages }) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 p-8 flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 mb-8">PII Data Journey</h2>
      
      <div className="flex-1 relative">
        {stages.map((stage, index) => (
          <div key={stage.id} className="relative mb-8 last:mb-0">
            {/* Connecting Line */}
            {index < stages.length - 1 && (
              <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-300" />
            )}
            
            {/* Stage Item */}
            <div className="flex items-start gap-4">
              {/* Circle Icon */}
              <div className="relative flex-shrink-0">
                <motion.div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                    stage.status === 'completed'
                      ? 'bg-ibm-green'
                      : stage.status === 'active'
                      ? 'bg-ibm-blue'
                      : 'bg-ibm-gray'
                  }`}
                  animate={
                    stage.status === 'active'
                      ? {
                          boxShadow: [
                            '0 0 0 0 rgba(15, 98, 254, 0.4)',
                            '0 0 0 10px rgba(15, 98, 254, 0)',
                            '0 0 0 0 rgba(15, 98, 254, 0)',
                          ],
                        }
                      : {}
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {stage.status === 'completed' ? '✓' : stage.id}
                </motion.div>
              </div>
              
              {/* Stage Info */}
              <div className="flex-1 pt-2">
                <div className="text-sm text-gray-600 font-medium">Stage {stage.id}</div>
                <div className={`text-lg font-bold ${
                  stage.status === 'active' ? 'text-ibm-blue' : 'text-gray-900'
                }`}>
                  {stage.name}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeftPanel;

// Made with Bob
