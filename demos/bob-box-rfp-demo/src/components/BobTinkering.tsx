import React from 'react';

interface BobTinkeringProps {
  className?: string;
  size?: number | string;
}

export const BobTinkering: React.FC<BobTinkeringProps> = ({ className = "w-20 h-20", size }) => {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <style>{`
        @keyframes bobHeadBob {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(-1.5deg); }
          50% { transform: translateY(1px) rotate(0.5deg); }
          75% { transform: translateY(-2px) rotate(1.5deg); }
        }
        @keyframes bobEyeTrack {
          0%, 100% { transform: translate(0px, 0px); }
          25% { transform: translate(4px, 1px); }
          50% { transform: translate(-3px, 2px); }
          75% { transform: translate(2px, 0px); }
        }
        @keyframes bobEarPulse {
          0%, 100% { fill: #adcfff; }
          50% { fill: #4589ff; }
        }
        .bob-head-anim {
          animation: bobHeadBob 2.4s ease-in-out infinite;
          transform-origin: 256px 420px;
        }
        .bob-eye-pupil {
          animation: bobEyeTrack 2.8s ease-in-out infinite;
        }
        .bob-ear-glow {
          animation: bobEarPulse 1.8s ease-in-out infinite;
        }
      `}</style>

      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Bob's Head & Face Group (Animated Bobbing) */}
        <g className="bob-head-anim">
          {/* Ear / Headphone Side Modules */}
          {/* Left Ear */}
          <rect
            x="68"
            y="298"
            width="38"
            height="80"
            rx="12"
            className="bob-ear-glow"
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
            className="bob-ear-glow"
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

          {/* Eyes with Scanning Tracking Pupil */}
          {/* Left Eye */}
          <circle cx="184" cy="336" r="34" fill="#1a1a1a" />
          <g className="bob-eye-pupil">
            <circle cx="174" cy="326" r="11" fill="#ffffff" />
            <circle cx="188" cy="342" r="5" fill="#ffffff" opacity="0.7" />
          </g>

          {/* Right Eye */}
          <circle cx="328" cy="336" r="34" fill="#1a1a1a" />
          <g className="bob-eye-pupil">
            <circle cx="318" cy="326" r="11" fill="#ffffff" />
            <circle cx="332" cy="342" r="5" fill="#ffffff" opacity="0.7" />
          </g>

          {/* Friendly Smile */}
          <path
            d="M 216 388 C 228 408, 284 408, 296 388"
            stroke="#1a1a1a"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
};
