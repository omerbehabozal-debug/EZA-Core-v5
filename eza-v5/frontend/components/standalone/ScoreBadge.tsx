/**
 * ScoreBadge — integrated corner chip
 */

import { cn } from '@/lib/utils';
import { scoreBadgeStyles } from '@/lib/eza/standaloneSkin';

interface ScoreBadgeProps {
  score: number;
  size?: 'chip' | 'md';
}

export default function ScoreBadge({ score, size = 'chip' }: ScoreBadgeProps) {
  if (score === undefined || score === null) {
    return null;
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const styles = scoreBadgeStyles(clampedScore);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border font-semibold tabular-nums backdrop-blur-sm',
        size === 'chip'
          ? 'min-h-[20px] px-1.5 py-0.5 rounded-md text-[10px] leading-none shadow-sm'
          : 'min-h-[26px] min-w-[26px] px-2 py-0.5 rounded-lg text-xs shadow-eza-sm'
      )}
      style={styles}
    >
      {clampedScore}
    </span>
  );
}
