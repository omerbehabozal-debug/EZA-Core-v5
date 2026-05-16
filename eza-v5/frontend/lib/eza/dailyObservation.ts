/**
 * EZA Latest Observation — etkileşim oturumu odaklı (takvim / streak değil).
 * Mikro: son oturum · Pattern: son 7 etkileşim · Uzun: özet cümle.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export type UserObservationCategoryId =
  | 'balanced'
  | 'decision_support'
  | 'clarity_seek'
  | 'flow_harmony'
  | 'sensitive_signals'
  | 'safe_balance'
  | 'question_clarity'
  | 'exploration'
  | 'quiet';

export type AiBehaviorCategoryId =
  | 'explanatory'
  | 'safe_boundary'
  | 'low_redirect'
  | 'suggestion_density'
  | 'balanced_refusal'
  | 'high_alignment'
  | 'neutral_tone'
  | 'sensitive_balance';

export const USER_CATEGORY_LABEL: Record<UserObservationCategoryId, string> = {
  balanced: 'Dengeli etkileşim',
  decision_support: 'Karar desteği',
  clarity_seek: 'Netlik arayışı',
  flow_harmony: 'Akış uyumu',
  sensitive_signals: 'Hassas sinyaller',
  safe_balance: 'Güvenli denge',
  question_clarity: 'Soru netliği',
  exploration: 'Keşif odaklı',
  quiet: 'Sakin akış',
};

export const OBSERVATION_CATEGORY_EMOJI: Record<UserObservationCategoryId, string> = {
  balanced: '🟢',
  decision_support: '🔵',
  clarity_seek: '🔵',
  flow_harmony: '🟢',
  sensitive_signals: '🟠',
  safe_balance: '🟢',
  question_clarity: '🔵',
  exploration: '🟣',
  quiet: '⚪',
};

/** @deprecated use USER_CATEGORY_LABEL */
export const OBSERVATION_CATEGORY_LABEL = USER_CATEGORY_LABEL;

export type ObservationCategoryId = UserObservationCategoryId;

/** Son etkileşimler — takvim günü değil, kronolojik nokta */
export interface InteractionPatternDot {
  relativeLabel: string;
  emoji: string;
  categoryLabel: string;
  hasData: boolean;
  isLatest: boolean;
  hoverTitle: string;
}

/** @deprecated InteractionPatternDot kullan */
export type WeekPatternDay = InteractionPatternDot;

export interface DailyObservationView {
  show: boolean;
  manset: string;
  userLine: string;
  aiLine: string;
  balanceLine: string;
  supportLine: string;
  signalLevel: string;
  confidenceLabel: string;
  /** Önceki oturum / desen değişimi */
  yesterdayLine: string | null;
  weekPattern: InteractionPatternDot[];
  showWeekPattern: boolean;
  /** Son etkileşimlerde sık görülen desen */
  fridaySummary: string | null;
  headline?: string;
  interactionTone?: string | null;
}

interface DayMetrics {
  sampleCount: number;
  avgIn: number;
  avgOut: number;
  avgAlign: number;
  safeRefusalCount: number;
  benignRedirectCount: number;
  harmfulRedirectCount: number;
  hasInputOutputSplit: boolean;
}

const SESSION_GAP_MS = 12 * 60 * 60 * 1000;
const PATTERN_DOT_COUNT = 7;

const EMPTY_VIEW: DailyObservationView = {
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
};

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function normalizeAlign(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
}

function pickVariant(variants: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 11)) | 0;
  }
  return variants[Math.abs(h) % variants.length]!;
}

function sortNewestFirst(entries: SavedBehavioralEntry[]): SavedBehavioralEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

/** 12 saatten uzun boşluk = yeni oturum */
export function splitInteractionSessions(entries: SavedBehavioralEntry[]): SavedBehavioralEntry[][] {
  const sorted = sortNewestFirst(entries);
  if (!sorted.length) return [];

  const sessions: SavedBehavioralEntry[][] = [];
  let current: SavedBehavioralEntry[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i += 1) {
    const newer = new Date(sorted[i - 1]!.savedAt).getTime();
    const older = new Date(sorted[i]!.savedAt).getTime();
    if (newer - older > SESSION_GAP_MS) {
      sessions.push(current);
      current = [];
    }
    current.push(sorted[i]!);
  }
  sessions.push(current);
  return sessions;
}

function relativeTimeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || Number.isNaN(diff)) return 'Az önce';
  const mins = Math.floor(diff / 60_000);
  if (mins < 45) return 'Az önce';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 saat önce' : `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  if (days < 14) return `${days} gün önce`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 hafta önce' : `${weeks} hafta önce`;
}

function metricsFromEntries(entries: SavedBehavioralEntry[]): DayMetrics {
  if (entries.length === 0) {
    return {
      sampleCount: 0,
      avgIn: 0,
      avgOut: 0,
      avgAlign: 55,
      safeRefusalCount: 0,
      benignRedirectCount: 0,
      harmfulRedirectCount: 0,
      hasInputOutputSplit: false,
    };
  }

  const inputRisks = entries.map((e) => e.vector.input_risk ?? 0);
  const outputRisks = entries.map((e) => e.vector.output_risk ?? 0);
  const alignments = entries
    .map((e) => normalizeAlign(e.vector.alignment_score))
    .filter((s): s is number => s !== null);
  const avgIn = avg(inputRisks);
  const avgOut = avg(outputRisks);
  const avgAlign = alignments.length ? avg(alignments) : 55;
  const safeRefusalCount = entries.filter(
    (e) => (e.vector.input_risk ?? 0) >= 0.5 && (e.vector.output_risk ?? 1) < 0.3
  ).length;
  const benignRedirectCount = entries.filter((e) => e.vector.redirect_benign).length;
  const harmfulRedirectCount = entries.filter(
    (e) => e.vector.redirect && !e.vector.redirect_benign
  ).length;

  return {
    sampleCount: entries.length,
    avgIn,
    avgOut,
    avgAlign,
    safeRefusalCount,
    benignRedirectCount,
    harmfulRedirectCount,
    hasInputOutputSplit: avgIn >= 0.45 && avgOut < 0.32,
  };
}

export function classifyDayFromEntries(entries: SavedBehavioralEntry[]): UserObservationCategoryId {
  const m = metricsFromEntries(entries);
  if (m.sampleCount === 0) return 'quiet';

  const intents = entries.map((e) => (e.vector.intent || '').toLowerCase());

  if (m.hasInputOutputSplit || (m.safeRefusalCount > 0 && m.avgIn >= 0.4)) {
    return 'safe_balance';
  }
  if (m.avgIn < 0.28 && m.avgOut < 0.28 && m.avgAlign >= 68) return 'balanced';
  if (m.avgIn >= 0.42) return 'sensitive_signals';
  if (intents.some((i) => /decision|karar|choose|seçim/.test(i))) return 'decision_support';
  if (intents.some((i) => /explor|learn|keşif|discover/.test(i))) return 'exploration';
  if (intents.some((i) => /verif|clarif|netlik|confirm|doğrula/.test(i))) return 'clarity_seek';
  if (m.avgAlign >= 74 && m.avgIn < 0.36 && m.avgOut < 0.35) return 'flow_harmony';
  if (m.sampleCount >= 2 && m.avgIn < 0.38) return 'question_clarity';
  if (m.avgAlign >= 62 && m.avgIn < 0.4) return 'balanced';
  return 'quiet';
}

export function classifyAiFromEntries(entries: SavedBehavioralEntry[]): AiBehaviorCategoryId {
  const m = metricsFromEntries(entries);
  if (m.sampleCount === 0) return 'neutral_tone';

  if (m.hasInputOutputSplit || (m.avgIn >= 0.45 && m.avgOut < 0.3)) {
    return 'sensitive_balance';
  }
  if (m.safeRefusalCount > 0) return 'balanced_refusal';
  if (m.avgOut < 0.25) return 'safe_boundary';
  if (m.harmfulRedirectCount > 0 || m.avgOut >= 0.45) return 'suggestion_density';
  if (m.benignRedirectCount === 0 && m.harmfulRedirectCount === 0 && m.avgOut < 0.35) {
    return 'low_redirect';
  }
  if (m.avgAlign >= 78) return 'high_alignment';
  if (m.avgOut < 0.38 && m.avgAlign >= 68) return 'explanatory';
  return 'neutral_tone';
}

function userLineForCategory(
  category: UserObservationCategoryId,
  m: DayMetrics,
  seed: string
): string {
  if (m.sampleCount < 1) {
    return 'Son etkileşimlerde belirgin bir kullanıcı sinyali gözlemlenmedi.';
  }

  const map: Record<UserObservationCategoryId, string[]> = {
    balanced: [
      'Son etkileşimlerde denge stabil göründü.',
      'Son konuşmalar genel profilinle uyumlu seyretti.',
    ],
    decision_support: [
      'Son etkileşimlerde karar desteği arayışı öne çıktı.',
      'Son konuşmalarda karar öncesi netlik arayışı gözlemlendi.',
    ],
    clarity_seek: [
      'Son etkileşimlerde netlik arayışı öne çıktı.',
      'Son konuşmalarda doğrulama ve netlik sinyalleri belirginleşti.',
    ],
    flow_harmony: [
      'Son etkileşimlerde yanıtlarla uyum yüksek seyretti.',
      'Son oturumda akış uyumu belirgin bir ton taşıdı.',
    ],
    sensitive_signals: [
      'Son etkileşimlerde hassas konu sinyalleri daha belirgin göründü.',
      'Son oturumda hassas sinyal yoğunluğu dikkat çekti.',
    ],
    safe_balance: [
      'Hassas konu sinyali gözlemlendi.',
      'Son oturumda girdi tarafında dikkat çeken sinyaller göründü.',
    ],
    question_clarity: [
      'Son sorular daha doğrudan ve net bir yapıdaydı.',
      'Son oturumda soru netliği odaklı bir ton seyretti.',
    ],
    exploration: [
      'Son konuşmalar daha çok fikir geliştirme yönünde ilerledi.',
      'Son oturumda keşif odaklı bir etkileşim tonu gözlemlendi.',
    ],
    quiet: [
      'Belirgin bir kullanıcı sinyali sapması gözlemlenmedi.',
      'Son etkileşimler sakin ve dengeli bir çizgide kaldı.',
    ],
  };
  return pickVariant(map[category], seed);
}

function aiLineForCategory(
  category: AiBehaviorCategoryId,
  m: DayMetrics,
  seed: string
): string {
  if (m.sampleCount < 1) {
    return 'AI yanıt davranışını yorumlamak için daha fazla veri gerekiyor.';
  }

  const map: Record<AiBehaviorCategoryId, string[]> = {
    explanatory: [
      'Yanıtlar daha açıklayıcı bir ton taşıyordu.',
      'AI yanıtları son oturumda daha açıklayıcı bir çizgide kaldı.',
    ],
    safe_boundary: [
      'Yanıtlar güvenli sınırlar içinde kaldı.',
      'AI yanıtlarında güvenli sınır vurgusu belirgin göründü.',
    ],
    low_redirect: [
      'AI yanıtlarında yönlendirme yoğunluğu düşük seyretti.',
      'Yanıtlarda yönlendirme etkisi düşük düzeyde kaldı.',
    ],
    suggestion_density: [
      'Bazı yanıtlarda öneri dili daha belirgin göründü.',
      'Bazı yanıtlarda daha güçlü öneri tonu gözlemlendi.',
    ],
    balanced_refusal: [
      'AI hassas girişlerde dengeli bir sınır çizdi.',
      'Hassas girişlerde yanıt dengesi korunmuş görünüyor.',
    ],
    high_alignment: [
      'Yanıtlar soru bağlamıyla yüksek uyum gösterdi.',
      'AI yanıtlarında uyum sinyali yüksek seyretti.',
    ],
    neutral_tone: [
      'AI yanıtları nötr ve dengeli bir çizgide kaldı.',
      'Yanıtlar sakin ve ölçülü bir ton taşıdı.',
    ],
    sensitive_balance: [
      'AI yanıtları hassas sinyallere rağmen dengeyi korudu.',
      'Yanıtlar hassas girişlere rağmen güvenli sınırlarda kaldı.',
    ],
  };
  return pickVariant(map[category], `${seed}-ai`);
}

function balanceLineForPair(
  userCat: UserObservationCategoryId,
  aiCat: AiBehaviorCategoryId,
  m: DayMetrics,
  seed: string
): string {
  if (m.sampleCount < 2) {
    return 'Etkileşim dengesini yorumlamak için birkaç etkileşim daha gerekli.';
  }

  if (m.hasInputOutputSplit || (userCat === 'sensitive_signals' && aiCat === 'sensitive_balance')) {
    return pickVariant(
      [
        'Hassas sinyallere rağmen etkileşim dengesi korundu.',
        'Riskli girişe rağmen yanıt dengesi bozulmadı.',
      ],
      `${seed}-bal-split`
    );
  }
  if (userCat === 'safe_balance' || aiCat === 'balanced_refusal') {
    return 'Hassas sinyallere rağmen denge korunmuş görünüyor.';
  }
  if (m.avgIn < 0.35 && m.avgAlign >= 70) {
    return pickVariant(
      ['Etkileşim akışı dengeli ve uyumlu seyretti.', 'Etkileşim dengesi stabil kaldı.'],
      `${seed}-bal-flow`
    );
  }
  if (aiCat === 'low_redirect') {
    return 'AI yanıtları yönlendirme etkisini düşük tuttu.';
  }
  if (userCat === 'balanced' || userCat === 'quiet') {
    return pickVariant(
      [
        'Son etkileşim tonu genel profilinle uyumlu seyretti.',
        'Etkileşim dengesi stabil kaldı.',
      ],
      `${seed}-bal-stable`
    );
  }
  if (userCat === 'decision_support' && (aiCat === 'explanatory' || aiCat === 'high_alignment')) {
    return 'Karar arayışına yanıt tonu uyumlu kaldı.';
  }
  return pickVariant(
    ['Etkileşim dengesi stabil kaldı.', 'Girdi ve yanıt sinyalleri birlikte dengeli göründü.'],
    `${seed}-bal-default`
  );
}

function mansetForObservation(
  userCat: UserObservationCategoryId,
  aiCat: AiBehaviorCategoryId,
  m: DayMetrics,
  seed: string
): string {
  if (m.hasInputOutputSplit) {
    return pickVariant(
      ['Hassas sinyale rağmen denge korundu.', 'Yanıt güvenli sınırlarda kaldı.'],
      `${seed}-m-split`
    );
  }
  const short: Partial<Record<UserObservationCategoryId, string[]>> = {
    decision_support: ['Karar desteği öne çıktı.', 'Karar arayışı belirginleşti.'],
    clarity_seek: ['Netlik arayışı öne çıktı.'],
    exploration: ['Keşif tonu öne çıktı.'],
    sensitive_signals: ['Hassas sinyal dikkat çekti.'],
    balanced: ['Denge korundu.', 'Dengeli bir oturum.'],
    quiet: ['Sakin bir etkileşim akışı.'],
  };
  const variants = short[userCat];
  if (variants) return pickVariant(variants, `${seed}-m-user`);
  if (aiCat === 'safe_boundary' || aiCat === 'sensitive_balance') {
    return 'Yanıtlar güvenli çizgide kaldı.';
  }
  return pickVariant(['Son gözlem hazır.', 'Yeni bir desen oluştu.'], `${seed}-m-fb`);
}

function signalLevelLabel(userCat: UserObservationCategoryId, count: number): string {
  if (count < 2) return 'Ön gözlem';
  if (userCat === 'quiet' || userCat === 'balanced') return 'Sakin';
  if (userCat === 'sensitive_signals' || userCat === 'safe_balance') return 'Orta';
  return 'Orta';
}

function confidenceLabelFromSamples(sampleCount: number, confidencePct: number | null): string {
  if (confidencePct !== null && confidencePct >= 70) return 'Güven: Orta';
  if (sampleCount >= 8) return 'Güven: Orta';
  if (sampleCount >= 3) return 'Güven: Ön gözlem';
  return 'Güven: Ön gözlem';
}

function categoryLabelForEntry(entry: SavedBehavioralEntry): string {
  const userCat = classifyDayFromEntries([entry]);
  if (userCat === 'safe_balance') return USER_CATEGORY_LABEL.safe_balance;
  return USER_CATEGORY_LABEL[userCat];
}

function buildInteractionPatternDots(entries: SavedBehavioralEntry[]): InteractionPatternDot[] {
  const recent = sortNewestFirst(entries).slice(0, PATTERN_DOT_COUNT);
  const chronological = [...recent].reverse();
  const latestId = recent[0]?.interaction_id;

  return chronological.map((entry) => {
    const userCat = classifyDayFromEntries([entry]);
    const label = categoryLabelForEntry(entry);
    const rel = relativeTimeLabel(entry.savedAt);
    return {
      relativeLabel: rel,
      emoji: OBSERVATION_CATEGORY_EMOJI[userCat],
      categoryLabel: label,
      hasData: true,
      isLatest: entry.interaction_id === latestId,
      hoverTitle: `${rel} · ${label}`,
    };
  });
}

function buildPriorSessionLine(sessions: SavedBehavioralEntry[][]): string | null {
  if (sessions.length < 2) return null;
  const latestCat = classifyDayFromEntries(sessions[0]!);
  const priorCat = classifyDayFromEntries(sessions[1]!);
  if (latestCat !== priorCat) {
    return 'Son etkileşimden bu yana yeni bir desen oluştu.';
  }
  return `Önceki oturum: ${USER_CATEGORY_LABEL[priorCat]}`;
}

function buildPatternSummary(entries: SavedBehavioralEntry[]): string | null {
  const recent = sortNewestFirst(entries).slice(0, PATTERN_DOT_COUNT);
  if (recent.length < 4) return null;

  const counts = new Map<string, number>();
  for (const entry of recent) {
    const label = categoryLabelForEntry(entry);
    if (label === USER_CATEGORY_LABEL.quiet) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;

  const [topLabel, topCount] = ranked[0]!;
  if (ranked.length === 1) {
    return `Son etkileşimlerde en sık görülen: ${topLabel}`;
  }
  const second = ranked[1];
  if (second && second[1] === topCount) {
    return `Son etkileşimlerde: ${topLabel} ve ${second[0]} birlikte öne çıktı.`;
  }
  return `Son etkileşimlerde en sık görülen: ${topLabel} — ${topCount} etkileşim`;
}

function buildMirrorObservation(
  sessionEntries: SavedBehavioralEntry[],
  seed: string,
  sampleCountTotal: number,
  confidencePct: number | null
): Omit<
  DailyObservationView,
  'show' | 'yesterdayLine' | 'weekPattern' | 'showWeekPattern' | 'fridaySummary'
> {
  const m = metricsFromEntries(sessionEntries);
  const userCat = classifyDayFromEntries(sessionEntries);
  const aiCat = classifyAiFromEntries(sessionEntries);
  const sessionSeed = `${seed}-${sessionEntries[0]?.interaction_id ?? 'empty'}`;

  return {
    manset: mansetForObservation(userCat, aiCat, m, sessionSeed),
    userLine: userLineForCategory(userCat, m, sessionSeed),
    aiLine: aiLineForCategory(aiCat, m, sessionSeed),
    balanceLine: balanceLineForPair(userCat, aiCat, m, sessionSeed),
    supportLine:
      'Bu gözlem son etkileşim oturumundaki soru yapısı, AI yanıt tonu ve dengeye dayanır.',
    signalLevel: `Sinyal seviyesi: ${signalLevelLabel(userCat, m.sampleCount)}`,
    confidenceLabel: confidenceLabelFromSamples(sampleCountTotal, confidencePct),
    headline: undefined,
    interactionTone: null,
  };
}

export function buildDailyObservationFromEntries(
  entries: SavedBehavioralEntry[],
  options?: { confidencePct?: number | null; seed?: string }
): DailyObservationView {
  const seed = options?.seed ?? 'standalone-daily';
  if (entries.length === 0) return { ...EMPTY_VIEW };

  const sessions = splitInteractionSessions(entries);
  const latestSession = sessions[0] ?? [];
  const weekPattern = buildInteractionPatternDots(entries);

  const mirror =
    latestSession.length > 0
      ? buildMirrorObservation(
          latestSession,
          seed,
          entries.length,
          options?.confidencePct ?? null
        )
      : {
          ...buildMirrorObservation([], seed, entries.length, options?.confidencePct ?? null),
          manset: 'Henüz kayıtlı etkileşim yok.',
          userLine: 'Son etkileşimlerde belirgin bir kullanıcı sinyali gözlemlenmedi.',
          supportLine: 'Yeni konuşmalar başladığında son gözlem burada güncellenir.',
        };

  return {
    show: true,
    ...mirror,
    yesterdayLine: buildPriorSessionLine(sessions),
    weekPattern,
    showWeekPattern: entries.length >= 3,
    fridaySummary: buildPatternSummary(entries),
  };
}

export function buildDailyObservationFromAggregates(input: {
  sampleCount: number;
  trendInsight: string;
  avgInputRisk: number | null;
  avgOutputRisk: number | null;
  avgAlign: number | null;
  confidence: number | null;
  seed: string;
}): DailyObservationView {
  if (input.sampleCount < 1) return { ...EMPTY_VIEW };

  const pseudoEntries: SavedBehavioralEntry[] =
    input.avgInputRisk !== null
      ? [
          {
            savedAt: new Date().toISOString(),
            schema_version: 1,
            interaction_id: 'gov-synth',
            mode: 'governance',
            vector: {
              input_risk: input.avgInputRisk,
              output_risk: input.avgOutputRisk ?? 0.2,
              input_health: 1 - input.avgInputRisk,
              output_health: 1 - (input.avgOutputRisk ?? 0.2),
              alignment_score: input.avgAlign,
              eza_final: null,
              intent: '',
              alignment_verdict: null,
              redirect: false,
              redirect_reason: null,
              policy_violation_count: 0,
            },
            asymmetry: {
              health_gap: 0,
              risk_delta_output_minus_input: 0,
              index: 0,
            },
          } as SavedBehavioralEntry,
        ]
      : [];

  if (pseudoEntries.length > 0) {
    return buildDailyObservationFromEntries(pseudoEntries, {
      confidencePct: input.confidence,
      seed: input.seed,
    });
  }

  const fallbackUser =
    input.trendInsight && input.trendInsight.length < 100 && !input.trendInsight.includes('%')
      ? input.trendInsight
      : 'Son etkileşimler sakin bir çizgide seyretti.';

  return {
    show: true,
    manset: 'Gözlem oluşuyor.',
    userLine: fallbackUser,
    aiLine: 'AI yanıt davranışını yorumlamak için daha fazla veri gerekiyor.',
    balanceLine: 'Etkileşim dengesini yorumlamak için birkaç etkileşim daha gerekli.',
    supportLine: 'Bu gözlem son etkileşim özetine ve gözlemsel sinyallere dayanır.',
    signalLevel: `Sinyal seviyesi: ${signalLevelLabel('quiet', input.sampleCount)}`,
    confidenceLabel: confidenceLabelFromSamples(input.sampleCount, input.confidence),
    yesterdayLine: null,
    weekPattern: [],
    showWeekPattern: false,
    fridaySummary: null,
  };
}
