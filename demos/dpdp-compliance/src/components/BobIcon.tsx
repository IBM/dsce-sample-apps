import React from 'react';

interface BobIconProps {
  className?: string;
  size?: number;
}

const BobIcon: React.FC<BobIconProps> = ({ className = '', size = 64 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="150" cy="150" r="140" fill="#E8F0FE" />
      
      {/* Hard hat */}
      <path
        d="M150 60C110 60 80 75 80 95V110H220V95C220 75 190 60 150 60Z"
        fill="#4285F4"
        stroke="#1A1A1A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M70 110H230C235 110 240 115 240 120V130C240 135 235 140 230 140H70C65 140 60 135 60 130V120C60 115 65 110 70 110Z"
        fill="#5E97F6"
        stroke="#1A1A1A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="140" y="65" width="20" height="35" fill="#1A1A1A" rx="3" />
      
      {/* Head */}
      <rect
        x="90"
        y="140"
        width="120"
        height="80"
        rx="15"
        fill="white"
        stroke="#1A1A1A"
        strokeWidth="6"
      />
      
      {/* Eyes */}
      <circle cx="125" cy="170" r="12" fill="#1A1A1A" />
      <circle cx="175" cy="170" r="12" fill="#1A1A1A" />
      
      {/* Smile */}
      <path
        d="M125 195C125 195 137.5 205 150 205C162.5 205 175 195 175 195"
        stroke="#1A1A1A"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Ears */}
      <rect x="70" y="155" width="20" height="40" rx="10" fill="white" stroke="#1A1A1A" strokeWidth="6" />
      <rect x="210" y="155" width="20" height="40" rx="10" fill="white" stroke="#1A1A1A" strokeWidth="6" />
      
      {/* Body */}
      <path
        d="M100 220H200C210 220 220 230 220 240V260C220 270 210 280 200 280H100C90 280 80 270 80 260V240C80 230 90 220 100 220Z"
        fill="white"
        stroke="#1A1A1A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Code symbol */}
      <text x="150" y="260" fontSize="48" fill="#4285F4" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        {'</>'}
      </text>
      
      {/* Arms */}
      <path
        d="M80 230C70 230 60 235 60 245C60 255 65 265 75 270"
        stroke="#1A1A1A"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M220 230C230 230 240 235 240 245C240 255 235 265 225 270"
        stroke="#1A1A1A"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

export default BobIcon;

// Made with Bob
