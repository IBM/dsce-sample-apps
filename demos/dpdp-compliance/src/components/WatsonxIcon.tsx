import React from 'react';

interface WatsonxIconProps {
  size?: number;
  className?: string;
}

export const WatsonxIcon: React.FC<WatsonxIconProps> = ({ size = 64, className = '' }) => {
  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ width: size * 2, height: size }}
    >
      <svg
        width={size * 2}
        height={size}
        viewBox="0 0 200 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* IBM watsonx Orchestrate Logo */}
        <defs>
          <linearGradient id="watsonxGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F62FE" />
            <stop offset="100%" stopColor="#8A3FFC" />
          </linearGradient>
        </defs>
        
        {/* Background rounded rectangle */}
        <rect x="0" y="0" width="200" height="80" rx="12" fill="#F4F4F4" />
        
        {/* IBM Logo - Horizontal stripes */}
        <g transform="translate(15, 20)">
          <rect x="0" y="0" width="30" height="6" fill="#0F62FE" />
          <rect x="0" y="10" width="30" height="6" fill="#0F62FE" />
          <rect x="0" y="20" width="30" height="6" fill="#0F62FE" />
          <rect x="0" y="30" width="30" height="6" fill="#0F62FE" />
          <rect x="0" y="40" width="30" height="6" fill="#0F62FE" />
        </g>
        
        {/* watsonx text */}
        <text 
          x="55" 
          y="35" 
          fontFamily="IBM Plex Sans, Arial, sans-serif" 
          fontSize="18" 
          fontWeight="600"
          fill="url(#watsonxGradient)"
        >
          watsonx
        </text>
        
        {/* Orchestrate text */}
        <text 
          x="55" 
          y="55" 
          fontFamily="IBM Plex Sans, Arial, sans-serif" 
          fontSize="14" 
          fontWeight="400"
          fill="#161616"
        >
          Orchestrate
        </text>
        
        {/* Decorative element - small hexagon */}
        <g transform="translate(170, 30)">
          <polygon 
            points="10,0 20,5 20,15 10,20 0,15 0,5" 
            fill="url(#watsonxGradient)"
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
};

// Made with Bob
