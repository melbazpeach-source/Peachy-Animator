
import React, { useState } from 'react';

interface PeachIconProps {
  className?: string;
}

export const PeachIcon: React.FC<PeachIconProps> = ({ className }) => {
  const [isWinking, setIsWinking] = useState(false);

  const handleMouseEnter = () => {
    setIsWinking(true);
  };
  const handleMouseLeave = () => {
    setIsWinking(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative group transition-transform duration-300 active:scale-90 ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <radialGradient id="peachGradient" cx="0.4" cy="0.4" r="0.8">
            <stop offset="0%" stopColor="#FFDAB9" />
            <stop offset="50%" stopColor="#FFA07A" />
            <stop offset="100%" stopColor="#FF6347" />
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.2" />
          </filter>
        </defs>
        
        {/* Main body */}
        <path 
          d="M 50,15 C 20,15 10,40 10,60 C 10,90 40,100 50,90 C 60,100 90,90 90,60 C 90,40 80,15 50,15 Z"
          fill="url(#peachGradient)"
          stroke="#4A2C2A"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#shadow)"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <path 
          d="M 50,15 C 55,25 55,40 50,90"
          fill="none"
          stroke="#E5533D"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Eyes */}
        <g transform="translate(0, 5)">
          {/* Left Eye */}
          <ellipse cx="35" cy="50" rx="7" ry="9" fill="white" stroke="#4A2C2A" strokeWidth="1.5" />
          <circle cx="37" cy="50" r="4" fill="#2C3E50" />
          <circle cx="35" cy="48" r="1.5" fill="white" opacity="0.8" />
          
          {/* Right Eye (Winking) */}
          {isWinking ? (
            <path d="M 60 54 Q 65 48 70 54" stroke="#4A2C2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx="65" cy="50" rx="7" ry="9" fill="white" stroke="#4A2C2A" strokeWidth="1.5" />
              <circle cx="67" cy="50" r="4" fill="#2C3E50" />
              <circle cx="65" cy="48" r="1.5" fill="white" opacity="0.8" />
            </>
          )}
        </g>
        
        {/* Mouth */}
        <path d="M 40 70 Q 50 80 60 70" fill="none" stroke="#4A2C2A" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Jiggle animation elements (only show on specific animation states if needed) */}
        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <path d="M 8 50 C 12 45, 12 55, 8 60" fill="none" stroke="#FF69B4" strokeWidth="1.5" strokeLinecap="round" />
             <path d="M 92 50 C 88 45, 88 55, 92 60" fill="none" stroke="#FF69B4" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};
