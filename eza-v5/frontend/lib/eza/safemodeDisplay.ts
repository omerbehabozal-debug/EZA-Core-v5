import type { ReliabilityInfo, SafeModeInsight, SafeModeTrend } from '@/lib/types/safemode';
import type { ReliabilityBand } from '@/components/eza/ReliabilityPill';
import type { TrendChartPoint } from '@/components/eza/TrendChart';

export const SAFEMODE_DISCLAIMER =
  'Bu panel otomatik karar üretmez; yalnızca davranışsal gözlem ve kalibrasyon sinyali sunar.';

export function reliabilityBand(level?: string): ReliabilityBand {
  const l = (level || '').toUpperCase();
  if (l.includes('YÜKSEK') || l.includes('YUKSEK')) return 'high';
  if (l.includes('ORTA')) return 'medium';
  if (l.includes('DÜŞÜK') || l.includes('DUSUK')) return 'low';
  return 'unknown';
}

export function reliabilityScore(info?: ReliabilityInfo): number | undefined {
  if (info?.quality != null && !Number.isNaN(info.quality)) {
    return Math.round(info.quality * 100);
  }
  return undefined;
}

export function trendChartFromEza(trend?: SafeModeTrend | null): TrendChartPoint[] {
  const series = trend?.metrics?.eza_score?.ema?.ema_series;
  if (!series?.length) return [];
  return series.map((value, i) => ({
    label: `T${i + 1}`,
    value: Math.round(value * 10) / 10,
  }));
}

export function averageEzaScore(trend?: SafeModeTrend | null): string {
  const ema = trend?.metrics?.eza_score?.ema?.ema;
  if (ema != null && !Number.isNaN(ema)) return ema.toFixed(1);
  return '—';
}

export function insightBody(insight?: SafeModeInsight | null): string {
  if (!insight) return 'Henüz yeterli veri yok.';
  if (insight.generate && insight.insight_text) return insight.insight_text;
  if (insight.reason === 'insufficient_data') {
    return 'En az 20 etkileşim sonrası davranışsal gözlem oluşur.';
  }
  if (insight.reason === 'no_anomaly') {
    return 'Son dönemde belirgin bir kalibrasyon sinyali tespit edilmedi.';
  }
  return 'Davranışsal gözlem hazırlanıyor.';
}

export function pickFeedbackRefs(
  ...sources: Array<{ event_id?: string | null; analysis_id?: string | null } | null | undefined>
): { eventId?: string; analysisId?: string } {
  for (const s of sources) {
    if (!s) continue;
    if (s.event_id) return { eventId: s.event_id, analysisId: s.analysis_id ?? undefined };
    if (s.analysis_id) return { analysisId: s.analysis_id };
  }
  return {};
}

export function trendInterpretation(trend?: SafeModeTrend | null): string {
  const t = trend?.metrics?.eza_score?.trend;
  if (!t?.ok) return 'Trend için en az 5 etkileşim gerekir.';
  return t.interpretation ?? 'Stabil gözlem';
}
