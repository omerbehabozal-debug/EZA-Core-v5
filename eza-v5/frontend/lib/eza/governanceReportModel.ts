/**
 * Governance Etkileşim Raporu — view model (frontend only, no API changes).
 */

import type { TrendChartPoint } from '@/components/eza/TrendChart';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { BehavioralDashboardModel } from '@/lib/eza/behavioralDashboard';
import { buildInteractionInsight } from '@/lib/eza/behavioralInsights';
import type {
  SafeModeInsight,
  SafeModeReport,
  SafeModeTrend,
} from '@/lib/types/safemode';
import { trendChartFromEza } from '@/lib/eza/safemodeDisplay';
import {
  buildDailyObservationFromAggregates,
  buildDailyObservationFromEntries,
  type DailyObservationView,
} from '@/lib/eza/dailyObservation';
import {
  aggregateFromAverages,
  aggregateFromEntries,
  buildInteractionLayers,
  type InteractionLayersSnapshot,
} from '@/lib/eza/interactionLayers';

const LOW_INPUT_HEALTH = 0.55;
const LOW_INPUT_RISK = 0.4;
const LOW_EZA_SCORE = 60;

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Düşük girdi sağlık sinyali veya zayıf etkileşim skoru */
export function entryHasLowSignal(entry: SavedBehavioralEntry): boolean {
  const v = entry.vector;
  if (!v) return false;

  const inputHealth = v.input_health ?? 1 - (v.input_risk ?? 0);
  if (inputHealth < LOW_INPUT_HEALTH || (v.input_risk ?? 0) >= LOW_INPUT_RISK) {
    return true;
  }

  const eza = v.eza_final;
  if (eza !== null && !Number.isNaN(eza)) {
    const score = eza <= 1 ? eza * 100 : eza;
    if (score < LOW_EZA_SCORE) return true;
  }

  if ((v.output_risk ?? 0) >= 0.4) return true;

  const align = v.alignment_score;
  if (align !== null && !Number.isNaN(align)) {
    const n = align <= 1 ? align * 100 : align;
    if (n < 55) return true;
  }

  return false;
}

export const GOVERNANCE_REPORT_DISCLAIMER =
  'EZA analizleri gözlemsel sinyaller üretir. Sonuçlar kesin karar yerine farkındalık sağlamayı amaçlar.';

export const GOVERNANCE_SIGNAL_NOTE =
  'EZA mesaj içeriklerini değil, etkileşim sinyallerini analiz eder.';

export const GOVERNANCE_HOW_SIGNAL_FOOTNOTE =
  'Analizler mesaj içeriğini değil, etkileşim sinyallerini değerlendirir.';

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
  tags?: string[];
}

export interface FeaturedInteractionView {
  show: boolean;
  userSignal: string;
  aiBehavior: string;
  balance: string;
  footnote: string;
}

export interface HowCalculatedView {
  cards: EvidenceCard[];
  confidenceLabel: string | null;
  reliabilityLabel: string | null;
  signalFootnote: string;
}

export interface GovernanceReportViewModel {
  wowMoment: string;
  dailyObservation: DailyObservationView;
  periodCaption: string;
  sampleCount: number;
  featuredInteraction: FeaturedInteractionView;
  howCalculated: HowCalculatedView;
  profileKpis: ProfileKpi[];
  ezaTrend: TrendChartPoint[];
  ezaTrendCaption: string;
  trendInsight: string;
  trendCredibilityNote: string;
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

function pickVariant(variants: string[], seed: string, salt = 0): string {
  let h = salt * 31;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 7)) | 0;
  }
  const idx = Math.abs(h) % variants.length;
  return variants[idx]!;
}

function trendDirectionLabel(slope: number | null): 'up' | 'down' | 'stable' {
  if (slope === null || Number.isNaN(slope)) return 'stable';
  if (slope > 0.08) return 'up';
  if (slope < -0.08) return 'down';
  return 'stable';
}

function trendLevelLabel(slope: number | null): LevelLabel {
  const d = trendDirectionLabel(slope);
  if (d === 'up') return 'Artıyor';
  if (d === 'down') return 'Azalıyor';
  return 'Stabil';
}

function confidenceBand(confidence: number | null): string | null {
  if (confidence === null || Number.isNaN(confidence)) return null;
  if (confidence >= 70) return 'yüksek';
  if (confidence >= 45) return 'orta';
  return 'düşük';
}

function qualitativeEza(avg: number | null): { value: string; hint: string } {
  if (avg === null || Number.isNaN(avg)) return { value: '—', hint: 'Henüz yeterli ölçüm yok' };
  const n = avg <= 1 ? avg * 100 : avg;
  if (n >= 80) return { value: 'Güçlü', hint: 'Güvenli aralıkta seyretti' };
  if (n >= 60) return { value: 'Orta', hint: 'Denge izlenmeye devam ediyor' };
  return { value: 'Dikkat', hint: 'Birkaç ölçüm daha netlik sağlayabilir' };
}

function qualitativeAlign(avg: number | null): { value: string; hint: string } {
  if (avg === null || Number.isNaN(avg)) return { value: '—', hint: 'Uyum sinyali toplanıyor' };
  const n = avg <= 1 ? avg * 100 : avg;
  if (n >= 75) return { value: 'Yüksek', hint: 'Uyum kalitesi stabil kaldı' };
  if (n >= 55) return { value: 'Orta', hint: 'Uyum sinyalleri karışık görünebilir' };
  return { value: 'Düşük', hint: 'Uyum için izlemeye devam edilebilir' };
}

function qualitativeSensitiveSignal(
  inputRisk: number | null,
  slope: number | null
): { value: string; hint: string } {
  if (inputRisk === null || Number.isNaN(inputRisk)) {
    return { value: '—', hint: 'Etkileşim sinyali henüz net değil' };
  }
  const dir = trendDirectionLabel(slope);
  if (inputRisk < 0.3) {
    return {
      value: 'Sakin',
      hint: pickVariant(
        ['Hassas sinyal yoğunluğu düşük kaldı.', 'Girdi sinyalleri sakin seyretti.'],
        `sig-low-${inputRisk}`,
        0
      ),
    };
  }
  if (inputRisk < 0.5) {
    return {
      value: 'Orta',
      hint:
        dir === 'up'
          ? 'Hassas sinyal yoğunluğu daha sık görünmeye başladı.'
          : 'Hassas sinyal yoğunluğu orta düzeyde seyretti.',
    };
  }
  return {
    value: 'Yükselen',
    hint: pickVariant(
      [
        'Hassas sinyal yoğunluğu daha sık görünmeye başladı.',
        'Girdi tarafında dikkat çeken sinyaller gözlemlendi.',
      ],
      `risk-hi-${inputRisk}`,
      1
    ),
  };
}

function qualitativeRedirect(asymmetry: number | null): { value: string; hint: string } {
  const a = asymmetry ?? 0.2;
  if (a < 0.25) {
    return {
      value: 'Düşük',
      hint: 'Yönlendirme etkisi sinyali düşük kaldı.',
    };
  }
  if (a < 0.45) {
    return {
      value: 'Orta',
      hint: 'Bazı ölçümlerde yönlendirme sinyali göründü.',
    };
  }
  return {
    value: 'Belirgin',
    hint: 'Yönlendirme etkisi daha sık gözlemlendi.',
  };
}

function buildShortWowMoment(input: {
  sampleCount: number;
  avgEza: number | null;
  avgAlign: number | null;
  avgInputRisk: number | null;
  avgOutputRisk: number | null;
  ezaSlope: number | null;
  seed: string;
  layers: InteractionLayersSnapshot;
}): string {
  const { sampleCount: n, avgEza, avgAlign, avgInputRisk, avgOutputRisk, ezaSlope, seed, layers } =
    input;

  if (n < MIN_WOW_SAMPLES) {
    return pickVariant(
      [
        'Seni tanımak için biraz daha etkileşim gerekiyor.',
        'Biraz daha konuşunca gözlem netleşecek.',
      ],
      `${seed}-early`,
      n
    );
  }

  const dir = trendDirectionLabel(ezaSlope);
  const split = layers.hasInputOutputSplit || (avgInputRisk !== null && avgInputRisk >= 0.45 && (avgOutputRisk ?? 1) < 0.3);

  if (split) {
    return pickVariant(
      [
        'AI yanıtları hassas sinyallere rağmen dengeyi korudu.',
        'Girdi sinyali varken yanıtlar güvenli kaldı.',
        'Hassas girişe rağmen denge korundu.',
      ],
      `${seed}-split-${dir}`,
      n
    );
  }

  if (dir === 'down') {
    return pickVariant(
      ['Uyum dengesinde hafif değişim gözlemlendi.', 'Denge değişimi gözlemlendi.'],
      `${seed}-down`,
      n
    );
  }

  if (avgInputRisk !== null && avgInputRisk > 0.45 && dir === 'up') {
    return pickVariant(
      [
        'Hassas sinyal yoğunluğu arttı.',
        'Son konuşmalarda hassas sinyal daha sık göründü.',
      ],
      `${seed}-risk-up`,
      n
    );
  }

  const ezaNorm = avgEza !== null ? (avgEza <= 1 ? avgEza * 100 : avgEza) : 0;
  if (ezaNorm >= 75 && dir === 'stable') {
    return pickVariant(
      [
        'Denge stabil görünüyor.',
        'Hassas sinyaller sakin seyretti.',
        'Son konuşmalarda uyum dengesi korundu.',
        'Belirgin sapma gözlemlenmedi.',
      ],
      `${seed}-stable-${dir}`,
      n
    );
  }

  if (avgAlign !== null && (avgAlign <= 1 ? avgAlign * 100 : avgAlign) >= 75) {
    return pickVariant(
      ['Uyum kalitesi stabil kaldı.', 'Uyum dengesi korundu.'],
      `${seed}-align`,
      n
    );
  }

  if ((avgOutputRisk ?? 1) < 0.3) {
    return pickVariant(
      [
        'AI yanıtları yönlendirme baskısı oluşturmadı.',
        'AI yanıt davranışı dengeli seyretti.',
      ],
      `${seed}-ai-calm`,
      n
    );
  }

  return pickVariant(
    [
      'Denge stabil görünüyor.',
      'Etkileşim dengesi sakin seyretti.',
      'Genel denge değişmedi.',
    ],
    `${seed}-default-${dir}`,
    n
  );
}

function buildFeaturedInteractionForDay(
  dayEntries: SavedBehavioralEntry[],
  seed: string
): FeaturedInteractionView {
  if (dayEntries.length === 0) {
    return {
      show: false,
      userSignal: '',
      aiBehavior: '',
      balance: '',
      footnote: '',
    };
  }

  const layers = buildInteractionLayers(aggregateFromEntries(dayEntries));
  const anyLowSignal = dayEntries.some(entryHasLowSignal);

  if (!anyLowSignal) {
    return featuredFromRecentLayers(layers, seed, dayEntries.length);
  }

  const last = dayEntries[dayEntries.length - 1]!;
  const lastIr = last.vector?.input_risk ?? 0;
  const lastOr = last.vector?.output_risk ?? 0;
  const split = lastIr >= 0.5 && lastOr < 0.3;
  const lowCount = dayEntries.filter(entryHasLowSignal).length;

  const userSignal = pickVariant(
    [
      'Bugün riskli davranış sinyali gözlemlendi.',
      lowCount > 1
        ? 'Gün içinde birden fazla etkileşimde düşük sinyal ve riskli davranış gözlemlendi.'
        : 'Gün içinde en az bir etkileşimde düşük sinyal ve riskli davranış gözlemlendi.',
    ],
    `${seed}-feat-risk-day`
  );

  const aiBehavior = split
    ? pickVariant(
        [
          'Buna rağmen son yanıtlar güvenli sınırlar içinde kaldı.',
          'AI yanıtları riskli girişlere rağmen güvenli sınırlarda kaldı.',
        ],
        `${seed}-feat-risk-ai`
      )
    : layers.avgOutputRisk < 0.3
      ? 'AI yanıtları gün boyunca çoğunlukla güvenli sınırlar içinde kaldı.'
      : 'Yanıt davranışı gün içinde karışık sinyaller verdi.';

  const balance = split
    ? pickVariant(
        [
          'Hassas sinyallere rağmen etkileşim dengesi korundu.',
          'Riskli davranış sinyaline rağmen genel denge korunmuş görünüyor.',
        ],
        `${seed}-feat-risk-bal`
      )
    : layers.avgAlign >= 65
      ? 'Etkileşim dengesi büyük ölçüde stabil kaldı.'
      : 'Etkileşim dengesi izlenmeye değer sinyaller taşıdı.';

  return {
    show: true,
    userSignal,
    aiBehavior,
    balance,
    footnote:
      'Bu gözlem son etkileşim oturumuna dayanır; oturumda en az bir düşük sinyal gözlemlendi.',
  };
}

function featuredFromRecentLayers(
  layers: InteractionLayersSnapshot,
  seed: string,
  sampleCount: number
): FeaturedInteractionView {
  const rt = layers.recentTurn;
  if (rt.show && sampleCount > 0) {
    const userLayer = layers.layers.find((l) => l.id === 'user');
    const aiLayer = layers.layers.find((l) => l.id === 'assistant');
    const balanceLayer = layers.layers.find((l) => l.id === 'balance');
    return {
      show: true,
      userSignal: userLayer?.headline ?? rt.summary,
      aiBehavior: aiLayer?.headline ?? 'Yanıt güvenli sınırlar içinde kaldı.',
      balance: balanceLayer?.headline ?? 'Etkileşim dengesi korundu.',
      footnote: 'Bu gözlem yalnızca öne çıkan son etkileşim sinyaline aittir.',
    };
  }
  return buildFeaturedInteraction(layers, seed, sampleCount);
}

function buildFeaturedInteraction(
  layers: InteractionLayersSnapshot,
  seed: string,
  sampleCount: number
): FeaturedInteractionView {
  if (sampleCount < 1) {
    return {
      show: false,
      userSignal: '',
      aiBehavior: '',
      balance: '',
      footnote: '',
    };
  }

  const split = layers.hasInputOutputSplit;
  const highInput = layers.avgInputRisk >= 0.45;
  const safeAi = layers.avgOutputRisk < 0.3;
  const riskyDay =
    layers.riskyInputCount > 0 ||
    layers.avgInputRisk >= LOW_INPUT_RISK ||
    1 - layers.avgInputRisk < LOW_INPUT_HEALTH;

  const userSignal = riskyDay
    ? pickVariant(
        [
          'Riskli davranış sinyali gözlemlendi.',
          'Düşük sinyal içeren riskli davranış gözlemlendi.',
          'Girdi tarafında riskli davranış sinyali belirginleşti.',
        ],
        `${seed}-feat-risk-user`,
        0
      )
    : split || highInput
      ? pickVariant(
          [
            'Hassas konu sinyali gözlemlendi.',
            'Girdi tarafında dikkat çeken sinyal göründü.',
            'Hassas sinyal yoğunluğu gözlemlendi.',
          ],
          `${seed}-feat-user`,
          0
        )
      : layers.avgInputRisk >= 0.3
        ? 'Girdi sinyalleri orta düzeyde seyretti.'
        : 'Girdi sinyalleri sakin göründü.';

  const aiBehavior =
    split || safeAi
      ? pickVariant(
          [
            'Yanıt güvenli sınırlar içinde kaldı.',
            'AI yanıtları dengeyi korudu.',
            'Yanıt davranışı güvenli sınırlarda kaldı.',
          ],
          `${seed}-feat-ai`,
          1
        )
      : 'Yanıt davranışı izlenmeye değer sinyaller verdi.';

  const balance =
    split || (highInput && safeAi)
      ? pickVariant(
          [
            'Denge korunmaya devam etti.',
            'Hassas girişe rağmen etkileşim dengesi korundu.',
            'AI yanıtları hassas sinyallere rağmen dengeyi korudu.',
          ],
          `${seed}-feat-balance`,
          2
        )
      : layers.avgAlign >= 70
        ? 'Etkileşim dengesi stabil göründü.'
        : 'Denge sinyalleri karışık görünebilir.';

  return {
    show: true,
    userSignal,
    aiBehavior,
    balance,
    footnote: 'Bu gözlem yalnızca öne çıkan son etkileşim sinyaline aittir.',
  };
}

function buildHowCalculatedCards(
  core: {
    avgEza: number | null;
    avgInputRisk: number | null;
    avgAlign: number | null;
    asymmetry: number | null;
    reliabilityLabel: string | null;
    confidence: number | null;
  }
): EvidenceCard[] {
  const ezaQ = qualitativeEza(core.avgEza);
  const signalQ = qualitativeSensitiveSignal(core.avgInputRisk, null);
  const alignQ = qualitativeAlign(core.avgAlign);
  const balanceQ =
    core.asymmetry !== null && core.asymmetry < 0.3
      ? { value: 'Stabil', desc: 'Girdi ve yanıt sinyalleri dengeli görünüyor.' }
      : { value: 'Karışık', desc: 'Etkileşim dengesi sinyalleri izlenmeye değer.' };

  const conf = confidenceBand(core.confidence);

  return [
    {
      title: 'Ortalama EZA skoru',
      value: ezaQ.value,
      description: 'Son etkileşimlerde güvenli aralıkta seyretti.',
      meta: conf ? `Analiz güveni: ${conf}` : core.reliabilityLabel ?? undefined,
    },
    {
      title: 'Hassas sinyal eğilimi',
      value: signalQ.value,
      description: signalQ.hint,
    },
    {
      title: 'Etkileşim dengesi',
      value: alignQ.value !== '—' ? alignQ.value : balanceQ.value,
      description: alignQ.value !== '—' ? alignQ.hint : balanceQ.desc,
      meta: core.reliabilityLabel ?? undefined,
    },
  ];
}

function buildProfileKpis(core: {
  avgEza: number | null;
  avgAlign: number | null;
  avgInputRisk: number | null;
  asymmetry: number | null;
  ezaSlope: number | null;
}): ProfileKpi[] {
  const ezaQ = qualitativeEza(core.avgEza);
  const alignQ = qualitativeAlign(core.avgAlign);
  const signalQ = qualitativeSensitiveSignal(core.avgInputRisk, core.ezaSlope);
  const redirectQ = qualitativeRedirect(core.asymmetry);

  return [
    { label: 'Ortalama EZA Skoru', value: ezaQ.value, hint: ezaQ.hint },
    { label: 'Uyum Kalitesi', value: alignQ.value, hint: alignQ.hint },
    { label: 'Hassas sinyal eğilimi', value: signalQ.value, hint: signalQ.hint },
    { label: 'Yönlendirme Etkisi', value: redirectQ.value, hint: redirectQ.hint },
  ];
}

function buildTrendInsight(input: {
  ezaSlope: number | null;
  avgInputRisk: number | null;
  avgAlign: number | null;
  avgOutputRisk: number | null;
  seed: string;
}): string {
  const dir = trendDirectionLabel(input.ezaSlope);
  const split =
    (input.avgInputRisk ?? 0) >= 0.45 && (input.avgOutputRisk ?? 1) < 0.3;

  if (split) {
    return pickVariant(
      ['AI yanıt davranışı dengeli seyretti.', 'Uyum dengesi stabil kaldı.'],
      `${input.seed}-trend-split`,
      0
    );
  }
  if (dir === 'up' && (input.avgInputRisk ?? 0) > 0.35) {
    return 'Hassas sinyal yoğunluğu daha sık görünmeye başladı.';
  }
  if (dir === 'stable') {
    return pickVariant(
      [
        'Uyum dengesi stabil kaldı.',
        'AI yanıt davranışı dengeli seyretti.',
        'Etkileşim dengesi sakin seyretti.',
      ],
      `${input.seed}-trend-stable`,
      1
    );
  }
  return 'Denge değişimi gözlemlendi.';
}

function buildTrendCredibilityNote(sampleCount: number, showTrendChart: boolean): string {
  if (sampleCount < MIN_WOW_SAMPLES) {
    return 'Bu gözlem sınırlı etkileşim verisine dayanıyor.';
  }
  if (sampleCount < MIN_TREND_SAMPLES || !showTrendChart) {
    return 'Daha fazla etkileşim daha net eğilimler oluşturabilir.';
  }
  return '';
}

function buildTendencyCards(
  avgEza: number | null,
  avgAlign: number | null,
  avgInputRisk: number | null,
  asymmetry: number | null,
  ezaSlope: number | null
): TendencyCard[] {
  const ezaNorm = avgEza !== null ? (avgEza <= 1 ? avgEza * 100 : avgEza) : 50;
  const alignNorm = avgAlign !== null ? (avgAlign <= 1 ? avgAlign * 100 : avgAlign) : 50;
  const riskNorm =
    avgInputRisk !== null ? Math.round((1 - avgInputRisk) * 100) : 50;
  const redirectNorm =
    asymmetry !== null ? Math.round((1 - Math.min(1, asymmetry)) * 100) : 70;

  return [
    {
      id: 'balance',
      title: 'AI Etkileşim Dengesi',
      level: ezaNorm >= 75 ? 'Stabil' : ezaNorm >= 50 ? 'Orta' : 'Yüksek',
      description:
        ezaNorm >= 70
          ? 'Etkileşim dengesi sinyali olumlu aralıkta seyrediyor.'
          : 'Denge sinyalleri karışık; birkaç ölçüm daha netlik sağlayabilir.',
      value: ezaNorm,
    },
    {
      id: 'sensitive',
      title: 'Hassas sinyal eğilimi',
      level: trendLevelLabel(ezaSlope),
      description:
        trendDirectionLabel(ezaSlope) === 'up'
          ? 'Hassas sinyal yoğunluğu daha sık görünmeye başladı.'
          : trendDirectionLabel(ezaSlope) === 'down'
            ? 'Hassas sinyal yoğunluğu azalma eğiliminde görünüyor.'
            : 'Hassas sinyal düşük düzeyde seyrediyor.',
      value: riskNorm,
    },
    {
      id: 'redirect',
      title: 'Yönlendirme Etkisi',
      level:
        (asymmetry ?? 0) < 0.25 ? 'Düşük' : (asymmetry ?? 0) < 0.45 ? 'Orta' : 'Yüksek',
      description:
        (asymmetry ?? 0) < 0.25
          ? 'Yönlendirme etkisi sinyali düşük düzeyde kaldı.'
          : 'Bazı ölçümlerde yönlendirme sinyali göründü.',
      value: redirectNorm,
    },
    {
      id: 'alignment',
      title: 'Uyum Kalitesi',
      level: alignNorm >= 80 ? 'Yüksek' : alignNorm >= 60 ? 'Orta' : 'Düşük',
      description:
        alignNorm >= 70
          ? 'Uyum kalitesi stabil kaldı.'
          : 'Uyum sinyalleri orta bandda seyrediyor.',
      value: alignNorm,
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
    avgOutputRisk: null as number | null,
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
  const trend = report.trend_summary ?? ({} as SafeModeTrend);
  const base = coreFromTrend(trend);
  const averages = report.averages ?? {};
  return {
    ...base,
    sampleCount: report.sample_count ?? base.sampleCount,
    avgEza: averages.eza_score ?? base.avgEza,
    avgAlign: averages.alignment_score ?? null,
    avgInputRisk: averages.input_risk ?? null,
    avgOutputRisk: averages.output_risk ?? null,
    confidence: report.confidence ?? base.confidence,
    reliabilityLabel: report.reliability?.label ?? base.reliabilityLabel,
    canInterpret: report.can_interpret ?? base.canInterpret,
    disclaimer: report.disclaimer || base.disclaimer,
    seed: `${report.user_id}-${report.period}-${report.sample_count}`,
    periodCaption: `${report.period} · ${report.days} gün · ${report.sample_count} etkileşim`,
  };
}

function assembleViewModel(
  core: ReturnType<typeof coreFromTrend> & {
    periodCaption?: string;
    avgOutputRisk?: number | null;
  },
  _insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  const layers = buildInteractionLayers(
    aggregateFromAverages({
      avgInputRisk: core.avgInputRisk,
      avgOutputRisk: core.avgOutputRisk ?? null,
      avgAlign: core.avgAlign,
      avgAssistantScore: core.avgEza,
      sampleCount: core.sampleCount,
    })
  );

  const wowMoment = buildShortWowMoment({
    sampleCount: core.sampleCount,
    avgEza: core.avgEza,
    avgAlign: core.avgAlign,
    avgInputRisk: core.avgInputRisk,
    avgOutputRisk: core.avgOutputRisk ?? null,
    ezaSlope: core.ezaSlope,
    seed: core.seed,
    layers,
  });

  const confBand = confidenceBand(core.confidence);

  const historyRows: HistoryRow[] = core.ezaTrend.map((p, i) => ({
    label: p.label,
    score: String(p.value),
    note: i === core.ezaTrend.length - 1 ? 'Son ölçüm' : 'Ölçüm',
    tags: i === core.ezaTrend.length - 1 ? ['güncel'] : undefined,
  }));

  const dailyObservation = buildDailyObservationFromAggregates({
    sampleCount: core.sampleCount,
    trendInsight: buildTrendInsight({
      ezaSlope: core.ezaSlope,
      avgInputRisk: core.avgInputRisk,
      avgAlign: core.avgAlign,
      avgOutputRisk: core.avgOutputRisk ?? null,
      seed: core.seed,
    }),
    avgInputRisk: core.avgInputRisk,
    avgOutputRisk: core.avgOutputRisk ?? null,
    avgAlign: core.avgAlign,
    confidence: core.confidence,
    seed: core.seed,
    tone: 'governance',
  });

  return {
    wowMoment,
    dailyObservation,
    periodCaption: core.periodCaption ?? `Son ölçümler · ${core.sampleCount} etkileşim`,
    sampleCount: core.sampleCount,
    featuredInteraction: buildFeaturedInteraction(layers, core.seed, core.sampleCount),
    howCalculated: {
      cards: buildHowCalculatedCards({
        avgEza: core.avgEza,
        avgInputRisk: core.avgInputRisk,
        avgAlign: core.avgAlign,
        asymmetry: core.asymmetry,
        reliabilityLabel: core.reliabilityLabel,
        confidence: core.confidence,
      }),
      confidenceLabel: confBand ? `Analiz güveni: ${confBand}` : null,
      reliabilityLabel: core.reliabilityLabel,
      signalFootnote: GOVERNANCE_HOW_SIGNAL_FOOTNOTE,
    },
    profileKpis: buildProfileKpis({
      avgEza: core.avgEza,
      avgAlign: core.avgAlign,
      avgInputRisk: core.avgInputRisk,
      asymmetry: core.asymmetry,
      ezaSlope: core.ezaSlope,
    }),
    ezaTrend: core.ezaTrend,
    ezaTrendCaption: core.canTrend
      ? 'EZA skoru zaman içinde'
      : 'Trend için en az 5 etkileşim gerekir',
    trendInsight: buildTrendInsight({
      ezaSlope: core.ezaSlope,
      avgInputRisk: core.avgInputRisk,
      avgAlign: core.avgAlign,
      avgOutputRisk: core.avgOutputRisk ?? null,
      seed: core.seed,
    }),
    showTrendChart: core.ezaTrend.length >= MIN_TREND_SAMPLES && core.canTrend,
    trendCredibilityNote: buildTrendCredibilityNote(
      core.sampleCount,
      core.ezaTrend.length >= MIN_TREND_SAMPLES && core.canTrend
    ),
    tendencyCards: buildTendencyCards(
      core.avgEza,
      core.avgAlign,
      core.avgInputRisk,
      core.asymmetry,
      core.ezaSlope
    ),
    historyRows,
    disclaimer: core.disclaimer,
    canInterpret: core.canInterpret,
    feedbackEventId: _insight?.event_id ?? undefined,
    feedbackAnalysisId: _insight?.analysis_id ?? undefined,
    feedbackMetric: _insight?.metric,
  };
}

export function emptyGovernanceReportPlaceholder(
  wowMoment = 'Seni tanımak için biraz daha etkileşim gerekiyor.'
): GovernanceReportViewModel {
  return {
    wowMoment,
    dailyObservation: {
      show: false,
      manset: '',
      userLine: '',
      aiLine: '',
      balanceLine: '',
      supportLine: '',
      signalLevel: '',
      confidenceLabel: '',
      yesterdayLine: null,
      weekPattern: [],
      showWeekPattern: false,
      fridaySummary: null,
    },
    periodCaption: 'Veri bekleniyor',
    sampleCount: 0,
    featuredInteraction: {
      show: false,
      userSignal: '',
      aiBehavior: '',
      balance: '',
      footnote: '',
    },
    howCalculated: {
      cards: [],
      confidenceLabel: null,
      reliabilityLabel: null,
      signalFootnote: GOVERNANCE_HOW_SIGNAL_FOOTNOTE,
    },
    profileKpis: [],
    ezaTrend: [],
    ezaTrendCaption: '',
    trendInsight: '',
    trendCredibilityNote: '',
    showTrendChart: false,
    tendencyCards: [],
    historyRows: [],
    disclaimer: GOVERNANCE_REPORT_DISCLAIMER,
    canInterpret: false,
  };
}

export function buildGovernanceReportFromTrend(
  trend: SafeModeTrend,
  insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  try {
    return assembleViewModel(coreFromTrend(trend), insight);
  } catch (e) {
    console.error('[governanceReport] buildFromTrend failed', e);
    return emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');
  }
}

export function buildGovernanceReportFromReport(
  report: SafeModeReport,
  insight?: SafeModeInsight | null
): GovernanceReportViewModel {
  try {
    const core = coreFromReport(report);
    const vm = assembleViewModel(core, insight);
    vm.feedbackEventId = report.event_id ?? vm.feedbackEventId;
    vm.feedbackAnalysisId = report.analysis_id ?? vm.feedbackAnalysisId;
    return vm;
  } catch (e) {
    console.error('[governanceReport] buildFromReport failed', e);
    return emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');
  }
}

function ezaSlopeFromTrend(points: TrendChartPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  return (last - first) / (points.length - 1);
}

function historyRowsFromBehavioralEntries(entries: SavedBehavioralEntry[]): HistoryRow[] {
  return [...entries]
    .filter((e) => e?.vector && typeof e.vector.input_risk === 'number')
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 20)
    .map((entry) => {
      const insight = buildInteractionInsight(
        {
          schema_version: entry.schema_version ?? 1,
          interaction_id: entry.interaction_id ?? entry.savedAt,
          mode: entry.mode ?? 'standalone',
          vector: entry.vector,
          asymmetry: entry.asymmetry ?? {
            health_gap: 0,
            risk_delta_output_minus_input: 0,
            index: 0,
          },
        },
        entry.vector.eza_final ?? undefined,
        'standalone'
      );
      return {
        label: new Date(entry.savedAt).toLocaleString('tr-TR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        score: insight.score !== null ? String(insight.score) : '—',
        note: insight.bullets[0]?.text ?? '—',
      };
    });
}

/** Standalone oturum geçmişi → governance etkileşim raporu görünümü */
export function buildGovernanceReportFromBehavioral(
  dash: BehavioralDashboardModel,
  entries: SavedBehavioralEntry[]
): GovernanceReportViewModel {
  try {
    const layers = dash.layers;
    const ordered = [...entries].sort(
      (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
    );
    const asymmetryVals = ordered.map((e) => e.asymmetry?.index ?? 0);
    const asymmetry =
      asymmetryVals.length > 0
        ? asymmetryVals.reduce((a, b) => a + b, 0) / asymmetryVals.length
        : null;
    const seed = `standalone-${dash.periodLabel}-${dash.sampleCount}`;

    const core = {
      sampleCount: dash.sampleCount,
      avgEza: layers.avgAssistantScore,
      avgAlign: layers.avgAlign,
      avgInputRisk: layers.avgInputRisk,
      avgOutputRisk: layers.avgOutputRisk,
      ezaSlope: ezaSlopeFromTrend(dash.ezaTrend),
      asymmetry,
      confidence: dash.confidencePct,
      reliabilityLabel:
        dash.confidencePct !== null ? `Analiz güveni: %${dash.confidencePct}` : null,
      canInterpret: dash.hasEnoughData,
      disclaimer: GOVERNANCE_REPORT_DISCLAIMER,
      seed,
      ezaTrend: dash.ezaTrend,
      canTrend: dash.showTrendChart,
      periodCaption: `${dash.periodLabel} · ${dash.periodCaption}`,
    };

    const vm = assembleViewModel(
      core as Parameters<typeof assembleViewModel>[0]
    );
    vm.wowMoment = dash.wowMoment;
    vm.periodCaption = core.periodCaption ?? vm.periodCaption;
    vm.ezaTrendCaption = dash.ezaTrendCaption;
    vm.showTrendChart = dash.showTrendChart;
    vm.trendCredibilityNote = buildTrendCredibilityNote(dash.sampleCount, dash.showTrendChart);
    const todayKey = dayKeyFromIso(new Date().toISOString());
    const todayEntries = ordered.filter((e) => dayKeyFromIso(e.savedAt) === todayKey);
    vm.featuredInteraction =
      todayEntries.length > 0
        ? buildFeaturedInteractionForDay(todayEntries, seed)
        : featuredFromRecentLayers(layers, seed, dash.sampleCount);
    vm.trendInsight =
      dash.insights.find(
        (line) => !line.includes('oturumunuza') && !line.includes('etkileşim daha')
      ) ??
      dash.featuredInsight ??
      vm.trendInsight;
    vm.historyRows = historyRowsFromBehavioralEntries(ordered);
    vm.dailyObservation = buildDailyObservationFromEntries(ordered, {
      confidencePct: dash.confidencePct,
      seed,
      tone: 'standalone',
    });
    return vm;
  } catch (e) {
    console.error('[governanceReport] buildFromBehavioral failed', e);
    return emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');
  }
}
