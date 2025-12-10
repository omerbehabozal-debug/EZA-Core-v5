/**
 * Score Gauge Component - Apple Soft Light Theme
 * Modern circular gauge with ethical scoring colors
 */

'use client';

import { useEffect, useState } from 'react';
import { getEthicalScoreColor, getRiskLabel } from '../lib/scoringUtils';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ScoreGauge({ 
  score, 
  size = 200, 
  strokeWidth = 12,
  className 
}: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = getEthicalScoreColor(score);
  const label = getRiskLabel(score);

  useEffect(() => {
    // Smooth animation with easing
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let startTime: number | null = null;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      current = score * eased;
      
      setAnimatedScore(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setAnimatedScore(score);
      }
    };
    
    requestAnimationFrame(animate);
  }, [score]);

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
            stroke="#E3E3E7"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className="text-5xl font-bold" 
            style={{ 
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontWeight: 700,
              color: color
            }}
          >
            {Math.round(animatedScore)}
          </span>
          <span className="text-sm text-[#6E6E73] mt-1" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Etik Skor</span>
        </div>
      </div>
      {/* Risk label */}
      <p 
        className="mt-4 text-sm font-semibold"
        style={{ 
          color: color,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 500
        }}
      >
        {label}
      </p>
    </div>
  );
}
