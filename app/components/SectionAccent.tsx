interface SectionAccentProps {
  variant?: "left" | "right" | "center";
}

export default function SectionAccent({ variant = "center" }: SectionAccentProps) {
  const positions = {
    left: "left-0",
    right: "right-0",
    center: "left-1/2 transform -translate-x-1/2",
  };

  return (
    <div className={`absolute top-0 ${positions[variant]} w-96 h-96 opacity-[0.02] pointer-events-none`}>
      <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Abstract geometric pattern */}
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <circle cx="200" cy="200" r="50" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <line x1="200" y1="50" x2="200" y2="350" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <line x1="50" y1="200" x2="350" y2="200" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <line x1="141" y1="141" x2="259" y2="259" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
        <line x1="259" y1="141" x2="141" y2="259" stroke="currentColor" strokeWidth="1" className="text-eza-blue" />
      </svg>
    </div>
  );
}

