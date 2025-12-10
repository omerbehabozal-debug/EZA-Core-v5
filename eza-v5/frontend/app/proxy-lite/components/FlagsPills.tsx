/**
 * Flags Pills Component
 * Small rounded tags for risk flags
 */

'use client';

interface FlagsPillsProps {
  flags: string[];
  className?: string;
}

export default function FlagsPills({ flags, className }: FlagsPillsProps) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {flags.map((flag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F44336]/20 text-[#F44336] border border-[#F44336]/30"
        >
          {flag}
        </span>
      ))}
    </div>
  );
}

