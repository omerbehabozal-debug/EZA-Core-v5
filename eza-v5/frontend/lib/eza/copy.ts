/**
 * Trust-safe product copy for governance UI (TR primary).
 */

export const ezaCopy = {
  productName: 'EZA Governance',
  tagline: 'AI observability & calibration',

  nav: {
    overview: 'Genel bakış',
    events: 'Olaylar',
    calibration: 'Kalibrasyon',
    reliability: 'Güvenilirlik',
    me: 'Etkileşimlerim',
    designSystem: 'Design System',
  },

  empty: {
    noData: 'Henüz yeterli veri yok.',
    noEvents: 'Bu dönemde kayıtlı olay bulunamadı.',
    noTrend: 'Trend için daha fazla gözlem gerekli.',
    loading: 'Yükleniyor…',
  },

  metrics: {
    events24h: 'Olaylar (24s)',
    events7d: 'Olaylar (7g)',
    feedback: 'Geri bildirim',
    confidence: 'Ortalama güven',
    reliability: 'Güvenilirlik',
  },

  labels: {
    aiInteraction: 'AI etkileşimi',
    observation: 'Davranışsal gözlem',
    calibration: 'Kalibrasyon',
    governance: 'Yönetişim',
    reliability: 'Güvenilirlik',
  },

  disclaimer: {
    advisory:
      'Öneriler yalnızca admin kalibrasyonu içindir; otomatik politika değişikliği uygulanmaz.',
  },
} as const;
