/**
 * Ethical Scoring Utilities
 * Proxy-Lite uses ethical scoring (not risk scoring)
 * 100 = Fully ethical (green)
 * 70-90 = Medium risk (yellow)
 * 0-70 = High risk (red)
 */

export const ETHICAL_SCORE_RANGES = {
  LOW_RISK: { min: 90, max: 100, label: 'Düşük Risk', color: '#39FF88' },
  MEDIUM_RISK: { min: 70, max: 89, label: 'Orta Risk', color: '#FFC93C' },
  HIGH_RISK: { min: 0, max: 69, label: 'Yüksek Risk', color: '#FF3B3B' },
};

/**
 * Get risk label based on ethical score
 */
export function getRiskLabel(score: number): string {
  if (score >= 90) return ETHICAL_SCORE_RANGES.LOW_RISK.label;
  if (score >= 70) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.label;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.label;
}

/**
 * Get color based on ethical score
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return ETHICAL_SCORE_RANGES.LOW_RISK.color;
  if (score >= 70) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.color;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.color;
}

/**
 * Get risk level category
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 90) return 'low';
  if (score >= 70) return 'medium';
  return 'high';
}

