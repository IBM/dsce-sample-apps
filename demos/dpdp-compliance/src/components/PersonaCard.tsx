import React from 'react';
import { motion } from 'framer-motion';
import { Persona } from '../types';

interface PersonaCardProps {
  personas: Persona[];
}

const PersonaCard: React.FC<PersonaCardProps> = ({ personas }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl p-6 shadow-lg"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-4">Current Personas</h3>
      <div className="flex flex-wrap gap-4">
        {personas.map((persona, index) => (
          <div
            key={index}
            className="flex items-center gap-3 bg-ibm-bg rounded-xl p-4 flex-1 min-w-[200px]"
          >
            <div className="text-4xl">{persona.avatar}</div>
            <div>
              <div className="font-semibold text-gray-900">{persona.name}</div>
              <div className="text-sm text-gray-600">{persona.role}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PersonaCard;

// Made with Bob
