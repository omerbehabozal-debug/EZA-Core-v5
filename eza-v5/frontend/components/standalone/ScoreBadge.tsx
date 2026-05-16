/**
 * ScoreBadge — 0–100 safety score using EZA risk palette
 */

import { scoreBadgeStyles } from '@/lib/eza/standaloneSkin';

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === undefined || score === null) {
    return null;
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const styles = scoreBadgeStyles(clampedScore);

  return (
    <span
      className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 min-h-[24px] sm:min-h-[26px] rounded-full text-[11px] sm:text-xs font-semibold border backdrop-blur-md shadow-eza-sm whitespace-nowrap"
      style={styles}
    >
      {clampedScore}
    </span>
  );
}
