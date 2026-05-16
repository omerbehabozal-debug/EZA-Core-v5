/**
 * Üç katmanlı etkileşim analizi: kullanıcı girişi · AI yanıtı · etkileşim dengesi.
 * Gözlemsel dil — yargı yok.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export type LevelLabel = 'Düşük' | 'Orta' | 'Yüksek' | 'Stabil' | 'Artıyor' | 'Azalıyor';

export interface LayerKpi {
  label: string;
  value: string;
  hint?: string;
}

export interface InteractionLayerView {
  id: 'user' | 'assistant' | 'balance';
  title: string;
  subtitle: string;
  level: LevelLabel;
  headline: string;
  description: string;
  kpis: LayerKpi[];
}

export interface RecentTurnHighlight {
  show: boolean;
  summary: string;
  userRiskLabel: string;
  aiResponseLabel: string;
  balanceLabel: string;
}

export interface InteractionLayersSnapshot {
  layers: InteractionLayerView[];
  hasInputOutputSplit: boolean;
  safeRefusalCount: number;
  riskyInputCount: number;
  avgInputRisk: number;
  avgOutputRisk: number;
  avgAlign: number;
  avgAssistantScore: number | null;
  recentTurn: RecentTurnHighlight;
}

export interface LayerAggregateInput {
  avgInputRisk: number;
  avgOutputRisk: number;
  avgAlign: number | null;
  avgAssistantScore: number | null;
  sampleCount: number;
  safeRefusalCount: number;
  riskyInputCount: number;
  harmfulRedirectCount: number;
  lastEntry?: SavedBehavioralEntry | null;
}

function riskLevelFromHealth(health01: number): LevelLabel {
  if (health01 >= 0.7) return 'Düşük';
  if (health01 >= 0.45) return 'Orta';
  return 'Yüksek';
}

function alignLevel(score100: number): LevelLabel {
  if (score100 >= 80) return 'Yüksek';
  if (score100 >= 60) return 'Orta';
  return 'Düşük';
}

function fmtPct(risk: number): string {
  return `%${Math.round(Math.max(0, Math.min(1, risk)) * 100)}`;
}

function normalizeAlign(score: number | null): number | null {
  if (score === null || Number.isNaN(score)) return null;
  return score <= 1 ? score * 100 : score;
}

export function aggregateFromEntries(ordered: SavedBehavioralEntry[]): LayerAggregateInput {
  const n = ordered.length;
  const inputRisks = ordered.map((e) => e.vector?.input_risk ?? 0);
  const outputRisks = ordered.map((e) => e.vector?.output_risk ?? 0);
  const alignments = ordered
    .map((e) => e.vector?.alignment_score)
    .filter((s): s is number => s !== null)
    .map((s) => (s <= 1 ? s * 100 : s));
  const ezaScores = ordered
    .map((e) => e.vector?.eza_final)
    .filter((s): s is number => s !== null);

  const safeRefusalCount = ordered.filter(
    (e) => (e.vector?.input_risk ?? 0) >= 0.5 && (e.vector?.output_risk ?? 1) < 0.3
  ).length;
  const riskyInputCount = ordered.filter((e) => (e.vector?.input_risk ?? 0) >= 0.5).length;
  const harmfulRedirectCount = ordered.filter(
    (e) => e.vector?.redirect && !e.vector?.redirect_benign
  ).length;

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    avgInputRisk: avg(inputRisks),
    avgOutputRisk: avg(outputRisks),
    avgAlign: alignments.length ? avg(alignments) : null,
    avgAssistantScore: ezaScores.length ? avg(ezaScores) : null,
    sampleCount: n,
    safeRefusalCount,
    riskyInputCount,
    harmfulRedirectCount,
    lastEntry: n ? ordered[n - 1] : null,
  };
}

export function buildInteractionLayers(input: LayerAggregateInput): InteractionLayersSnapshot {
  const {
    avgInputRisk,
    avgOutputRisk,
    avgAlign,
    avgAssistantScore,
    sampleCount,
    safeRefusalCount,
    riskyInputCount,
    lastEntry,
  } = input;

  const userHealth = 1 - avgInputRisk;
  const aiHealth = 1 - avgOutputRisk;
  const alignScore = avgAlign ?? 70;
  const hasInputOutputSplit =
    (avgInputRisk >= 0.45 && avgOutputRisk < 0.3) || safeRefusalCount >= 1;

  const userLayer: InteractionLayerView = {
    id: 'user',
    title: 'Kullanıcı sinyalleri',
    subtitle: 'Sorduğunuz ve yazdığınız içeriklerden çıkan gözlemler',
    level: riskLevelFromHealth(userHealth),
    headline:
      avgInputRisk >= 0.5
        ? 'Bazı girişlerde risk sinyali gözlemlendi'
        : avgInputRisk >= 0.3
          ? 'Girdi sinyalleri orta düzeyde seyrediyor'
          : 'Girdi sinyalleri genelde düşük seyrediyor',
    description:
      avgInputRisk >= 0.5
        ? 'Hassas veya yüksek riskli içerik istekleri bu dönemde belirginleşmiş görünüyor. Bu, AI davranışından bağımsız bir giriş gözlemidir.'
        : 'Son etkileşimlerde girdi tarafında belirgin risk sapması az görünüyor.',
    kpis: [
      {
        label: 'Hassas sinyal yoğunluğu',
        value: fmtPct(avgInputRisk),
        hint: riskyInputCount > 0 ? `${riskyInputCount} yüksek riskli giriş` : 'Düşük',
      },
      {
        label: 'Girdi sağlık sinyali',
        value: `${Math.round(userHealth * 100)}`,
        hint: 'Yüksek = daha sakin girdi profili',
      },
    ],
  };

  const aiLayer: InteractionLayerView = {
    id: 'assistant',
    title: 'AI yanıt davranışı',
    subtitle: 'Modelin nasıl yanıt verdiğine dair gözlemler',
    level: riskLevelFromHealth(aiHealth),
    headline:
      avgOutputRisk < 0.25
        ? 'AI yanıtları güvenli sınırlar içinde kaldı'
        : avgOutputRisk < 0.45
          ? 'Yanıtlarda orta düzey risk sinyali seyretti'
          : 'Bazı yanıtlarda dikkat gerektiren sinyaller görüldü',
    description:
      hasInputOutputSplit
        ? 'Riskli girişlere rağmen çıktı tarafında güvenli kalma eğilimi gözlemlendi; bu AI yanıt kalitesine işaret eder.'
        : 'Çıktı risk sinyalleri bu dönemdeki genel AI davranış özetidir.',
    kpis: [
      {
        label: 'Çıktı güvenliği',
        value: `${Math.round(aiHealth * 100)}`,
        hint: avgOutputRisk < 0.25 ? 'Güvenli aralık' : 'İzlenmeli',
      },
      {
        label: 'Ortalama yanıt skoru',
        value:
          avgAssistantScore !== null && !Number.isNaN(avgAssistantScore)
            ? avgAssistantScore.toFixed(0)
            : '—',
        hint: 'AI yanıt kalitesi (EZA)',
      },
    ],
  };

  const balanceLayer: InteractionLayerView = {
    id: 'balance',
    title: 'Etkileşim dengesi',
    subtitle: 'Girdi ve yanıtın birlikte oluşturduğu uyum',
    level: hasInputOutputSplit && alignScore >= 65 ? 'Stabil' : alignLevel(alignScore),
    headline:
      hasInputOutputSplit
        ? 'Girdi–yanıt ayrışması dengeli yönetilmiş görünüyor'
        : alignScore >= 70
          ? 'Genel etkileşim dengesi stabil seyrediyor'
          : 'Etkileşim dengesi karışık sinyaller veriyor',
    description:
      hasInputOutputSplit
        ? 'Kullanıcı tarafında risk sinyali olsa da uyum ve güvenli yanıt eğilimi genel dengeyi desteklemiş görünüyor.'
        : 'Uyum ve yönlendirme sinyalleri birlikte değerlendirildi.',
    kpis: [
      {
        label: 'Uyum kalitesi',
        value: `${Math.round(alignScore)}`,
        hint: alignScore >= 70 ? 'Yüksek' : 'Orta',
      },
      {
        label: 'Güvenli red örnekleri',
        value: safeRefusalCount > 0 ? String(safeRefusalCount) : '0',
        hint:
          safeRefusalCount > 0
            ? 'Riskli girişe güvenli yanıt'
            : 'Bu dönemde kayıt yok',
      },
    ],
  };

  let recentTurn: RecentTurnHighlight = {
    show: false,
    summary: '',
    userRiskLabel: '—',
    aiResponseLabel: '—',
    balanceLabel: '—',
  };

  if (lastEntry?.vector) {
    const ir = lastEntry.vector.input_risk ?? 0;
    const or = lastEntry.vector.output_risk ?? 0;
    const al = normalizeAlign(lastEntry.vector.alignment_score ?? null) ?? 0;
    const split = ir >= 0.5 && or < 0.3;
    recentTurn = {
      show: split || ir >= 0.4,
      summary: split
        ? 'Son etkileşimde: girişte risk sinyali varken AI yanıtı güvenli sınırlarda kaldı.'
        : ir >= 0.4
          ? 'Son etkileşimde girdi tarafında dikkat çeken sinyaller gözlemlendi.'
          : 'Son etkileşim dengeli sinyaller verdi.',
      userRiskLabel: fmtPct(ir),
      aiResponseLabel: `${Math.round((1 - or) * 100)} güvenli`,
      balanceLabel: `${Math.round(al)} uyum`,
    };
  }

  return {
    layers: [userLayer, aiLayer, balanceLayer],
    hasInputOutputSplit,
    safeRefusalCount,
    riskyInputCount,
    avgInputRisk,
    avgOutputRisk,
    avgAlign: alignScore,
    avgAssistantScore,
    recentTurn,
  };
}

/** Governance / API özet ortalamalarından katman girdisi (son etkileşim satırı yok). */
export function aggregateFromAverages(input: {
  avgInputRisk: number | null;
  avgOutputRisk: number | null;
  avgAlign: number | null;
  avgAssistantScore: number | null;
  sampleCount: number;
}): LayerAggregateInput {
  const ir = input.avgInputRisk ?? 0;
  const or = input.avgOutputRisk ?? 0;
  const split = ir >= 0.45 && or < 0.3;
  return {
    avgInputRisk: ir,
    avgOutputRisk: or,
    avgAlign: input.avgAlign,
    avgAssistantScore: input.avgAssistantScore,
    sampleCount: input.sampleCount,
    safeRefusalCount: split ? Math.max(1, Math.floor(input.sampleCount * 0.2)) : 0,
    riskyInputCount: ir >= 0.5 ? Math.max(1, Math.floor(input.sampleCount * 0.3)) : 0,
    harmfulRedirectCount: 0,
    lastEntry: null,
  };
}

export function buildSplitWowMoment(
  snap: InteractionLayersSnapshot,
  seed: string,
  sampleCount: number
): string | null {
  if (!snap.hasInputOutputSplit && snap.safeRefusalCount === 0) return null;

  const variants = [
    'Bazı girişlerde risk sinyali gözlemlendi; AI yanıtları güvenli sınırlar içinde kaldı.',
    'Girdi tarafında dikkat çeken sinyaller varken yanıtlar güvenli kalma eğiliminde seyretti.',
    'Riskli soru kalıpları görülse de AI yanıt davranışı güvenli sınırlarda kaldı.',
    snap.recentTurn.show
      ? 'Son etkileşimde giriş riski yüksekti; AI yanıtı güvenli sınırlar içinde kaldı.'
      : 'Kullanıcı ve AI sinyalleri ayrı izlendi: girişte risk, yanıtta güvenli eğilim.',
  ];

  let h = sampleCount * 31;
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * (i + 7)) | 0;
  return variants[Math.abs(h) % variants.length]!;
}
