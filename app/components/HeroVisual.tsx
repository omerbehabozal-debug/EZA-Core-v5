export default function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large abstract bridge illustration */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full opacity-[0.04]">
        <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Bridge structure - curved path representing connection */}
          <path
            d="M100 400 Q400 200 700 400"
            stroke="currentColor"
            strokeWidth="3"
            className="text-eza-blue"
            fill="none"
          />
          {/* Support pillars */}
          <line x1="200" y1="400" x2="200" y2="500" stroke="currentColor" strokeWidth="2" className="text-eza-blue" />
          <line x1="400" y1="300" x2="400" y2="500" stroke="currentColor" strokeWidth="2" className="text-eza-blue" />
          <line x1="600" y1="400" x2="600" y2="500" stroke="currentColor" strokeWidth="2" className="text-eza-blue" />
          {/* Connection nodes */}
          <circle cx="200" cy="400" r="8" fill="currentColor" className="text-eza-blue" />
          <circle cx="400" cy="300" r="12" fill="currentColor" className="text-eza-blue" />
          <circle cx="600" cy="400" r="8" fill="currentColor" className="text-eza-blue" />
          {/* Static particles for visual interest */}
          <circle cx="250" cy="380" r="4" fill="currentColor" className="text-eza-blue" opacity="0.4" />
          <circle cx="450" cy="280" r="4" fill="currentColor" className="text-eza-blue" opacity="0.4" />
          <circle cx="550" cy="380" r="4" fill="currentColor" className="text-eza-blue" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
