/**
 * Circular Risk Score Component
 * Animated circular progress meter for risk score
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CircularRiskScoreProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CircularRiskScore({ 
  score, 
  size = 200, 
  strokeWidth = 12,
  className 
}: CircularRiskScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  
  const getColor = () => {
    if (score >= 80) return '#4CAF50'; // Success green
    if (score >= 50) return '#FFC107'; // Warning amber
    return '#F44336'; // Error red
  };

  useEffect(() => {
    // Animate score from 0 to target
    const duration = 1000; // 1 second
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const getRiskLabel = () => {
    if (score >= 80) return 'Düşük Risk';
    if (score >= 50) return 'Orta Risk';
    return 'Yüksek Risk';
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1A1F2E"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor()}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {Math.round(animatedScore)}
          </span>
          <span className="text-sm text-gray-400 mt-1">/ 100</span>
        </div>
      </div>
      {/* Risk label */}
      <p className="mt-4 text-sm font-medium text-gray-300">
        {getRiskLabel()}
      </p>
    </div>
  );
}

