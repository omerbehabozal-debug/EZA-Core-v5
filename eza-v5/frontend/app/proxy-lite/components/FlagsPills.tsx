/**
 * Flags Pills Component - Apple Soft Light Theme
 * Soft rounded pills for risk flags (14px radius, 12px font, 6px 10px padding)
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
          className="inline-flex items-center rounded-[14px] text-[12px] font-medium"
          style={{
            padding: '6px 10px',
            backgroundColor: '#F8F9FB',
            color: '#3A3A3C',
            border: '1px solid #E3E3E7',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {flag}
        </span>
      ))}
    </div>
  );
}
