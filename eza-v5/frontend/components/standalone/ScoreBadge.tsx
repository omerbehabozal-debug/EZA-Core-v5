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
          ? 'min-h-[22px] px-2 py-0.5 rounded-md text-xs leading-none shadow-sm'
          : 'min-h-[28px] min-w-[28px] px-2.5 py-0.5 rounded-lg text-sm shadow-eza-sm'
      )}
      style={styles}
    >
      {clampedScore}
    </span>
  );
}
