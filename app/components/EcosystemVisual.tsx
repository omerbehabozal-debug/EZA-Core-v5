export default function EcosystemVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.02]">
      <svg viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Central hub */}
        <circle cx="600" cy="400" r="80" stroke="currentColor" strokeWidth="2" className="text-eza-blue" fill="none" />
        <circle cx="600" cy="400" r="120" stroke="currentColor" strokeWidth="1" className="text-eza-blue" fill="none" opacity="0.5" />
        
        {/* Connecting lines to modules */}
        <line x1="600" y1="400" x2="300" y2="200" stroke="currentColor" strokeWidth="1.5" className="text-eza-blue" opacity="0.3" />
        <line x1="600" y1="400" x2="900" y2="200" stroke="currentColor" strokeWidth="1.5" className="text-eza-blue" opacity="0.3" />
        <line x1="600" y1="400" x2="300" y2="600" stroke="currentColor" strokeWidth="1.5" className="text-eza-blue" opacity="0.3" />
        <line x1="600" y1="400" x2="900" y2="600" stroke="currentColor" strokeWidth="1.5" className="text-eza-blue" opacity="0.3" />
        
        {/* Module nodes */}
        <circle cx="300" cy="200" r="40" stroke="currentColor" strokeWidth="2" className="text-eza-blue" fill="none" />
        <circle cx="900" cy="200" r="40" stroke="currentColor" strokeWidth="2" className="text-eza-blue" fill="none" />
        <circle cx="300" cy="600" r="40" stroke="currentColor" strokeWidth="2" className="text-eza-blue" fill="none" />
        <circle cx="900" cy="600" r="40" stroke="currentColor" strokeWidth="2" className="text-eza-blue" fill="none" />
        
        {/* Static data flow indicators */}
        <circle cx="450" cy="300" r="3" fill="currentColor" className="text-eza-blue" opacity="0.4" />
        <circle cx="750" cy="300" r="3" fill="currentColor" className="text-eza-blue" opacity="0.4" />
      </svg>
    </div>
  );
}
