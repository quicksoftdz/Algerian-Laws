import React from 'react';

interface RobotMascotProps {
  className?: string;
  size?: number;
  isThinking?: boolean;
}

export const RobotMascot: React.FC<RobotMascotProps> = ({
  className = '',
  size = 76,
  isThinking = false,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Assistant mascot"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full transition-transform duration-300 ease-out hover:scale-105 ${
          isThinking ? 'animate-bounce' : ''
        }`}
      >
        <defs>
          {/* Yellow head gradient */}
          <linearGradient id="robotYellowHead" x1="50" y1="12" x2="50" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Yellow highlight glow */}
          <linearGradient id="robotHighlight" x1="30" y1="18" x2="70" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>

          {/* Dark visor gradient */}
          <linearGradient id="robotVisor" x1="50" y1="28" x2="50" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Earphone ear pod gradients */}
          <linearGradient id="earphoneMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>

          {/* Visor reflection */}
          <linearGradient id="visorReflection" x1="35" y1="32" x2="65" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Top center antenna / sensor bump */}
        <path
          d="M47 16 C47 13, 53 13, 53 16 Z"
          fill="#d97706"
        />
        <rect x="48.5" y="10" width="3" height="4.5" rx="1.5" fill="#f59e0b" />
        <circle cx="50" cy="9.5" r="2.2" fill="#fbbf24" />

        {/* Left ear pod / headphone cup */}
        <g>
          {/* Outer dark connector */}
          <rect x="18" y="32" width="7" height="18" rx="3.5" fill="url(#earphoneMetal)" />
          {/* Inner yellow accent ring */}
          <circle cx="21" cy="41" r="5" fill="#d97706" />
          <circle cx="21" cy="41" r="3.2" fill="#f59e0b" />
          <circle cx="21" cy="41" r="1.5" fill="#18181b" />
        </g>

        {/* Right ear pod / headphone cup */}
        <g>
          {/* Outer dark connector */}
          <rect x="75" y="32" width="7" height="18" rx="3.5" fill="url(#earphoneMetal)" />
          {/* Inner yellow accent ring */}
          <circle cx="79" cy="41" r="5" fill="#d97706" />
          <circle cx="79" cy="41" r="3.2" fill="#f59e0b" />
          <circle cx="79" cy="41" r="1.5" fill="#18181b" />
        </g>

        {/* Headphone headband bridge */}
        <path
          d="M24 35 C24 16, 76 16, 76 35"
          stroke="#27272a"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Main Robot Head (Yellow rounded cube / helmet) */}
        <rect
          x="23"
          y="18"
          width="54"
          height="48"
          rx="18"
          fill="url(#robotYellowHead)"
        />

        {/* Head upper highlight */}
        <ellipse
          cx="50"
          cy="24"
          rx="18"
          ry="4"
          fill="url(#robotHighlight)"
        />

        {/* Dark Visor Face Screen */}
        <rect
          x="29"
          y="28"
          width="42"
          height="28"
          rx="10"
          fill="url(#robotVisor)"
          stroke="#27272a"
          strokeWidth="1.2"
        />

        {/* Visor glossy light sheen */}
        <path
          d="M32 32 C38 30, 62 30, 68 32 C65 38, 35 38, 32 32 Z"
          fill="url(#visorReflection)"
        />

        {/* Robot Eyes (Yellow glowing friendly eyes) */}
        <g className="transition-opacity duration-200">
          {/* Left Eye */}
          <circle cx="41.5" cy="40" r="3.8" fill="#fbbf24" />
          <circle cx="42.5" cy="38.8" r="1.2" fill="#ffffff" />

          {/* Right Eye */}
          <circle cx="58.5" cy="40" r="3.8" fill="#fbbf24" />
          <circle cx="59.5" cy="38.8" r="1.2" fill="#ffffff" />
        </g>

        {/* Friendly Robot Smile */}
        <path
          d="M46 47.5 Q50 51 54 47.5"
          stroke="#fbbf24"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Robot Neck */}
        <rect x="42" y="66" width="16" height="5" rx="2.5" fill="#3f3f46" />

        {/* Robot Torso / Shoulders (Yellow bottom plate) */}
        <path
          d="M31 71 C31 69, 69 69, 69 71 L75 88 C75 91, 25 91, 25 88 Z"
          fill="url(#robotYellowHead)"
        />

        {/* Torso chest detail */}
        <rect x="43" y="75" width="14" height="6" rx="3" fill="#27272a" />
        <circle cx="47" cy="78" r="1.2" fill="#fbbf24" />
        <circle cx="53" cy="78" r="1.2" fill="#10b981" />
      </svg>
    </div>
  );
};
