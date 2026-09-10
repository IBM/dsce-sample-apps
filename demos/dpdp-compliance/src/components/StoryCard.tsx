import React from 'react';
import { motion } from 'framer-motion';

interface StoryCardProps {
  title: string;
  description: string;
  dpdpSection: string;
  impact: string;
}

const StoryCard: React.FC<StoryCardProps> = ({ title, description, dpdpSection, impact }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white rounded-2xl p-6 shadow-lg"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-4">Story</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
          <p className="text-gray-700 leading-relaxed">{description}</p>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-ibm-blue font-semibold">📋</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">DPDP Compliance</p>
              <p className="text-sm text-gray-600">{dpdpSection}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="text-ibm-green font-semibold">💡</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">Impact</p>
              <p className="text-sm text-gray-600">{impact}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StoryCard;

// Made with Bob
