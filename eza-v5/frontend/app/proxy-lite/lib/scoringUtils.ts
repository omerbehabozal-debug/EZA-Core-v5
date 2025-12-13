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

// Apple Soft Light Theme Colors
// Backend aralıkları ile uyumlu: 70-100 (low), 40-69 (medium), 0-39 (high)
export const ETHICAL_SCORE_RANGES = {
  LOW_RISK: { min: 70, max: 100, label: 'Düşük Risk', color: '#22BF55', level: 'low' as const },
  MEDIUM_RISK: { min: 40, max: 69, label: 'Orta Risk', color: '#F4A72F', level: 'medium' as const },
  HIGH_RISK: { min: 0, max: 39, label: 'Yüksek Risk', color: '#E84343', level: 'high' as const },
};

/**
 * Get risk label based on ethical score
 * Backend uyumlu aralıklar: 70-100 (Low), 40-69 (Medium), 0-39 (High)
 */
export function getRiskLabel(score: number): string {
  if (score >= 70) return ETHICAL_SCORE_RANGES.LOW_RISK.label;
  if (score >= 40) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.label;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.label;
}

/**
 * Get color based on ethical score
 * Apple Soft Light Theme: #22BF55 (green), #F4A72F (orange), #E84343 (red)
 * Backend uyumlu aralıklar: 70-100 (Low), 40-69 (Medium), 0-39 (High)
 */
export function getEthicalScoreColor(score: number): string {
  if (score >= 70) return ETHICAL_SCORE_RANGES.LOW_RISK.color;
  if (score >= 40) return ETHICAL_SCORE_RANGES.MEDIUM_RISK.color;
  return ETHICAL_SCORE_RANGES.HIGH_RISK.color;
}

/**
 * Get risk level category (backend format)
 * Backend uyumlu aralıklar: 70-100 (low), 40-69 (medium), 0-39 (high)
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

