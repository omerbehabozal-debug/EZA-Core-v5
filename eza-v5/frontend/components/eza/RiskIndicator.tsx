'use client';

import { cn } from '@/lib/utils';
import type { EzaRiskLevel } from '@/lib/eza/tokens';
import { ezaRiskColors } from '@/lib/eza/tokens';

export interface RiskIndicatorProps {
  level: EzaRiskLevel | string;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

function normalizeLevel(level: string): EzaRiskLevel {
  const k = level.toLowerCase();
  if (k in ezaRiskColors) return k as EzaRiskLevel;
  return 'unknown';
}

export default function RiskIndicator({
  level,
  label,
  showDot = true,
  size = 'sm',
  className,
}: RiskIndicatorProps) {
  const key = normalizeLevel(level);
  const palette = ezaRiskColors[key];
  const display = label ?? level;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium capitalize',
        size === 'sm' ? 'px-2 py-0.5 text-[10px] sm:text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        borderColor: palette.border,
      }}
    >
      {showDot ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: palette.text }}
          aria-hidden
        />
      ) : null}
      {display}
    </span>
  );
}
