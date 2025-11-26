"use client";

export default function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Premium layered gradient background - Apple style */}
      <div className="absolute inset-0">
        {/* Primary soft gradient - top center */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 100% at 50% 0%, rgba(0, 113, 227, 0.06) 0%, transparent 70%)',
          }}
        />
        
        {/* Secondary accent - bottom right */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 100% 100%, rgba(0, 119, 237, 0.04) 0%, transparent 60%)',
          }}
        />
        
        {/* Tertiary accent - top left */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 60% at 0% 0%, rgba(0, 113, 227, 0.03) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* Premium animated orbs - subtle and elegant */}
      <div className="absolute inset-0">
        {/* Large primary orb - top center */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full blur-[150px]"
          style={{
            background: 'radial-gradient(circle, rgba(0, 113, 227, 0.08) 0%, transparent 70%)',
            top: '-30%',
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'heroOrbFloat 25s ease-in-out infinite'
          }}
        />
        
        {/* Medium secondary orb - bottom right */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(0, 119, 237, 0.06) 0%, transparent 70%)',
            bottom: '-15%',
            right: '-10%',
            animation: 'heroOrbFloat 30s ease-in-out infinite 8s'
          }}
        />
        
        {/* Small accent orb - top left */}
        <div 
          className="absolute w-[350px] h-[350px] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(0, 113, 227, 0.05) 0%, transparent 70%)',
            top: '15%',
            left: '-8%',
            animation: 'heroOrbFloat 22s ease-in-out infinite 15s'
          }}
        />
      </div>

      {/* Premium bridge visualization - elegant and minimal */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          viewBox="0 0 1200 600" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full max-w-6xl h-full opacity-[0.25]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="premiumBridgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0071e3" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#0071e3" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0.4" />
            </linearGradient>
            <filter id="premiumGlow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Elegant bridge arc - premium stroke */}
          <path
            d="M100 450 Q600 150 1100 450"
            stroke="url(#premiumBridgeGradient)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            filter="url(#premiumGlow)"
            style={{
              strokeDasharray: '2000',
              strokeDashoffset: '2000',
              animation: 'drawLine 12s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          />
          
          {/* Premium connection nodes - refined */}
          <circle 
            cx="200" 
            cy="450" 
            r="3.5" 
            fill="#0071e3" 
            opacity="0.5"
            style={{
              animation: 'premiumPulse 5s ease-in-out infinite'
            }}
          />
          <circle 
            cx="600" 
            cy="250" 
            r="4" 
            fill="#0071e3" 
            opacity="0.6"
            style={{
              animation: 'premiumPulse 5s ease-in-out infinite 1.5s'
            }}
          />
          <circle 
            cx="1000" 
            cy="450" 
            r="3.5" 
            fill="#0071e3" 
            opacity="0.5"
            style={{
              animation: 'premiumPulse 5s ease-in-out infinite 3s'
            }}
          />
        </svg>
      </div>

      {/* Premium depth overlay - sophisticated */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(at 25% 25%, rgba(0, 113, 227, 0.02) 0%, transparent 50%),
            radial-gradient(at 75% 75%, rgba(0, 119, 237, 0.015) 0%, transparent 50%)
          `,
        }}
      />
    </div>
  );
}
