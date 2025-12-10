/**
 * Ethical Scoring Utilities
 * Proxy-Lite uses ethical scoring (not risk scoring)
 * 100 = Fully ethical (green)
 * 70-99 = Medium risk (yellow)
 * 0-69 = High risk (red)
 * 
 * Backend risk_level mapping:
 * - 0-39 → "yuksek" (high)
 * - 40-69 → "orta" (medium)
 * - 70-100 → "dusuk" (low)
 */

export const ETHICAL_SCORE_RANGES = {
  LOW_RISK: { min: 70, max: 100, label: 'Düşük Risk', color: '#39FF88', level: 'dusuk' as const },
  MEDIUM_RISK: { min: 40, max: 69, label: 'Orta Risk', color: '#FFC93C', level: 'orta' as const },
  HIGH_RISK: { min: 0, max: 39, label: 'Yüksek Risk', color: '#FF3B3B', level: 'yuksek' as const },
};

/**
 * Get risk label based on ethical score
 */
export function getRiskLabel(score: number): string {
  if (score >= 70) return ETHICAL_SCORE_RANGES.LOW_RISK.label;
  if (score >= 40) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.label;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.label;
}

/**
 * Get color based on ethical score
 */
export function getEthicalScoreColor(score: number): string {
  if (score >= 70) return ETHICAL_SCORE_RANGES.LOW_RISK.color;
  if (score >= 40) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.color;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.color;
}

/**
 * Get risk level category (backend format)
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'low';
  if (score >= 40) return 'medium';
  return 'high';
}

/**
 * Get risk label from backend ethics_level
 */
export function getRiskLabelFromLevel(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return ETHICAL_SCORE_RANGES.LOW_RISK.label;
  if (level === 'medium') return ETHICAL_SCORE_RANGES.MEDIUM_RISK.label;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.label;
}

/**
 * Get color from backend ethics_level
 */
export function getColorFromLevel(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return ETHICAL_SCORE_RANGES.LOW_RISK.color;
  if (level === 'medium') return ETHICAL_SCORE_RANGES.MEDIUM_RISK.color;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.color;
}

// Legacy function for backward compatibility
export function getScoreColor(score: number): string {
  return getEthicalScoreColor(score);
}

// Legacy function for backward compatibility
export function getEthicalScoreLabel(score: number): string {
  return getRiskLabel(score);
}

