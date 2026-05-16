/**
 * EZA Daily Observation Loop — iki ayna: kullanıcı sinyali + AI yanıt davranışı + denge.
 * Frontend-only; gözlemsel ton, gamification yok.
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
  balanced: 'Dengeli gün',
  decision_support: 'Karar desteği',
  clarity_seek: 'Netlik arayışı',
  flow_harmony: 'Akış uyumu',
  sensitive_signals: 'Hassas sinyaller',
  safe_balance: 'Güvenli denge',
  question_clarity: 'Soru netliği',
  exploration: 'Keşif odaklı',
  quiet: 'Sakin gün',
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

/** @deprecated use USER_CATEGORY_LABEL — week pattern uyumu */
export const OBSERVATION_CATEGORY_LABEL = USER_CATEGORY_LABEL;

export type ObservationCategoryId = UserObservationCategoryId;

export interface WeekPatternDay {
  weekdayLabel: string;
  emoji: string;
  categoryLabel: string;
  isToday: boolean;
  hasData: boolean;
}

export interface DailyObservationView {
  show: boolean;
  /** Kısa manşet (6–8 kelime) */
  manset: string;
  userLine: string;
  aiLine: string;
  balanceLine: string;
  supportLine: string;
  signalLevel: string;
  confidenceLabel: string;
  yesterdayLine: string | null;
  weekPattern: WeekPatternDay[];
  showWeekPattern: boolean;
  fridaySummary: string | null;
  /** @deprecated manset + userLine kullan */
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

const TR_WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const;

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

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    return 'Bugünkü etkileşimlerde belirgin bir kullanıcı sinyali gözlemlenmedi.';
  }

  const map: Record<UserObservationCategoryId, string[]> = {
    balanced: [
      'Bugünkü etkileşim dengesi stabil göründü.',
      'Bugünkü konuşmalar genel profilinle uyumlu seyretti.',
    ],
    decision_support: [
      'Bugünkü konuşmalarda daha fazla karar desteği arayışı gözlemlendi.',
      'Bugün bazı sorular karar öncesi netlik arayışı taşıyordu.',
    ],
    clarity_seek: [
      'Bugünkü konuşmalarda daha fazla netlik arayışı gözlemlendi.',
      'Bugün doğrulama ve netlik sinyalleri öne çıktı.',
    ],
    flow_harmony: [
      'Bugünkü konuşmalarda yanıtlarla uyum yüksek seyretti.',
      'Bugün akış uyumu belirgin bir ton taşıdı.',
    ],
    sensitive_signals: [
      'Bugünkü konuşmalarda hassas konu sinyalleri daha belirgin göründü.',
      'Bugün hassas sinyal yoğunluğu dikkat çekti.',
    ],
    safe_balance: [
      'Hassas konu sinyali gözlemlendi.',
      'Bugün girdi tarafında dikkat çeken sinyaller göründü.',
    ],
    question_clarity: [
      'Bugünkü sorular daha doğrudan ve net bir yapıdaydı.',
      'Bugün soru netliği odaklı bir ton seyretti.',
    ],
    exploration: [
      'Bugünkü konuşmalar daha çok fikir geliştirme yönünde ilerledi.',
      'Bugün keşif odaklı bir etkileşim tonu gözlemlendi.',
    ],
    quiet: [
      'Bugün belirgin bir kullanıcı sinyali sapması gözlemlenmedi.',
      'Bugünkü etkileşimler sakin ve dengeli bir çizgide kaldı.',
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
      'AI yanıtları bugün daha açıklayıcı bir çizgide kaldı.',
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
      [
        'Etkileşim akışı dengeli ve uyumlu seyretti.',
        'Etkileşim dengesi stabil kaldı.',
      ],
      `${seed}-bal-flow`
    );
  }
  if (aiCat === 'low_redirect') {
    return 'AI yanıtları yönlendirme etkisini düşük tuttu.';
  }
  if (userCat === 'balanced' || userCat === 'quiet') {
    return pickVariant(
      [
        'Bugünkü etkileşim tonu genel profilinle uyumlu seyretti.',
        'Etkileşim dengesi stabil kaldı.',
      ],
      `${seed}-bal-stable`
    );
  }
  if (userCat === 'decision_support' && (aiCat === 'explanatory' || aiCat === 'high_alignment')) {
    return 'Karar arayışına yanıt tonu uyumlu kaldı.';
  }
  return pickVariant(
    [
      'Etkileşim dengesi stabil kaldı.',
      'Girdi ve yanıt sinyalleri birlikte dengeli göründü.',
    ],
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
    decision_support: ['Bugün karar desteği öne çıktı.', 'Karar arayışı belirginleşti.'],
    clarity_seek: ['Bugün netlik arayışı öne çıktı.'],
    exploration: ['Bugün keşif tonu öne çıktı.'],
    sensitive_signals: ['Hassas sinyal dikkat çekti.'],
    balanced: ['Bugün denge korundu.', 'Dengeli bir gün.'],
    quiet: ['Sakin bir etkileşim günü.'],
  };
  const variants = short[userCat];
  if (variants) return pickVariant(variants, `${seed}-m-user`);
  if (aiCat === 'safe_boundary' || aiCat === 'sensitive_balance') {
    return 'Yanıtlar güvenli çizgide kaldı.';
  }
  return pickVariant(['Bugünkü etkileşim özeti hazır.', 'Günün gözlemi oluştu.'], `${seed}-m-fb`);
}

function signalLevelLabel(userCat: UserObservationCategoryId, todayCount: number): string {
  if (todayCount < 2) return 'Ön gözlem';
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

function groupEntriesByDay(
  entries: SavedBehavioralEntry[]
): Map<string, SavedBehavioralEntry[]> {
  const map = new Map<string, SavedBehavioralEntry[]>();
  for (const e of entries) {
    const key = dayKey(e.savedAt);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}

function last7CalendarDays(): { key: string; weekdayLabel: string; isToday: boolean }[] {
  const out: { key: string; weekdayLabel: string; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today.toISOString());

  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const key = dayKey(d.toISOString());
    out.push({
      key,
      weekdayLabel: TR_WEEKDAYS[d.getDay()]!,
      isToday: key === todayKey,
    });
  }
  return out;
}

function interactionDayLabel(entries: SavedBehavioralEntry[]): string {
  const userCat = classifyDayFromEntries(entries);
  if (userCat === 'safe_balance') return USER_CATEGORY_LABEL.safe_balance;
  return USER_CATEGORY_LABEL[userCat];
}

function buildFridaySummary(
  pattern: WeekPatternDay[],
  entries: SavedBehavioralEntry[]
): string | null {
  const now = new Date();
  if (now.getDay() !== 5) return null;

  const counts = new Map<string, number>();
  for (const day of pattern) {
    if (!day.hasData || day.categoryLabel === USER_CATEGORY_LABEL.quiet) continue;
    counts.set(day.categoryLabel, (counts.get(day.categoryLabel) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const parts: string[] = [];
  if (ranked.length) {
    parts.push(
      `Bu hafta en sık görülen: ${ranked.map(([label, n]) => `${label} — ${n} gün`).join(' · ')}`
    );
  }

  const weekEntries = entries.filter((e) => {
    const t = new Date(e.savedAt).getTime();
    return t >= Date.now() - 7 * 24 * 60 * 60 * 1000;
  });
  if (weekEntries.length >= 3) {
    const aiCats = weekEntries.reduce((acc, e) => {
      const dayKeyForE = dayKey(e.savedAt);
      if (!acc.has(dayKeyForE)) {
        const dayE = weekEntries.filter((x) => dayKey(x.savedAt) === dayKeyForE);
        acc.set(dayKeyForE, classifyAiFromEntries(dayE));
      }
      return acc;
    }, new Map<string, AiBehaviorCategoryId>());

    const safeAiDays = Array.from(aiCats.values()).filter(
      (c) =>
        c === 'safe_boundary' ||
        c === 'sensitive_balance' ||
        c === 'balanced_refusal' ||
        c === 'neutral_tone'
    ).length;
    if (safeAiDays >= 3) {
      parts.push('AI yanıtları hafta boyunca dengeli çizgide kaldı.');
    }
  }

  return parts.length ? parts.join(' ') : null;
}

function buildMirrorObservation(
  todayEntries: SavedBehavioralEntry[],
  seed: string,
  sampleCountTotal: number,
  confidencePct: number | null
): Omit<DailyObservationView, 'show' | 'yesterdayLine' | 'weekPattern' | 'showWeekPattern' | 'fridaySummary'> {
  const m = metricsFromEntries(todayEntries);
  const userCat = classifyDayFromEntries(todayEntries);
  const aiCat = classifyAiFromEntries(todayEntries);
  const daySeed = `${seed}-${dayKey(new Date().toISOString())}`;

  return {
    manset: mansetForObservation(userCat, aiCat, m, daySeed),
    userLine: userLineForCategory(userCat, m, daySeed),
    aiLine: aiLineForCategory(aiCat, m, daySeed),
    balanceLine: balanceLineForPair(userCat, aiCat, m, daySeed),
    supportLine: 'Bu gözlem bugünkü soru yapısı, AI yanıt tonu ve etkileşim dengesine dayanır.',
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
  const byDay = groupEntriesByDay(entries);
  const todayKey = dayKey(new Date().toISOString());
  const todayEntries = byDay.get(todayKey) ?? [];

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = dayKey(yesterdayDate.toISOString());
  const yesterdayEntries = byDay.get(yesterdayKey) ?? [];

  if (entries.length === 0) return { ...EMPTY_VIEW };

  const calendar = last7CalendarDays();
  const weekPattern: WeekPatternDay[] = calendar.map((day) => {
    const dayEntries = byDay.get(day.key) ?? [];
    const label =
      dayEntries.length > 0 ? interactionDayLabel(dayEntries) : 'Veri yok';
    const userCat =
      dayEntries.length > 0 ? classifyDayFromEntries(dayEntries) : ('quiet' as UserObservationCategoryId);
    return {
      weekdayLabel: day.weekdayLabel,
      emoji: dayEntries.length > 0 ? OBSERVATION_CATEGORY_EMOJI[userCat] : '·',
      categoryLabel: label,
      isToday: day.isToday,
      hasData: dayEntries.length > 0,
    };
  });

  const yesterdayCategory =
    yesterdayEntries.length > 0 ? classifyDayFromEntries(yesterdayEntries) : null;

  const mirror =
    todayEntries.length > 0
      ? buildMirrorObservation(todayEntries, seed, entries.length, options?.confidencePct ?? null)
      : {
          ...buildMirrorObservation([], seed, entries.length, options?.confidencePct ?? null),
          manset: 'Bugün henüz kayıtlı etkileşim yok.',
          userLine: 'Bugünkü etkileşimlerde belirgin bir kullanıcı sinyali gözlemlenmedi.',
          supportLine: 'Yeni konuşmalar başladığında bugünkü gözlem burada güncellenir.',
        };

  return {
    show: true,
    ...mirror,
    yesterdayLine:
      yesterdayCategory !== null
        ? `Dün: ${USER_CATEGORY_LABEL[yesterdayCategory]}`
        : null,
    weekPattern,
    showWeekPattern: entries.length >= 3,
    fridaySummary: buildFridaySummary(weekPattern, entries),
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
      : 'Bugünkü etkileşimler sakin bir çizgide seyretti.';

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
