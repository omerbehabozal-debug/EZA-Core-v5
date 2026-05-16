/**
 * Governance Etkileşim Raporu — view model (frontend only, no API changes).
 */

import type { TrendChartPoint } from '@/components/eza/TrendChart';
import type {
  SafeModeInsight,
  SafeModeReport,
  SafeModeTrend,
} from '@/lib/types/safemode';
import { trendChartFromEza } from '@/lib/eza/safemodeDisplay';

export const GOVERNANCE_REPORT_DISCLAIMER =
  'EZA analizleri gözlemsel sinyaller üretir. Sonuçlar kesin karar yerine farkındalık sağlamayı amaçlar.';

export type LevelLabel = 'Düşük' | 'Orta' | 'Yüksek' | 'Stabil' | 'Artıyor' | 'Azalıyor';

export interface EvidenceCard {
  title: string;
  value: string;
  description: string;
  meta?: string;
}

export interface ProfileKpi {
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

export interface HistoryRow {
  label: string;
  score: string;
  note: string;
}

export interface GovernanceReportViewModel {
  wowMoment: string;
  periodCaption: string;
  sampleCount: number;
  confidence: number | null;
  reliabilityLabel: string | null;
  evidenceCards: EvidenceCard[];
  kpis: ProfileKpi[];
  ezaTrend: TrendChartPoint[];
  ezaTrendCaption: string;
  showTrendChart: boolean;
  tendencyCards: TendencyCard[];
  historyRows: HistoryRow[];
  disclaimer: string;
  canInterpret: boolean;
  feedbackEventId?: string;
  feedbackAnalysisId?: string;
  feedbackMetric?: string;
}

const MIN_TREND_SAMPLES = 5;
const MIN_WOW_SAMPLES = 5;

function pickVariant(variants: string[], seed: string, n: number): string {
  let h = n * 31;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 7)) | 0;
  }
  const idx = Math.abs(h) % variants.length;
  return variants[idx]!.replace(/\[N\]/g, String(n));
}

function riskLevelLabel(value: number): LevelLabel {
  if (value < 0.33) return 'Düşük';
  if (value < 0.66) return 'Orta';
  return 'Yüksek';
}

function trendLabel(slope: number | null, threshold = 0.08): LevelLabel {
  if (slope === null || Number.isNaN(slope)) return 'Stabil';
  if (slope > threshold) return 'Artıyor';
  if (slope < -threshold) return 'Azalıyor';
  return 'Stabil';
}

function buildWowMoment(input: {
  sampleCount: number;
  avgEza: number | null;
  avgAlign: number | null;
  avgInputRisk: number | null;
  ezaSlope: number | null;
  seed: string;
  insight?: SafeModeInsight | null;
}): string {
  const { sampleCount, avgEza, avgAlign, avgInputRisk, ezaSlope, seed, insight } = input;
  const n = sampleCount;

  if (n < MIN_WOW_SAMPLES) {
    return pickVariant(
      [
        'Seni tanımak için biraz daha etkileşim gerekiyor.',
        'İlk gözlemler için birkaç etkileşim daha yeterli olacak.',
        'Davranışsal özet için henüz erken; kısa süre içinde netleşecek.',
      ],
      seed,
      n
    );
  }

  if (ezaSlope !== null && ezaSlope < -0.12) {
    return pickVariant(
      [
        `Son ${n} etkileşimde uyum skorunda hafif düşüş eğilimi görüldü.`,
        `Son ${n} ölçümde EZA skorunda düşüş eğilimi gözlemlendi.`,
        `Son dönemde skor sinyallerinde hafif gerileme eğilimi seyretti.`,
      ],
      seed,
      n
    );
  }

  if (avgInputRisk !== null && avgInputRisk > 0.45 && ezaSlope !== null && ezaSlope > 0.05) {
    return pickVariant(
      [
        `Son konuşmalarda dikkat çeken risk sinyallerinde artış gözlemlendi.`,
        `Son ${n} etkileşimde risk yoğunluğu sinyali yükselmiş görünüyor.`,
        `Son dönemde girdi risk sinyallerinde artış eğilimi seyretti.`,
      ],
      seed,
      n
    );
  }

  if (avgEza !== null && avgEza >= 80 && (ezaSlope === null || Math.abs(ezaSlope) < 0.1)) {
    return pickVariant(
      [
        `Son ${n} etkileşimde risk sinyalleri düşük seviyede seyretti.`,
        `${n} konuşma boyunca etkileşim dengesi tutarlı göründü.`,
        `Son etkileşimlerde uyum kalitesi yüksek aralıkta kaldı.`,
        `Son ${n} konuşmada belirgin risk sapmaları gözlemlenmedi.`,
      ],
      seed,
      n
    );
  }

  if (avgAlign !== null && avgAlign >= 75) {
    return pickVariant(
      [
        `Son ${n} etkileşimde yanıt uyumu yüksek seyretti.`,
        `Son dönemde uyum sinyalleri güçlü aralıkta kaldı.`,
        `Son ${n} ölçümde uyum kalitesi tutarlı göründü.`,
      ],
      seed,
      n
    );
  }

  if (insight?.generate && insight.insight_text) {
    const t = insight.insight_text.trim();
    if (t.length < 160 && !/manipül|bağımlılık|tehlikeli kullanıcı/i.test(t)) {
      return t;
    }
  }

  return pickVariant(
    [
      `Son ${n} etkileşim boyunca davranış dengesi stabil kaldı.`,
      `Son dönemde etkileşim sinyalleri genel olarak dengeli seyretti.`,
      `Son ${n} ölçümde belirgin sapma sinyali gözlemlenmedi.`,
    ],
    seed,
    n
  );
}

function buildTendencyCards(
  avgEza: number | null,
  avgAlign: number | null,
  avgInputRisk: number | null,
  asymmetry: number | null,
  inputSlope: number | null
): TendencyCard[] {
  const ezaVal = avgEza !== null ? Math.round(avgEza) : 0;
  const alignVal = avgAlign !== null ? Math.round(avgAlign) : 0;
  const riskHealth =
    avgInputRisk !== null ? Math.round((1 - avgInputRisk) * 100) : 0;
  const balanceVal =
    asymmetry !== null ? Math.round((1 - Math.min(1, asymmetry)) * 100) : 70;

  return [
    {
      id: 'balance',
      title: 'AI etkileşim dengesi',
      level: ezaVal >= 75 ? 'Stabil' : ezaVal >= 50 ? 'Orta' : 'Yüksek',
      description:
        ezaVal >= 70
          ? 'Etkileşim dengesi sinyali olumlu aralıkta seyrediyor.'
          : 'Denge sinyalleri karışık; birkaç ölçüm daha netlik sağlayabilir.',
      value: ezaVal || balanceVal,
    },
    {
      id: 'risk',
      title: 'Risk sinyali',
      level: trendLabel(inputSlope, 0.02),
      description:
        trendLabel(inputSlope, 0.02) === 'Azalıyor'
          ? 'Risk yoğunluğu düşüş eğiliminde görünüyor.'
          : trendLabel(inputSlope, 0.02) === 'Artıyor'
            ? 'Risk yoğunluğu artış eğiliminde seyrediyor.'
            : 'Risk sinyali düşük seviyede seyrediyor.',
      value: riskHealth,
    },
    {
      id: 'redirect',
      title: 'Yönlendirme etkisi',
      level: riskLevelLabel(asymmetry ?? 0.2),
      description:
        (asymmetry ?? 0) < 0.25
          ? 'Yönlendirme etkisi sinyali düşük düzeyde kaldı.'
          : 'Bazı ölçümlerde yönlendirme sinyali yükselmiş görünüyor.',
      value: balanceVal,
    },
    {
      id: 'alignment',
      title: 'Uyum kalitesi',
      level: alignVal >= 80 ? 'Yüksek' : alignVal >= 60 ? 'Orta' : 'Düşük',
      description:
        alignVal >= 70
          ? 'Uyum kalitesi yüksek aralıkta seyrediyor.'
          : 'Uyum sinyalleri orta bandda; izlemeye devam edilebilir.',
      value: alignVal,
    },
  ];
}

function coreFromTrend(trend: SafeModeTrend) {
  const avgEza = trend.metrics?.eza_score?.ema?.ema ?? null;
  const ezaSlope = trend.metrics?.eza_score?.trend?.slope ?? null;
  const asymmetry = trend.metrics?.asymmetry_index?.latest ?? null;
  return {
    sampleCount: trend.sample_count ?? 0,
    avgEza: avgEza !== null && !Number.isNaN(avgEza) ? avgEza : null,
    avgAlign: null as number | null,
    avgInputRisk: null as number | null,
    ezaSlope: ezaSlope !== null && !Number.isNaN(ezaSlope) ? ezaSlope : null,
    asymmetry: asymmetry !== null && !Number.isNaN(asymmetry) ? asymmetry : null,
    confidence: trend.confidence ?? null,
    reliabilityLabel: trend.reliability?.label ?? trend.reliability?.level ?? null,
    canInterpret: trend.can_interpret ?? false,
    disclaimer: trend.disclaimer || GOVERNANCE_REPORT_DISCLAIMER,
    seed: `${trend.user_id ?? 'user'}-${trend.sample_count ?? 0}`,
    ezaTrend: trendChartFromEza(trend),
    canTrend: trend.can_trend ?? false,
  };
}

function coreFromReport(report: SafeModeReport) {
  const trend = report.trend_summary;
  const base = coreFromTrend(trend);
  return {
    ...base,
    sampleCount: report.sample_count ?? base.sampleCount,
    avgEza: report.averages.eza_score ?? base.avgEza,
    avgAlign: report.averages.alignment_score ?? null,
    avgInputRisk: report.averages.input_risk ?? null,
    confidence: report.confidence ?? base.confidence,
    reliabilityLabel: report.reliability?.label ?? base.reliabilityLabel,
    canInterpret: report.can_interpret ?? base.canInterpret,
    disclaimer: report.disclaimer || base.disclaimer,
    seed: `${report.user_id}-${report.period}-${report.sample_count}`,
    periodCaption: `${report.period} · ${report.days} gün · ${report.sample_count} etkileşim`,
  };
}

function assembleViewModel(
  core: ReturnType<typeof coreFromTrend> & { periodCaption?: string },
  insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  const fmt = (n: number | null) =>
    n !== null && !Number.isNaN(n) ? (n <= 1 ? (n * 100).toFixed(0) : n.toFixed(1)) : '—';

  const avgEzaDisplay =
    core.avgEza !== null ? (core.avgEza <= 1 ? (core.avgEza * 100).toFixed(1) : core.avgEza.toFixed(1)) : '—';

  const confidenceMeta =
    core.confidence != null ? `Analiz güveni: %${Math.round(core.confidence)}` : undefined;

  const evidenceCards: EvidenceCard[] = [
    {
      title: 'Ortalama EZA skoru',
      value: avgEzaDisplay,
      description:
        core.avgEza !== null && core.avgEza >= (core.avgEza <= 1 ? 0.75 : 75)
          ? 'Son etkileşimlerde güvenli aralıkta seyretti.'
          : 'Skor orta bandda; eğilim izlenmeye devam ediyor.',
      meta: confidenceMeta,
    },
    {
      title: 'Risk sinyali',
      value:
        core.avgInputRisk !== null
          ? `%${Math.round(core.avgInputRisk <= 1 ? core.avgInputRisk * 100 : core.avgInputRisk)} yoğunluk`
          : '—',
      description:
        core.avgInputRisk !== null && core.avgInputRisk < 0.35
          ? 'Risk yoğunluğu düşük seviyede görünüyor.'
          : 'Risk sinyalleri izlenmeye değer bir düzeyde seyrediyor.',
      meta: core.sampleCount ? `${core.sampleCount} etkileşim özeti` : undefined,
    },
    {
      title: 'Etkileşim dengesi',
      value:
        core.avgAlign !== null
          ? fmt(core.avgAlign <= 1 ? core.avgAlign * 100 : core.avgAlign)
          : core.asymmetry !== null
            ? `${Math.round((1 - Math.min(1, core.asymmetry)) * 100)}`
            : '—',
      description:
        core.avgAlign !== null && core.avgAlign >= (core.avgAlign <= 1 ? 0.7 : 70)
          ? 'Girdi ve çıktı sinyalleri dengeli görünüyor.'
          : 'Etkileşim dengesi sinyalleri toplanıyor.',
      meta: core.reliabilityLabel ?? undefined,
    },
  ];

  const kpis: ProfileKpi[] = [
    { label: 'Ortalama EZA Skoru', value: avgEzaDisplay, hint: `${core.sampleCount} ölçüm` },
    {
      label: 'Uyum Kalitesi',
      value: core.avgAlign !== null ? fmt(core.avgAlign <= 1 ? core.avgAlign * 100 : core.avgAlign) : '—',
      hint: core.avgAlign !== null && core.avgAlign >= (core.avgAlign <= 1 ? 0.7 : 70) ? 'Yüksek' : 'Orta',
    },
    {
      label: 'Risk Yoğunluğu',
      value:
        core.avgInputRisk !== null
          ? `${Math.round((1 - (core.avgInputRisk <= 1 ? core.avgInputRisk : core.avgInputRisk / 100)) * 100)}`
          : '—',
      hint:
        core.avgInputRisk !== null && core.avgInputRisk < 0.35
          ? 'Düşük'
          : core.avgInputRisk !== null
            ? 'İzlenmeli'
            : '—',
    },
    {
      label: 'Yönlendirme Etkisi',
      value:
        core.asymmetry !== null
          ? `${Math.round((1 - Math.min(1, core.asymmetry)) * 100)}`
          : '—',
      hint: (core.asymmetry ?? 0) < 0.25 ? 'Düşük' : 'İzlenmeli',
    },
  ];

  const historyRows: HistoryRow[] = core.ezaTrend.map((p, i) => ({
    label: p.label,
    score: String(p.value),
    note: i === core.ezaTrend.length - 1 ? 'Son ölçüm' : 'Ölçüm noktası',
  }));

  return {
    wowMoment: buildWowMoment({
      sampleCount: core.sampleCount,
      avgEza: core.avgEza,
      avgAlign: core.avgAlign,
      avgInputRisk: core.avgInputRisk,
      ezaSlope: core.ezaSlope,
      seed: core.seed,
      insight,
    }),
    periodCaption:
      core.periodCaption ?? `Son ölçümler · ${core.sampleCount} etkileşim`,
    sampleCount: core.sampleCount,
    confidence: core.confidence,
    reliabilityLabel: core.reliabilityLabel,
    evidenceCards,
    kpis,
    ezaTrend: core.ezaTrend,
    ezaTrendCaption: core.canTrend
      ? 'EZA skoru zaman içinde (özet seri)'
      : 'Trend için en az 5 etkileşim gerekir',
    showTrendChart: core.ezaTrend.length >= MIN_TREND_SAMPLES && core.canTrend,
    tendencyCards: buildTendencyCards(
      core.avgEza,
      core.avgAlign,
      core.avgInputRisk,
      core.asymmetry,
      null
    ),
    historyRows,
    disclaimer: core.disclaimer,
    canInterpret: core.canInterpret,
    feedbackEventId: insight?.event_id ?? undefined,
    feedbackAnalysisId: insight?.analysis_id ?? undefined,
    feedbackMetric: insight?.metric,
  };
}

export function buildGovernanceReportFromTrend(
  trend: SafeModeTrend,
  insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  return assembleViewModel(coreFromTrend(trend), insight);
}

export function buildGovernanceReportFromReport(
  report: SafeModeReport,
  insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  const core = coreFromReport(report);
  const vm = assembleViewModel(core, insight);
  vm.feedbackEventId = report.event_id ?? vm.feedbackEventId;
  vm.feedbackAnalysisId = report.analysis_id ?? vm.feedbackAnalysisId;
  return vm;
}
