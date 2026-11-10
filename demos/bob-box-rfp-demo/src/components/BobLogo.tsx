import React from 'react';

interface BobLogoProps {
  className?: string;
  size?: number | string;
}

export const BobLogo: React.FC<BobLogoProps> = ({ className = "w-8 h-8", size }) => {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Bob Logo"
    >
      {/* Ear / Headphone Side Modules */}
      {/* Left Ear */}
      <rect
        x="68"
        y="298"
        width="38"
        height="80"
        rx="12"
        fill="#adcfff"
        stroke="#1a1a1a"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* Right Ear */}
      <rect
        x="406"
        y="298"
        width="38"
        height="80"
        rx="12"
        fill="#adcfff"
        stroke="#1a1a1a"
        strokeWidth="18"
        strokeLinejoin="round"
      />

      {/* Head / Robot Face (White Rounded Box) */}
      <rect
        x="96"
        y="250"
        width="320"
        height="180"
        rx="64"
        fill="#ffffff"
        stroke="#1a1a1a"
        strokeWidth="22"
        strokeLinejoin="round"
      />

      {/* Hardhat Main Dome */}
      <path
        d="M 104 250 C 104 125, 175 62, 256 62 C 337 62, 408 125, 408 250 Z"
        fill="#1d6bf3"
        stroke="#1a1a1a"
        strokeWidth="22"
        strokeLinejoin="round"
      />

      {/* Hardhat Center Ridge */}
      <path
        d="M 214 68 C 214 68, 206 140, 206 182 L 306 182 C 306 140, 298 68, 298 68 Z"
        fill="#1d6bf3"
        stroke="#1a1a1a"
        strokeWidth="18"
        strokeLinejoin="round"
      />

      {/* Hardhat Lower Band Arc */}
      <path
        d="M 124 228 C 190 216, 322 216, 388 228"
        stroke="#1a1a1a"
        strokeWidth="18"
        strokeLinecap="round"
      />

      {/* Hardhat Visor / Brim */}
      <path
        d="M 62 262 C 62 248, 76 238, 92 238 L 420 238 C 436 238, 450 248, 450 262 C 450 274, 436 284, 420 284 L 92 284 C 76 284, 62 274, 62 262 Z"
        fill="#1d6bf3"
        stroke="#1a1a1a"
        strokeWidth="22"
        strokeLinejoin="round"
      />

      {/* Eyes */}
      {/* Left Eye */}
      <circle cx="184" cy="336" r="34" fill="#1a1a1a" />
      <circle cx="172" cy="324" r="11" fill="#ffffff" />

      {/* Right Eye */}
      <circle cx="328" cy="336" r="34" fill="#1a1a1a" />
      <circle cx="316" cy="324" r="11" fill="#ffffff" />

      {/* Smile */}
      <path
        d="M 216 388 C 228 408, 284 408, 296 388"
        stroke="#1a1a1a"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};
