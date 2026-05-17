/**
 * Client-side aggregation for Standalone behavioral intelligence dashboard.
 * Source: local behavioral history (numeric vectors only).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { TrendChartPoint } from '@/components/eza/TrendChart';
import {
  aggregateFromEntries,
  buildInteractionLayers,
  buildSplitWowMoment,
  type InteractionLayersSnapshot,
} from '@/lib/eza/interactionLayers';

export type LevelLabel = 'Düşük' | 'Orta' | 'Yüksek' | 'Stabil' | 'Artıyor' | 'Azalıyor';

export interface ProfileMetric {
  id: string;
  title: string;
  level: LevelLabel;
  value: number;
  hint?: string;
}

export type ReportGranularity = 'session' | 'multi_day' | 'weekly';

export type IntensityMode = 'hidden' | 'day';

export interface IntensityPoint {
  label: string;
  count: number;
}

export interface DashboardKpi {
  label: string;
  value: string;
  hint?: string;
}

export interface TendencyCard {
  id: string;
  title: string;
  level: LevelLabel;
  description: string;
  value: number;
}

export interface ActivityStats {
  total: number;
  todayCount: number;
  weekCount: number;
  lastInteractionAt: string | null;
  maxEza: number | null;
  minEza: number | null;
}

export interface EvidenceCard {
  title: string;
  value: string;
  description: string;
  meta?: string;
}

export interface BehavioralDashboardModel {
  granularity: ReportGranularity;
  periodLabel: string;
  periodCaption: string;
  sampleCount: number;
  spanDays: number;
  hasEnoughData: boolean;
  wowMoment: string;
  evidenceCards: EvidenceCard[];
  heroNarrative: string;
  summaryTitle: string;
  summaryBullets: string[];
  kpis: DashboardKpi[];
  reliabilityScore: number | null;
  confidencePct: number | null;
  ezaTrend: TrendChartPoint[];
  ezaTrendCaption: string;
  showTrendChart: boolean;
  profile: ProfileMetric[];
  tendencyCards: TendencyCard[];
  featuredInsight: string;
  insights: string[];
  activityStats: ActivityStats;
  intensityMode: IntensityMode;
  intensityTitle: string;
  intensitySubtitle: string;
  intensityByDay: IntensityPoint[];
  intensityPeakLabel: string | null;
  layers: InteractionLayersSnapshot;
}

const DEFAULT_DAYS = 7;
const MIN_INSIGHT_SAMPLES = 3;
const MIN_TREND_SAMPLES = 5;

export const BEHAVIORAL_DISCLAIMER =
  'EZA analizleri gözlemsel sinyaller üretir. Sonuçlar kesin karar yerine farkındalık sağlamayı amaçlar.';

function withinDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function slope(nums: number[]): number {
  if (nums.length < 2) return 0;
  return (nums[nums.length - 1] - nums[0]) / (nums.length - 1);
}

function riskLevelLabel(value: number): LevelLabel {
  if (value < 0.33) return 'Düşük';
  if (value < 0.66) return 'Orta';
  return 'Yüksek';
}

function trendLabel(delta: number, threshold = 0.02): LevelLabel {
  if (delta > threshold) return 'Artıyor';
  if (delta < -threshold) return 'Azalıyor';
  return 'Stabil';
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function distinctCalendarDays(ordered: SavedBehavioralEntry[]): number {
  return new Set(ordered.map((e) => dayKey(e.savedAt))).size;
}

function resolveGranularity(ordered: SavedBehavioralEntry[]): ReportGranularity {
  const days = distinctCalendarDays(ordered);
  if (days <= 1) return 'session';
  if (days < 7) return 'multi_day';
  return 'weekly';
}

function buildSessionEzaTrend(ordered: SavedBehavioralEntry[]): TrendChartPoint[] {
  return ordered
    .slice(-15)
    .map((e, i) => {
      const score = ezaScore(e);
      return score !== null ? { label: `${i + 1}`, value: score } : null;
    })
    .filter((p): p is TrendChartPoint => p !== null);
}

function buildDailyEzaTrend(ordered: SavedBehavioralEntry[]): TrendChartPoint[] {
  const buckets = new Map<string, { sort: number; label: string; scores: number[] }>();
  for (const e of ordered) {
    const score = ezaScore(e);
    if (score === null) continue;
    const d = new Date(e.savedAt);
    const key = dayKey(e.savedAt);
    const existing = buckets.get(key);
    if (existing) {
      existing.scores.push(score);
    } else {
      buckets.set(key, {
        sort: d.getTime(),
        label: formatDayLabel(e.savedAt),
        scores: [score],
      });
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.sort - b.sort)
    .map((b) => ({
      label: b.label,
      value: Math.round(avg(b.scores) * 10) / 10,
    }));
}

function buildDailyIntensity(ordered: SavedBehavioralEntry[], maxDays: number): IntensityPoint[] {
  const buckets = new Map<string, { sort: number; label: string; count: number }>();
  for (const e of ordered) {
    const key = dayKey(e.savedAt);
    const d = new Date(e.savedAt);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { sort: d.getTime(), label: formatDayLabel(e.savedAt), count: 1 });
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.sort - b.sort)
    .slice(-maxDays)
    .map((b) => ({ label: b.label, count: b.count }));
}

function chronological(entries: SavedBehavioralEntry[]): SavedBehavioralEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );
}

function ezaScore(entry: SavedBehavioralEntry): number | null {
  const s = entry.vector.eza_final;
  if (s === null || s === undefined || Number.isNaN(s)) return null;
  return Math.max(0, Math.min(100, s));
}

function isValidEntry(e: SavedBehavioralEntry): boolean {
  const v = e?.vector;
  return (
    Boolean(v) &&
    typeof v.input_risk === 'number' &&
    typeof v.output_risk === 'number' &&
    !Number.isNaN(v.input_risk) &&
    !Number.isNaN(v.output_risk)
  );
}

export function buildBehavioralDashboard(
  entries: SavedBehavioralEntry[],
  days = DEFAULT_DAYS
): BehavioralDashboardModel {
  const safeEntries = entries.filter(isValidEntry);
  const periodEntries = safeEntries.filter((e) => withinDays(e.savedAt, days));
  const ordered = chronological(periodEntries);
  const sampleCount = ordered.length;
  const spanDays = distinctCalendarDays(ordered);
  const granularity = resolveGranularity(ordered);
  const hasEnoughData = sampleCount >= MIN_INSIGHT_SAMPLES;

  const ezaScores = ordered.map(ezaScore).filter((s): s is number => s !== null);
  const inputRisks = ordered.map((e) => e.vector.input_risk);
  const outputRisks = ordered.map((e) => e.vector.output_risk);
  const alignments = ordered
    .map((e) => e.vector.alignment_score)
    .filter((s): s is number => s !== null)
    .map((s) => (s <= 1 ? s * 100 : s));

  const harmfulRedirects = ordered.filter(
    (e) => e.vector.redirect && !e.vector.redirect_benign
  ).length;
  const benignRedirects = ordered.filter((e) => e.vector.redirect_benign).length;
  const redirectRate = sampleCount ? harmfulRedirects / sampleCount : 0;

  const deceptionVals = ordered
    .map((e) => e.vector.deception_score)
    .filter((s): s is number => s !== null);
  const psychVals = ordered
    .map((e) => e.vector.psych_pressure_score)
    .filter((s): s is number => s !== null);
  const manipScore = avg([
    ...deceptionVals,
    ...psychVals,
    ...(deceptionVals.length || psychVals.length ? [] : [0]),
  ]);

  const asymmetryVals = ordered.map((e) => e.asymmetry?.index ?? 0);
  const decisionImpact = avg(asymmetryVals);

  const ezaSlope = slope(ezaScores);
  const inputRiskSlope = slope(inputRisks);
  const avgEza = avg(ezaScores);
  const avgAlign = avg(alignments);
  const avgInputRisk = avg(inputRisks);

  const profile: ProfileMetric[] = [
    {
      id: 'redirect',
      title: 'Yönlendirme sinyali',
      level: riskLevelLabel(redirectRate),
      value: Math.round((1 - redirectRate) * 100),
      hint:
        benignRedirects > 0
          ? `${benignRedirects} güvenli yönlendirme`
          : redirectRate < 0.15
            ? 'Düşük manipülatif yönlendirme'
            : undefined,
    },
    {
      id: 'risk',
      title: 'Risk yoğunluğu',
      level: trendLabel(inputRiskSlope, 0.015),
      value: Math.round((1 - avgInputRisk) * 100),
      hint: `Ort. girdi riski %${Math.round(avgInputRisk * 100)}`,
    },
    {
      id: 'manipulation',
      title: 'Manipülasyon riski',
      level: riskLevelLabel(manipScore),
      value: Math.round((1 - manipScore) * 100),
    },
    {
      id: 'impact',
      title: 'Karar etkisi',
      level: riskLevelLabel(decisionImpact),
      value: Math.round((1 - decisionImpact) * 100),
      hint: 'Girdi–çıktı dengesizliği',
    },
  ];

  const summaryBullets: string[] = [];
  if (redirectRate < 0.2) summaryBullets.push('düşük riskli yönlendirme sinyali');
  if (avgAlign >= 70 || avg(ezaScores) >= 75)
    summaryBullets.push('yüksek yanıt uyumu');
  if (trendLabel(inputRiskSlope, 0.015) === 'Stabil' || trendLabel(inputRiskSlope, 0.015) === 'Azalıyor')
    summaryBullets.push('stabil risk profili');
  if (summaryBullets.length === 0 && sampleCount > 0) {
    summaryBullets.push('etkileşim verisi toplanıyor');
  }
  if (summaryBullets.length === 0) {
    summaryBullets.push('henüz yeterli veri yok');
  }

  const insights: string[] = [];
  if (granularity === 'session') {
    insights.push(
      'Bu özet bugünkü oturumunuza ait. Farklı günlerde sohbet ettikçe haftalık trend ve günlük yoğunluk burada görünür.'
    );
  }
  if (!hasEnoughData) {
    insights.push(
      `${Math.max(1, MIN_INSIGHT_SAMPLES - sampleCount)} etkileşim daha sonra kişisel içgörüler güçlenir.`
    );
  } else if (granularity !== 'session') {
    const half = Math.floor(ordered.length / 2);
    const firstHalf = ordered.slice(0, half);
    const secondHalf = ordered.slice(half);
    const alignFirst = avg(
      firstHalf
        .map((e) => e.vector.alignment_score)
        .filter((s): s is number => s !== null)
        .map((s) => (s <= 1 ? s * 100 : s))
    );
    const alignSecond = avg(
      secondHalf
        .map((e) => e.vector.alignment_score)
        .filter((s): s is number => s !== null)
        .map((s) => (s <= 1 ? s * 100 : s))
    );
    if (alignSecond - alignFirst > 5) {
      insights.push('Son dönemde model yanıtlarıyla uyumunuz artmış görünüyor.');
    }
    if (inputRiskSlope < -0.02) {
      insights.push('Riskli içerik eğiliminiz düşüşte.');
    } else if (inputRiskSlope > 0.02) {
      insights.push('Son etkileşimlerde girdi riski yükselmiş; dikkatli ilerlemek faydalı olabilir.');
    }
    if (ezaSlope > 1.5) {
      insights.push('EZA skorunuz yükseliyor — AI yanıtlarına güven artıyor olabilir.');
    } else if (ezaSlope < -1.5) {
      insights.push('EZA skorunda düşüş var; yanıtları gözden geçirmek isteyebilirsiniz.');
    }
    if (benignRedirects >= 1 && harmfulRedirects === 0) {
      insights.push('Tehlikeli sorularda model güvenli red ve olumlu yönlendirme veriyor.');
    }
    if (avg(outputRisks) < 0.15 && avgInputRisk > 0.4) {
      insights.push('Yüksek riskli sorulara karşı çıktılar genelde güvenli kalıyor.');
    }
    const safeRefusalCount = ordered.filter(
      (e) => e.vector.input_risk >= 0.5 && e.vector.output_risk < 0.3
    ).length;
    if (safeRefusalCount >= 2) {
      insights.push('Doğrulayıcı ve güvenli yanıt arayışınız belirginleşiyor.');
    }
  }

  if (insights.length === 0 && hasEnoughData) {
    insights.push('Etkileşim profiliniz dengeli görünüyor; trend izlemeye devam edin.');
  }

  const heroNarrative = !hasEnoughData
    ? 'Daha anlamlı rapor için birkaç etkileşim daha gerekli.'
    : redirectRate < 0.2 && avgAlign >= 65 && trendLabel(inputRiskSlope, 0.015) !== 'Artıyor'
      ? 'Son etkileşimlerde genel profiliniz stabil görünüyor.'
      : ezaSlope > 1
        ? 'Son dönemde EZA skorunuzda yükseliş eğilimi görülüyor.'
        : ezaSlope < -1
          ? 'Son dönemde skor dalgalanması gözleniyor; yanıtları gözden geçirmek faydalı olabilir.'
          : 'Etkileşim sinyalleriniz toplanıyor; eğilimler zamanla netleşecek.';

  const featuredInsight =
    insights.find((line) => !line.includes('oturumunuza ait') && !line.includes('etkileşim daha')) ??
    insights[0] ??
    heroNarrative;

  const layerInput = aggregateFromEntries(ordered);
  const layers = buildInteractionLayers(layerInput);
  const splitWow = buildSplitWowMoment(layers, `standalone-${sampleCount}`, sampleCount);

  const wowMoment = (() => {
    if (sampleCount === 0) {
      return 'Henüz bir etkileşim analizi yok; sohbete başladığınızda burada ilk gözleminiz belirecek.';
    }
    if (!hasEnoughData) {
      return 'Seni tanımak için biraz daha zaman gerekiyor.';
    }
    if (splitWow) {
      return splitWow;
    }
    if (avgAlign >= 70 && avgInputRisk < 0.45 && redirectRate < 0.2) {
      return 'Son etkileşimlerde AI yanıtlarıyla uyum yüksek; girdi sinyalleri düşük seyretti.';
    }
    if (redirectRate < 0.15) {
      return 'AI ile yazışmalarınızda yönlendirme sinyali düşük seyrediyor.';
    }
    if (
      redirectRate < 0.2 &&
      avgAlign >= 65 &&
      trendLabel(inputRiskSlope, 0.015) !== 'Artıyor'
    ) {
      return 'Son konuşmalarınızda etkileşim dengeniz stabil görünüyor.';
    }
    if (ezaSlope > 1.5) {
      return 'Son dönemde EZA skorunuzda yükseliş eğilimi görülüyor.';
    }
    const personal = insights.find(
      (line) =>
        !line.includes('oturumunuza') &&
        !line.includes('etkileşim daha') &&
        !line.includes('Farklı günlerde')
    );
    return personal ?? featuredInsight;
  })();

  const tendencyDescriptions: Record<string, (level: LevelLabel, m: ProfileMetric) => string> = {
    redirect: (level) =>
      level === 'Düşük'
        ? 'Son etkileşimlerde AI yanıtlarının kararınızı baskılayıcı yönde güçlü bir yönlendirme sinyali üretmediği görülüyor.'
        : 'Bazı yanıtlarda yönlendirme sinyali yükselmiş; içerikleri gözden geçirmek faydalı olabilir.',
    risk: (level) =>
      level === 'Stabil' || level === 'Azalıyor'
        ? 'Risk yoğunluğu stabil veya düşüş eğiliminde seyrediyor.'
        : level === 'Artıyor'
          ? 'Girdi risk sinyallerinde artış eğilimi görülüyor.'
          : 'Risk yoğunluğu orta düzeyde; dikkatli ilerlemek faydalı olabilir.',
    manipulation: (level) =>
      level === 'Düşük'
        ? 'Manipülasyon veya baskı sinyalleri düşük düzeyde kalıyor.'
        : 'Bazı etkileşimlerde manipülasyon sinyali tespit edildi; gözlem önerilir.',
    impact: (level) =>
      level === 'Düşük'
        ? 'Girdi ile çıktı arasında belirgin bir dengesizlik sinyali görülmüyor.'
        : 'Karar etkisi sinyali yükselmiş; etkileşim dengenizi izlemek faydalı olabilir.',
  };

  const redirectMetric = profile.find((m) => m.id === 'redirect')!;
  const riskMetric = profile.find((m) => m.id === 'risk')!;

  const tendencyCards: TendencyCard[] = layers.layers.map((layer) => ({
    id: layer.id,
    title: layer.title,
    level: layer.level,
    description: layer.description,
    value:
      layer.id === 'user'
        ? Math.round((1 - layers.avgInputRisk) * 100)
        : layer.id === 'assistant'
          ? Math.round((1 - layers.avgOutputRisk) * 100)
          : Math.round(layers.avgAlign),
  }));

  const reliabilityScore =
    ezaScores.length > 0 ? Math.round(avg(ezaScores) * 10) / 10 : null;
  const confidencePct =
    sampleCount >= 10 ? 85 : sampleCount >= 5 ? 70 : sampleCount >= 3 ? 55 : sampleCount > 0 ? 40 : null;
  const confidenceMeta =
    confidencePct !== null ? `Analiz güveni: %${confidencePct}` : undefined;

  const fmt = (n: number | null) => (n !== null && !Number.isNaN(n) ? n.toFixed(1) : '—');

  const evidenceCards: EvidenceCard[] = layers.layers.map((layer) => ({
    title: layer.title,
    value: layer.kpis[0]?.value ?? '—',
    description: layer.headline,
    meta: layer.kpis[1]?.hint,
  }));

  const kpis: DashboardKpi[] = layers.layers.flatMap((layer) =>
    layer.kpis.map((k) => ({
      label: `${layer.title} · ${k.label}`,
      value: k.value,
      hint: k.hint,
    }))
  );

  const todayKey = dayKey(new Date().toISOString());
  const todayCount = ordered.filter((e) => dayKey(e.savedAt) === todayKey).length;
  const lastInteractionAt =
    ordered.length > 0 ? ordered[ordered.length - 1].savedAt : null;

  const activityStats: ActivityStats = {
    total: sampleCount,
    todayCount,
    weekCount: sampleCount,
    lastInteractionAt,
    maxEza: ezaScores.length ? Math.max(...ezaScores) : null,
    minEza: ezaScores.length ? Math.min(...ezaScores) : null,
  };

  const showTrendChart = ezaScores.length >= MIN_TREND_SAMPLES;

  let intensityMode: IntensityMode = 'hidden';
  let intensityTitle = 'Etkileşim yoğunluğu';
  let intensitySubtitle = '';
  let intensityByDay: IntensityPoint[] = [];
  let intensityPeakLabel: string | null = null;

  if (granularity === 'session') {
    intensityMode = 'hidden';
    intensitySubtitle = 'Günlük dağılım, birden fazla gün verisi birikince açılır.';
  } else {
    intensityMode = 'day';
    intensityByDay = buildDailyIntensity(ordered, granularity === 'weekly' ? 7 : spanDays);
    intensityTitle = granularity === 'weekly' ? 'Haftalık yoğunluk' : 'Günlük yoğunluk';
    intensitySubtitle =
      granularity === 'weekly'
        ? 'Son 7 günde gün bazında etkileşim sayısı'
        : `Son ${spanDays} günde gün bazında etkileşim sayısı`;
    if (intensityByDay.length > 0) {
      const peak = intensityByDay.reduce((best, b) => (b.count > best.count ? b : best), intensityByDay[0]);
      intensityPeakLabel = `En aktif gün: ${peak.label} (${peak.count} etkileşim)`;
    }
  }

  const ezaTrend =
    granularity === 'session' ? buildSessionEzaTrend(ordered) : buildDailyEzaTrend(ordered);
  const ezaTrendCaption =
    granularity === 'session'
      ? 'Bugünkü oturum — etkileşim sırasına göre AI yanıt skoru'
      : granularity === 'weekly'
        ? 'Günlük ortalama AI yanıt skoru (son 7 gün)'
        : 'Günlük ortalama AI yanıt skoru';

  const periodLabel =
    granularity === 'session'
      ? 'Bugün'
      : granularity === 'weekly'
        ? 'Son 7 gün'
        : `Son ${spanDays} gün`;

  const periodCaption =
    granularity === 'session'
      ? `${sampleCount} etkileşim · oturum özeti`
      : `${sampleCount} etkileşim · ${spanDays} farklı gün`;

  return {
    granularity,
    periodLabel,
    periodCaption,
    sampleCount,
    spanDays,
    hasEnoughData,
    wowMoment,
    evidenceCards,
    heroNarrative,
    summaryTitle: 'AI Etkileşim Dengesi',
    summaryBullets,
    kpis,
    reliabilityScore,
    confidencePct,
    ezaTrend,
    ezaTrendCaption,
    showTrendChart,
    profile,
    tendencyCards,
    featuredInsight,
    insights,
    activityStats,
    intensityMode,
    intensityTitle,
    intensitySubtitle,
    intensityByDay,
    intensityPeakLabel,
    layers,
  };
}
