/**
 * ScoreBadge Component - Pure Score Display (0-100)
 * Replaces SafetyBadge for Standalone mode
 * Color coding: 100 = green (safe), decreasing score = increasing risk (red)
 * 81-100: Green (safe)
 * 51-80: Yellow (low risk)
 * 21-50: Orange (medium risk)
 * 0-20: Red (high risk)
 */

interface ScoreBadgeProps {
  score: number; // 0-100 (safety score: higher = safer)
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  // Don't show badge if score is undefined or null (0 is a valid score)
  if (score === undefined || score === null) {
    return null;
  }
  
  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine colors based on score range (using inline styles for reliability)
  // Higher score = safer = green, Lower score = riskier = red
  let bgColor: string;
  let textColor: string;
  let borderColor: string;
  
  if (clampedScore >= 81) {
    // Green: 81-100 (safe)
    bgColor = 'rgba(240, 253, 244, 0.8)'; // green-50/80
    textColor = '#15803d'; // green-700
    borderColor = 'rgba(187, 247, 208, 0.5)'; // green-200/50
  } else if (clampedScore >= 51) {
    // Yellow: 51-80 (low risk)
    bgColor = 'rgba(255, 251, 235, 0.8)'; // amber-50/80
    textColor = '#b45309'; // amber-700
    borderColor = 'rgba(254, 243, 199, 0.5)'; // amber-200/50
  } else if (clampedScore >= 21) {
    // Orange: 21-50 (medium risk)
    bgColor = 'rgba(255, 247, 237, 0.8)'; // orange-50/80
    textColor = '#c2410c'; // orange-700
    borderColor = 'rgba(254, 215, 170, 0.5)'; // orange-200/50
  } else {
    // Red: 0-20 (high risk)
    bgColor = 'rgba(254, 242, 242, 0.8)'; // red-50/80
    textColor = '#b91c1c'; // red-700
    borderColor = 'rgba(254, 202, 202, 0.5)'; // red-200/50
  }

  return (
    <span 
      className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 min-h-[24px] sm:min-h-[26px] rounded-full text-[11px] sm:text-xs font-semibold border backdrop-blur-md shadow-sm whitespace-nowrap"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor: borderColor,
      }}
    >
      {clampedScore}
    </span>
  );
}

