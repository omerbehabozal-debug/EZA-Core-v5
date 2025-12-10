/**
 * Turkish Risk Label Mapping
 */

export const RISK_LABEL_MAP: Record<string, string> = {
  'harmful': 'Zararlı',
  'manipulation': 'Manipülasyon',
  'hate': 'Nefret',
  'harassment': 'Taciz',
  'sexual': 'Cinsel içerik',
  'violence': 'Tehdit / Şiddet',
  'self-harm': 'Kendine zarar',
  'misinformation': 'Yanlış Bilgi',
  'unsafe-advice': 'Zararlı Tavsiye',
  'illegal': 'Yasadışı yönlendirme',
  'discrimination': 'Ayrımcılık',
  'academic_dishonesty': 'Akademik sahtekarlık',
  'offensive_content': 'Rahatsız edici içerik',
  'hate_speech': 'Nefret Söylemi',
  'health_risk': 'Sağlık Riski',
  'financial_risk': 'Finansal Risk',
};

export const RISK_LEVEL_MAP: Record<string, string> = {
  'low': 'Düşük',
  'medium': 'Orta',
  'high': 'Yüksek',
  'critical': 'Kritik',
};

/**
 * Convert English risk flag to Turkish label
 */
export function getTurkishLabel(flag: string): string {
  return RISK_LABEL_MAP[flag.toLowerCase()] || flag;
}

/**
 * Convert English risk level to Turkish
 */
export function getTurkishRiskLevel(level: string): string {
  const normalized = level.toLowerCase();
  return RISK_LEVEL_MAP[normalized] || level;
}

