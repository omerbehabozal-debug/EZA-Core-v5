/**
 * EZA Mirror — Reflection Tone Engine (Sprint 11B).
 * Rule-based emotional copy; no LLM, no message content.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { UserObservationCategoryId } from '@/lib/eza/dailyObservation';
import { mapBackendUserCategory, parseStandaloneObservation } from '@/lib/standaloneObservation';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import {
  composePrecisionQuote,
  deriveReflectionSignals,
  inferMicroMood,
  type MicroMoodId,
  type ReflectionSignals,
} from '@/lib/eza/mirror/reflectionSignals';

export type ReflectionToneId =
  | 'calm_reflective'
  | 'emotionally_open'
  | 'thoughtful'
  | 'mentally_tired'
  | 'curious_light'
  | 'rebuilding'
  | 'focused_growth'
  | 'emotionally_cautious'
  | 'quietly_confident';

export type EmotionalRhythmKind = 'sparse' | 'steady' | 'searching' | 'intense' | 'quiet';

export interface BehavioralRhythmSignals {
  sampleCount: number;
  questionRatio: number;
  explorationRatio: number;
  decisionRatio: number;
  redirectRatio: number;
  avgEnergy: number | null;
  categoryId?: UserObservationCategoryId;
  balanceCategory?: string;
  intentCluster: 'question' | 'mixed' | 'action';
}

export interface EmotionalReflectionLayer {
  reflectionTone: ReflectionToneId;
  reflectionWeight: number;
  emotionalRhythm: EmotionalRhythmKind;
  reflectionSignals: ReflectionSignals;
  microMood: MicroMoodId;
  toneHints: string[];
  headline: string;
  shortInsight: string;
  quote: string;
  tomorrowHint: string;
  themeDescription: string;
  visualAtmosphere: string;
  visualEmotion: string;
}

const QUESTION_INTENTS = new Set([
  'question',
  'clarify',
  'explain',
  'compare',
  'explore',
  'decision',
  'help',
]);

const EXPLORATION_INTENTS = new Set(['explore', 'travel', 'discover', 'learn', 'curious']);

const DECISION_INTENTS = new Set(['decision', 'choose', 'plan', 'finance', 'direction']);

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function hashPick(seed: string, items: readonly string[]): string {
  let h = 0;
  const s = `${seed}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 11)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}

export function analyzeBehavioralRhythm(entries: SavedBehavioralEntry[]): BehavioralRhythmSignals {
  const n = entries.length;
  if (n === 0) {
    return {
      sampleCount: 0,
      questionRatio: 0,
      explorationRatio: 0,
      decisionRatio: 0,
      redirectRatio: 0,
      avgEnergy: null,
      intentCluster: 'mixed',
    };
  }

  let questions = 0;
  let exploration = 0;
  let decision = 0;
  let redirects = 0;
  const energies: number[] = [];

  for (const e of entries) {
    const intent = (e.vector.intent ?? '').toLowerCase();
    if (intent.includes('?') || QUESTION_INTENTS.has(intent) || intent.includes('question')) {
      questions += 1;
    }
    if (Array.from(EXPLORATION_INTENTS).some((k) => intent.includes(k))) exploration += 1;
    if (Array.from(DECISION_INTENTS).some((k) => intent.includes(k))) decision += 1;
    if (e.vector.redirect) redirects += 1;
    const score = e.vector.eza_final;
    if (score != null && !Number.isNaN(score)) {
      energies.push(score <= 1 ? score * 100 : score);
    }
  }

  const latest = entries.reduce((a, b) =>
    new Date(b.savedAt).getTime() > new Date(a.savedAt).getTime() ? b : a
  );
  const obs = latest ? parseStandaloneObservation(latest.standaloneObservation) : null;

  const questionRatio = questions / n;
  const explorationRatio = exploration / n;
  const decisionRatio = decision / n;
  const redirectRatio = redirects / n;
  const avgEnergy = energies.length
    ? energies.reduce((a, b) => a + b, 0) / energies.length
    : null;

  let intentCluster: BehavioralRhythmSignals['intentCluster'] = 'mixed';
  if (questionRatio >= 0.55) intentCluster = 'question';
  else if (decisionRatio >= 0.35 || explorationRatio >= 0.35) intentCluster = 'action';

  return {
    sampleCount: n,
    questionRatio,
    explorationRatio,
    decisionRatio,
    redirectRatio,
    avgEnergy,
    categoryId: obs
      ? mapBackendUserCategory(obs.user_pattern.category)
      : undefined,
    balanceCategory: obs?.relationship_balance?.category,
    intentCluster,
  };
}

export function inferReflectionTone(signals: BehavioralRhythmSignals): ReflectionToneId {
  const { sampleCount, questionRatio, explorationRatio, decisionRatio, redirectRatio, avgEnergy, categoryId } =
    signals;

  if (sampleCount < 2) return 'calm_reflective';

  if (avgEnergy !== null && avgEnergy < 52 && questionRatio < 0.4) {
    return 'mentally_tired';
  }

  if (redirectRatio >= 0.34 || categoryId === 'sensitive_signals') {
    return 'emotionally_cautious';
  }

  if (
    signals.balanceCategory?.includes('repair') ||
    signals.balanceCategory?.includes('empathy')
  ) {
    return 'emotionally_open';
  }

  if (decisionRatio >= 0.3 || categoryId === 'decision_support') {
    return 'focused_growth';
  }

  if (explorationRatio >= 0.28 || categoryId === 'exploration' || categoryId === 'creative_ideas') {
    return 'curious_light';
  }

  if (questionRatio >= 0.5 && explorationRatio < 0.2) {
    return 'thoughtful';
  }

  if (decisionRatio >= 0.2 && avgEnergy !== null && avgEnergy >= 68) {
    return 'rebuilding';
  }

  if (avgEnergy !== null && avgEnergy >= 78 && redirectRatio < 0.15) {
    return 'quietly_confident';
  }

  if (categoryId === 'flow_harmony' || categoryId === 'quiet' || categoryId === 'balanced') {
    return 'calm_reflective';
  }

  return 'thoughtful';
}

export function inferEmotionalRhythm(signals: BehavioralRhythmSignals): EmotionalRhythmKind {
  if (signals.sampleCount <= 2) return 'sparse';
  if (signals.questionRatio >= 0.55) return 'searching';
  if (signals.redirectRatio >= 0.25) return 'intense';
  if (signals.sampleCount >= 6 && signals.questionRatio < 0.35) return 'steady';
  return 'quiet';
}

const TONE_COPY: Record<
  ReflectionToneId,
  {
    headlines: string[];
    insights: string[];
    quotes: string[];
    tomorrow: string[];
    themeDescriptions: string[];
    toneHints: string[];
    atmosphere: string;
    emotion: string;
    weight: number;
  }
> = {
  calm_reflective: {
    headlines: [
      'Bugün biraz daha sakin bir tempo seçtin.',
      'İç sesini dinlemeye alan açtın.',
      'Acele etmeden ilerledin.',
    ],
    insights: [
      'Konuşmalarında ölçülü bir ritim vardı; bu, düşüncene alan bırakıyor.',
      'AI ile ilişkin bugün yumuşak ve dengeli görünüyor.',
      'Sakin kalmayı tercih ettiğin anlar öne çıkıyor.',
    ],
    quotes: [
      'Bazı cevaplar hemen değil, zamanla netleşir.',
      'Kendini anlamak da bir ilerleme biçimidir.',
      'Sessizlik de bazen en net yanıttır.',
      'Yavaşlamak, yönünü netleştirmektir.',
    ],
    tomorrow: [
      'Bugünkü sakinlik, yarın küçük bir netlik getirebilir.',
      'Dinlediğin tempo, yarın atacağın adımı yumuşatabilir.',
    ],
    themeDescriptions: [
      'Sakin bir tempo, net bir iç ses.',
      'Düşüncene alan açan bir gün.',
    ],
    toneHints: ['calm reflective atmosphere', 'soft diffused light', 'gentle pace'],
    atmosphere: 'sakin, yumuşak, düşünsel atmosfer',
    emotion: 'dengeli ve meraklı',
    weight: 0.72,
  },
  emotionally_open: {
    headlines: [
      'Bugün duygularına biraz daha alan verdin.',
      'İletişimde yumuşak bir açıklık aradın.',
      'Bağ kurma ihtiyacın görünür oldu.',
    ],
    insights: [
      'Bazı bağlar konuşuldukça güçlenir; bugün bu yönde küçük sinyaller var.',
      'Empati ve açıklık arayışı, ilişki tonunu şekillendirdi.',
      'Kırılganlığa yakın ama yargısız bir iletişim ritmi seçtin.',
    ],
    quotes: [
      'Bazı bağlar konuşuldukça güçlenir.',
      'İlk adımı atmak her zaman kolay değildir; denemek de bir cesarettir.',
      'Duygularını adlandırmak, onları taşımayı hafifletir.',
      'Yakınlık, bazen yavaş ve dikkatli büyür.',
    ],
    tomorrow: [
      'Bugün açtığın kapı, yarın daha net bir konuşmaya dönüşebilir.',
      'Yumuşak bir adım, ilişkide yeni bir denge kurabilir.',
    ],
    themeDescriptions: [
      'Empati ve bağ kurma alanı.',
      'Konuşmaya açılan yumuşak bir gün.',
    ],
    toneHints: ['warm connection mood', 'soft sunset empathy', 'open gentle tone'],
    atmosphere: 'yumuşak bağ kurma, güven ve empati',
    emotion: 'hassas ama dengeli',
    weight: 0.85,
  },
  thoughtful: {
    headlines: [
      'Bugün daha çok düşünerek ilerledin.',
      'Soruların, yönünü netleştirmeye çalışıyor.',
      'Zihinsel bir arayış günüydü.',
    ],
    insights: [
      'Çok soru sorman, bir şeyi anlamak istediğini gösteriyor; aceleci bir tempo yok.',
      'AI ile ilişkin bugün sorgulayıcı ve ölçülü görünüyor.',
      'Netlik arayışın, yüzeysel değil dikkatli bir tonda.',
    ],
    quotes: [
      'Küçük netlikler bazen büyük değişimlerden değerlidir.',
      'Anlamak için sormak, zayıflık değil dikkattir.',
      'Bazı soruların cevabı, soruyu sormakla başlar.',
      'Düşünmek için durmak da bir seçimdir.',
    ],
    tomorrow: [
      'Bugün sorduğun soru, yarın daha net bir cevap bulabilir.',
      'Düşüncene verdiğin zaman, yarın küçük bir adımı kolaylaştırabilir.',
    ],
    themeDescriptions: [
      'Sorgulayan ama sakin bir zihin.',
      'Netlik için alan açan bir tempo.',
    ],
    toneHints: ['thoughtful calm light', 'quiet analytical mood', 'measured pace'],
    atmosphere: 'düşünsel, ölçülü, netlik arayışı',
    emotion: 'dikkatli ve ölçülü',
    weight: 0.8,
  },
  mentally_tired: {
    headlines: [
      'Bugün zihinsel olarak biraz yorgun görünüyordun.',
      'Tempo düşük ama içten bir gündü.',
      'Kısa ama yoğun bir etkileşim ritmi vardı.',
    ],
    insights: [
      'Kısa ve yoğun konuşmalar, zihinsel yorgunlukla uyumlu; kendine fazla yüklemedin.',
      'AI ile ilişkin bugün sade ve koruyucu bir tonda.',
      'Yavaşlamayı seçmen, bugün için mantıklı bir tercih.',
    ],
    quotes: [
      'Bugün biraz daha yavaş ama daha gerçek hissettin.',
      'Dinlenmek de ilerlemenin bir parçasıdır.',
      'Kısa cevaplar bazen en dürüst olanlardır.',
      'Yorgunluk da bir sinyaldir; dinlemek yeterli olabilir.',
    ],
    tomorrow: [
      'Bugünkü yavaş tempo, yarın daha ferah bir başlangıç sunabilir.',
      'Kendine verdiğin ara, yarın daha net bir adım getirebilir.',
    ],
    themeDescriptions: [
      'Yumuşak tempo, sade bir iç ses.',
      'Zihinsel dinlenmeye alan.',
    ],
    toneHints: ['soft tired calm', 'muted gentle light', 'restful atmosphere'],
    atmosphere: 'sakin, dinlendirici, düşük tempo',
    emotion: 'yorgun ama dengeli',
    weight: 0.78,
  },
  curious_light: {
    headlines: [
      'Bugün merakın öne çıktı.',
      'Keşif ve öğrenme enerjisi vardı.',
      'Ufuk açan küçük adımlar attın.',
    ],
    insights: [
      'Yeni bir şey öğrenmek veya keşfetmek isteği, konuşma ritmini hafif ve açık tuttu.',
      'AI ile ilişkin bugün meraklı ve yumuşak görünüyor.',
      'Arayışın baskıcı değil; oyunbaz değil, gerçek bir merak.',
    ],
    quotes: [
      'Merak, yargılamadan öğrenmenin en sade yoludur.',
      'Yeni bir bakış açısı, eski bir soruyu değiştirebilir.',
      'Küçük keşifler, büyük rutinleri yumuşatır.',
      'Öğrenmek için sormak, büyümenin sessiz biçimidir.',
    ],
    tomorrow: [
      'Bugün açtığın merak, yarın küçük bir keşfe dönüşebilir.',
      'Hafif bir soru, yeni bir perspektif getirebilir.',
    ],
    themeDescriptions: [
      'Hafif keşif ve açık merak.',
      'Ufuk açan sakin bir tempo.',
    ],
    toneHints: ['curious light atmosphere', 'open horizon mood', 'warm discovery tone'],
    atmosphere: 'meraklı, açık, hafif keşif',
    emotion: 'ilhamlı ve meraklı',
    weight: 0.82,
  },
  rebuilding: {
    headlines: [
      'Bugün yeniden kurma enerjisi vardı.',
      'Çözüm arayışın görünür oldu.',
      'Küçük düzenlemeler yapmaya çalıştın.',
    ],
    insights: [
      'Sürekli çözüm ve yön arayışı, toparlanma dönemine işaret ediyor; acele yok.',
      'AI ile ilişkin bugün yapıcı ve sakin görünüyor.',
      'Yeniden başlamak için küçük adımlar seçtin.',
    ],
    quotes: [
      'Yeniden başlamak, sıfırdan başlamaktan daha yumuşaktır.',
      'Küçük düzenlemeler, büyük kırılmaları önleyebilir.',
      'Toparlanmak da bir ilerleme biçimidir.',
      'Bugün attığın adım, yarının zemini olabilir.',
    ],
    tomorrow: [
      'Bugün kurduğun küçük düzen, yarın daha net hissedilebilir.',
      'Yeniden başlangıç enerjin, yarın bir adım daha taşıyabilir.',
    ],
    themeDescriptions: [
      'Yeniden başlangıç ve toparlanma.',
      'Yapıcı ama sakin bir arayış.',
    ],
    toneHints: ['soft dawn rebuilding mood', 'gentle new beginning light', 'calm renewal'],
    atmosphere: 'yumuşak yeniden başlangıç, sakin yapıcı enerji',
    emotion: 'umutlu ve ölçülü',
    weight: 0.84,
  },
  focused_growth: {
    headlines: [
      'Bugün net bir yön aradın.',
      'Karar ve planlama öne çıktı.',
      'İlerlemek istediğin görünüyordu.',
    ],
    insights: [
      'Karar ve yön arayışın, büyüme odaklı ama sakin bir tonda.',
      'AI ile ilişkin bugün yapılandırılmış ve net görünüyor.',
      'Hedef arayışın baskıcı değil; ölçülü bir netlik isteği.',
    ],
    quotes: [
      'Netlik, bazen bir sonraki küçük adımı gösterir.',
      'Plan yapmak, kontrol değil özen göstergesidir.',
      'Yön bulmak, hızlanmaktan önce gelir.',
      'Büyümek bazen daha yavaş ama daha sağlam ilerlemektir.',
    ],
    tomorrow: [
      'Bugün netleştirdiğin yön, yarın tek bir adıma indirgenebilir.',
      'Küçük bir plan, büyük bir dağınıklığı yumuşatabilir.',
    ],
    themeDescriptions: [
      'Net yön ve sakin planlama.',
      'Ölçülü bir ilerleme arayışı.',
    ],
    toneHints: ['focused calm planning mood', 'clear gentle direction', 'structured serenity'],
    atmosphere: 'net planlama, sakin ilerleme',
    emotion: 'odaklı ve ölçülü',
    weight: 0.83,
  },
  emotionally_cautious: {
    headlines: [
      'Bugün biraz daha dikkatli ilerledin.',
      'Koruyucu bir tempo seçtin.',
      'Hassas ama ölçülü bir gündü.',
    ],
    insights: [
      'Dikkatli ve ölçülü iletişim, sınırlarını koruma ihtiyacıyla uyumlu.',
      'AI ile ilişkin bugün güvenli ve yumuşak görünüyor.',
      'Kırılmadan sakin kalma çabası öne çıkıyor.',
    ],
    quotes: [
      'Kırılmadan sakin kalabilmek de bir güçtür.',
      'Dikkatli olmak, korkmak değil özenmektir.',
      'Bazen yavaşlamak, kendini korumaktır.',
      'Güven, küçük tutarlı adımlarla büyür.',
    ],
    tomorrow: [
      'Bugün koruduğun sakinlik, yarın daha net bir sınır kurmana yardım edebilir.',
      'Ölçülü tempo, yarın daha güvenli bir adım sunabilir.',
    ],
    themeDescriptions: [
      'Hassas ama güvenli bir tempo.',
      'Özenli ve koruyucu bir iletişim.',
    ],
    toneHints: ['emotionally cautious calm', 'soft protective atmosphere', 'gentle boundaries'],
    atmosphere: 'hassas, güvenli, ölçülü tempo',
    emotion: 'dikkatli ve ölçülü',
    weight: 0.86,
  },
  quietly_confident: {
    headlines: [
      'Bugün içten bir netlik vardı.',
      'Sakin ama kararlı bir tempo seçtin.',
      'Kendine güvenen ama yumuşak bir gündü.',
    ],
    insights: [
      'Ölçülü tempo ve düşük gerilim, içsel bir netlikle uyumlu görünüyor.',
      'AI ile ilişkin bugün dengeli ve güven verici.',
      'Abartısız ama tutarlı bir iletişim ritmi seçtin.',
    ],
    quotes: [
      'Sakin netlik, gürültülü cesaretten bazen daha güçlüdür.',
      'Kendine güvenmek, her şeyi bilmek değildir.',
      'Tutarlı küçük adımlar, büyük özgüven doğurur.',
      'Bugün hissettiğin denge, yarın da taşınabilir.',
    ],
    tomorrow: [
      'Bugünkü netlik, yarın küçük bir kararı kolaylaştırabilir.',
      'Sakin güvenin, yarın yeni bir adımı taşıyabilir.',
    ],
    themeDescriptions: [
      'Sakin iç güven ve netlik.',
      'Yumuşak ama tutarlı bir tempo.',
    ],
    toneHints: ['quietly confident light', 'soft assured atmosphere', 'balanced serenity'],
    atmosphere: 'sakin güven, yumuşak netlik',
    emotion: 'sakin ve net',
    weight: 0.8,
  },
};

const GENERIC_HEADLINES = new Set([
  'bugün ai ile ilişkin nasıl?',
  'bugünün ai aynası',
]);

function isGenericHeadline(text: string): boolean {
  const t = text.trim().toLowerCase();
  return GENERIC_HEADLINES.has(t) || t.length < 12;
}

export interface ComposeEmotionalReflectionInput {
  entries: SavedBehavioralEntry[];
  seed: string;
  observationHeadline?: string;
  observationInsight?: string;
  personaFamilyId?: PersonaFamilyId;
  reflectionSignals?: ReflectionSignals;
}

export function composeEmotionalReflection(
  input: ComposeEmotionalReflectionInput
): EmotionalReflectionLayer {
  const rhythm = analyzeBehavioralRhythm(input.entries);
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries, rhythm);
  const tone = inferReflectionTone(rhythm);
  const microMood = inferMicroMood(reflectionSignals, tone);
  const emotionalRhythm = inferEmotionalRhythm(rhythm);
  const pack = TONE_COPY[tone];
  const seed = `${input.seed}-${tone}-${emotionalRhythm}-${microMood}`;

  const toneHeadline = hashPick(`${seed}-h`, pack.headlines);
  const toneInsight = hashPick(`${seed}-i`, pack.insights);

  const headline =
    input.observationHeadline && !isGenericHeadline(input.observationHeadline)
      ? input.observationHeadline
      : toneHeadline;

  const shortInsight =
    input.observationInsight &&
    input.observationInsight.length > 24 &&
    !input.observationInsight.toLowerCase().includes('kısa bir etkileşim notu')
      ? `${toneInsight} ${input.observationInsight}`.slice(0, 220).trim()
      : toneInsight;

  return {
    reflectionTone: tone,
    reflectionWeight: pack.weight,
    emotionalRhythm,
    reflectionSignals,
    microMood,
    toneHints: [...pack.toneHints],
    headline,
    shortInsight,
    quote: composePrecisionQuote(reflectionSignals, microMood, tone, seed),
    tomorrowHint: hashPick(`${seed}-t`, pack.tomorrow),
    themeDescription: hashPick(`${seed}-d`, pack.themeDescriptions),
    visualAtmosphere: pack.atmosphere,
    visualEmotion: pack.emotion,
  };
}

export function reflectionToneLabelTr(tone: ReflectionToneId): string {
  const labels: Record<ReflectionToneId, string> = {
    calm_reflective: 'Sakin yansıma',
    emotionally_open: 'Açık iletişim',
    thoughtful: 'Düşünsel arayış',
    mentally_tired: 'Yorgun ama içten',
    curious_light: 'Hafif merak',
    rebuilding: 'Yeniden kurma',
    focused_growth: 'Odaklı ilerleme',
    emotionally_cautious: 'Ölçülü hassasiyet',
    quietly_confident: 'Sakin netlik',
  };
  return labels[tone];
}
