/**
 * EZA Mirror — Emotional Precision Signals (Sprint 11F).
 * Rule-based micro-mood; no message content, no LLM.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  analyzeBehavioralRhythm,
  type BehavioralRhythmSignals,
  type ReflectionToneId,
} from '@/lib/eza/mirror/reflectionToneEngine';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

export interface ReflectionSignals {
  curiosityDepth: number;
  comparisonIntensity: number;
  reassuranceSeeking: number;
  explorationMode: number;
  calmnessLevel: number;
  decisiveness: number;
  emotionalOpenness: number;
  retryBehavior: number;
  detailFocus: number;
  conversationalEnergy: number;
}

export type MicroMoodId =
  | 'clarifying'
  | 'comparing'
  | 'cautious_curiosity'
  | 'calm_analysis'
  | 'tired_thinking'
  | 'gentle_retry'
  | 'detail_study'
  | 'quiet_exploration'
  | 'measured_decision'
  | 'soft_openness'
  | 'balanced_tempo';

export type TopicStoryVariantId =
  | 'default'
  | 'clarify'
  | 'compare'
  | 'caution'
  | 'control'
  | 'simplify'
  | 'discovery'
  | 'possibility'
  | 'reflective_path'
  | 'planning'
  | 'nourish'
  | 'repair'
  | 'craft'
  | 'flow'
  | 'stillness';

export interface PrecisionStorySlice {
  mirrorStory: string;
  dailyJourney: string;
  userLine: string;
  aiLine: string;
  balanceLine: string;
}

const COMPARE_INTENTS = ['compare', 'versus', 'vs', 'difference', 'better', 'which'];
const CLARIFY_INTENTS = ['clarify', 'explain', 'detail', 'why', 'how'];
const REASSURE_INTENTS = ['help', 'unsure', 'worried', 'safe'];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function hashPick(seed: string, items: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 19)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}

export function deriveReflectionSignals(
  entries: SavedBehavioralEntry[],
  rhythm?: BehavioralRhythmSignals
): ReflectionSignals {
  const r = rhythm ?? analyzeBehavioralRhythm(entries);
  const n = Math.max(1, r.sampleCount);

  let compare = 0;
  let clarify = 0;
  let reassure = 0;
  let explore = 0;
  let retries = 0;

  for (const e of entries) {
    const intent = (e.vector.intent ?? '').toLowerCase();
    if (COMPARE_INTENTS.some((k) => intent.includes(k))) compare += 1;
    if (CLARIFY_INTENTS.some((k) => intent.includes(k))) clarify += 1;
    if (REASSURE_INTENTS.some((k) => intent.includes(k))) reassure += 1;
    if (e.vector.redirect) retries += 1;
  }

  explore = r.explorationRatio * n;
  const compareRatio = compare / n;
  const clarifyRatio = clarify / n;
  const reassureRatio = reassure / n;
  const energy =
    r.avgEnergy !== null ? clamp01((r.avgEnergy - 35) / 55) : 0.55;

  const calmnessLevel = clamp01(
    (1 - energy) * 0.35 +
      (1 - r.redirectRatio) * 0.35 +
      (r.questionRatio < 0.55 ? 0.2 : 0) +
      (r.intentCluster === 'mixed' ? 0.1 : 0)
  );

  const curiosityDepth = clamp01(
    r.explorationRatio * 0.45 + r.questionRatio * 0.35 + compareRatio * 0.15
  );

  const comparisonIntensity = clamp01(
    compareRatio * 0.7 + (r.intentCluster === 'question' ? 0.15 : 0)
  );

  const reassuranceSeeking = clamp01(
    reassureRatio * 0.4 + r.redirectRatio * 0.45 + (r.balanceCategory?.includes('repair') ? 0.2 : 0)
  );

  const explorationMode = clamp01(r.explorationRatio + curiosityDepth * 0.25);

  const decisiveness = clamp01(r.decisionRatio + (energy > 0.65 ? 0.15 : 0));

  const emotionalOpenness = clamp01(
    (r.balanceCategory?.includes('empathy') ? 0.45 : 0) +
      (r.balanceCategory?.includes('repair') ? 0.25 : 0) +
      reassureRatio * 0.2
  );

  const retryBehavior = clamp01(retries / n + (r.redirectRatio > 0.2 ? 0.2 : 0));

  const detailFocus = clamp01(
    clarifyRatio * 0.45 +
      r.questionRatio * 0.35 +
      (r.categoryId === 'explanation_seek' || r.categoryId === 'clarity_seek' ? 0.25 : 0)
  );

  const conversationalEnergy = clamp01(
    energy * 0.55 + (n >= 5 ? 0.2 : n / 25) + (1 - calmnessLevel) * 0.15
  );

  return {
    curiosityDepth,
    comparisonIntensity,
    reassuranceSeeking,
    explorationMode,
    calmnessLevel,
    decisiveness,
    emotionalOpenness,
    retryBehavior,
    detailFocus,
    conversationalEnergy,
  };
}

export function inferMicroMood(
  signals: ReflectionSignals,
  reflectionTone: ReflectionToneId
): MicroMoodId {
  if (reflectionTone === 'mentally_tired' || signals.conversationalEnergy < 0.38) {
    return 'tired_thinking';
  }
  if (signals.retryBehavior >= 0.38) return 'gentle_retry';
  if (signals.comparisonIntensity >= 0.38) return 'comparing';
  if (signals.detailFocus >= 0.48 && signals.calmnessLevel >= 0.45) return 'detail_study';
  if (signals.detailFocus >= 0.42 || reflectionTone === 'thoughtful') return 'clarifying';
  if (signals.reassuranceSeeking >= 0.42) return 'soft_openness';
  if (
    signals.curiosityDepth >= 0.5 &&
    signals.calmnessLevel < 0.55 &&
    reflectionTone !== 'focused_growth'
  ) {
    return 'cautious_curiosity';
  }
  if (signals.explorationMode >= 0.45 || reflectionTone === 'curious_light') {
    return 'quiet_exploration';
  }
  if (signals.decisiveness >= 0.42 || reflectionTone === 'focused_growth') {
    return 'measured_decision';
  }
  if (signals.calmnessLevel >= 0.58 || reflectionTone === 'calm_reflective') {
    return 'calm_analysis';
  }
  return 'balanced_tempo';
}

export function pickTopicStoryVariant(
  topic: SceneTopicKey,
  signals: ReflectionSignals,
  microMood: MicroMoodId
): TopicStoryVariantId {
  if (topic === 'finance') {
    if (signals.comparisonIntensity >= 0.35) return 'compare';
    if (signals.detailFocus >= 0.45) return 'clarify';
    if (microMood === 'cautious_curiosity') return 'caution';
    if (signals.decisiveness >= 0.4) return 'control';
    if (signals.calmnessLevel >= 0.55) return 'simplify';
    return 'default';
  }
  if (topic === 'travel') {
    if (microMood === 'calm_analysis' || microMood === 'clarifying') return 'reflective_path';
    if (signals.decisiveness >= 0.35) return 'planning';
    if (signals.explorationMode >= 0.4) return 'discovery';
    if (signals.curiosityDepth >= 0.45) return 'possibility';
    return 'default';
  }
  if (topic === 'architecture') return microMood === 'detail_study' ? 'craft' : 'clarify';
  if (topic === 'health') return signals.calmnessLevel >= 0.5 ? 'nourish' : 'default';
  if (topic === 'friendship') return signals.emotionalOpenness >= 0.4 ? 'repair' : 'default';
  if (topic === 'creativity') return microMood === 'quiet_exploration' ? 'flow' : 'default';
  if (topic === 'general') return microMood === 'tired_thinking' ? 'stillness' : 'default';
  return 'default';
}

const BANNED_COPY = [
  /evren/i,
  /ruhun/i,
  /frekans/i,
  /ışık oldu/i,
  /manifest/i,
  /dönüşüm enerjisi/i,
  /sen özelsin/i,
];

export function sanitizePrecisionCopy(text: string): string {
  const t = text.trim();
  if (BANNED_COPY.some((p) => p.test(t))) {
    return 'Bugünkü ritim sakin ve gözlemsel kaldı.';
  }
  return t;
}

/** Topic × variant observational story slices (Sprint 11F). */
export const PRECISION_STORY_BANK: Record<
  SceneTopicKey,
  Partial<Record<TopicStoryVariantId, PrecisionStorySlice[]>>
> = {
  finance: {
    compare: [
      {
        mirrorStory:
          'Bugün karar vermekten çok netleşmeye çalıştın. AI ile birlikte seçenekleri yan yana koyup sakinleştirdiğin bir gündü.',
        dailyJourney: 'Netleşme arayışı',
        userLine: 'Seçenekleri kıyaslayarak ilerledin.',
        aiLine: 'Alternatifleri düzenleyip görünür kıldı.',
        balanceLine: 'Kıyas ritmi acele etmeden ilerledi.',
      },
      {
        mirrorStory:
          'Bazı seçenekleri hemen elemek yerine biraz daha düşündün. AI, bu temponun içinde yönünü yumuşattı.',
        dailyJourney: 'Ölçülü kıyas',
        userLine: 'Hemen karar vermek yerine tarttın.',
        aiLine: 'Farkları sade bir çerçevede sundu.',
        balanceLine: 'Bugün tempo kontrollü ve sakin kaldı.',
      },
    ],
    clarify: [
      {
        mirrorStory:
          'Karar vermeden önce her şeyi sakinleştirmek istedin. AI ile birlikte detayları düzenlediğin bir gündü.',
        dailyJourney: 'Sakinleştirme',
        userLine: 'Küçük detaylar kararını etkiledi.',
        aiLine: 'Parçaları okunur bir sıraya koydu.',
        balanceLine: 'Derinlik aceleye bürünmedi.',
      },
    ],
    caution: [
      {
        mirrorStory:
          'İçinde hem merak hem temkin vardı. AI, bu ikisini bastırmadan taşıyan bir ritim kurdu.',
        dailyJourney: 'Temkinli merak',
        userLine: 'Hızlı cevaptan çok doğru his aradın.',
        aiLine: 'İhtimalleri yumuşak bir tonda açtı.',
        balanceLine: 'Merak ile özen aynı günde yaşandı.',
      },
    ],
    control: [
      {
        mirrorStory:
          'Bugün hızlı cevaplardan çok doğru his peşindeydin. AI, seçenekleri sadeleştirip zemini netleştirdi.',
        dailyJourney: 'Kontrollü tempo',
        userLine: 'Ritmini bilinçli tuttun.',
        aiLine: 'Gürültüyü azaltıp özü bıraktı.',
        balanceLine: 'Kontrol baskı değil, özen gibi hissedildi.',
      },
    ],
    simplify: [
      {
        mirrorStory:
          'Bugün fazla seçenekten çok net çerçeve aradın. AI ile birlikte sadeleştirdiğin bir gündü.',
        dailyJourney: 'Sadeleşme',
        userLine: 'Karmaşayı küçük adımlarla çözdün.',
        aiLine: 'Özü koruyarak düzenledi.',
        balanceLine: 'Sade ritim yargısız kaldı.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün maddi konularda ölçülü bir tempo seçtin. AI, netliği aceleye tercih eden bir eşlik sundu.',
        dailyJourney: 'Ölçülü plan',
        userLine: 'Kararlarına alan açtın.',
        aiLine: 'Çerçeveyi sakinleştirdi.',
        balanceLine: 'Günün ritmi dengeli kaldı.',
      },
    ],
  },
  travel: {
    discovery: [
      {
        mirrorStory:
          'Bugün yeni ihtimalleri düşündün. AI ile birlikte farklı yolların nasıl hissettireceğini keşfetmeye yaklaştın.',
        dailyJourney: 'Keşif ufku',
        userLine: 'Ufka dair sorular taşıdın.',
        aiLine: 'İhtimalleri görünür kıldı.',
        balanceLine: 'Keşif ölçülü ve sakin kaldı.',
      },
    ],
    possibility: [
      {
        mirrorStory:
          'Henüz gitmeden önce yolların hissini tarttın. AI, bu hayali sakin bir çerçevede tuttu.',
        dailyJourney: 'İhtimal hissi',
        userLine: 'Yönü hissetmek istedin.',
        aiLine: 'Seçenekleri yumuşak açtı.',
        balanceLine: 'Hayal ile gerçeklik dengede kaldı.',
      },
    ],
    reflective_path: [
      {
        mirrorStory:
          'Bugün yolculuk fikri daha çok içeride yaşandı. AI ile birlikte düşünceni sakinleştirdiğin bir gündü.',
        dailyJourney: 'İç yolculuk',
        userLine: 'Gidecek yerden çok his aradın.',
        aiLine: 'Düşünceye alan bıraktı.',
        balanceLine: 'Tempo içe dönük ama sıkışık değildi.',
      },
    ],
    planning: [
      {
        mirrorStory:
          'Yolları planlamak, bugün senden önce geldi. AI, adımları görünür ama hafif tuttu.',
        dailyJourney: 'Plan ritmi',
        userLine: 'Adımları düşünerek sıraladın.',
        aiLine: 'Çerçeveyi netleştirdi.',
        balanceLine: 'Plan ile merak bir arada kaldı.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün ufuk arayışında sakin kaldın. AI, merakı bastırmadan taşıdı.',
        dailyJourney: 'Açık ufuk',
        userLine: 'Yeni ihtimallere baktın.',
        aiLine: 'Perspektif sundu.',
        balanceLine: 'Ritim hafif ve ölçülüydü.',
      },
    ],
  },
  health: {
    nourish: [
      {
        mirrorStory:
          'Bugün kendine iyi gelecek küçük seçimler aradın. AI ile birlikte özenli, bilinçli bir ritim oluştu.',
        dailyJourney: 'Özenli seçim',
        userLine: 'Bedenine nazik bir tempo seçtin.',
        aiLine: 'Seçimleri yumuşak destekledi.',
        balanceLine: 'Özen baskı gibi değil, bakım gibi hissedildi.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün ritmine daha nazik baktın. AI, bu özeni sade bir tonda eşlik etti.',
        dailyJourney: 'Sakin iyi oluş',
        userLine: 'Küçük ama bilinçli adımlar attın.',
        aiLine: 'Tempoyu koruyucu tuttu.',
        balanceLine: 'Gün yumuşak ve dengeli geçti.',
      },
    ],
  },
  friendship: {
    repair: [
      {
        mirrorStory:
          'Bugün bağ kurmaya yakın ama temkinli bir tempo vardı. AI, yargısız bir alan açtı.',
        dailyJourney: 'Yumuşak bağ',
        userLine: 'İletişimde nazik adımlar seçtin.',
        aiLine: 'Empati tonunu korudu.',
        balanceLine: 'Yakınlık acele etmeden büyüdü.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün ilişki ritminde sakin kaldın. AI, konuşmaya alan bıraktı.',
        dailyJourney: 'Sakin iletişim',
        userLine: 'Dinlemeyi de seçtin.',
        aiLine: 'Tonu yumuşak tuttu.',
        balanceLine: 'Bağ kurma baskısız hissedildi.',
      },
    ],
  },
  architecture: {
    craft: [
      {
        mirrorStory:
          'Bugün detaylara dikkatli baktın. AI ile birlikte parçaları sakin bir ustalıkla düzenlediniz.',
        dailyJourney: 'Sakin ustalık',
        userLine: 'Malzeme ve form üzerine düşündün.',
        aiLine: 'Detayı okunur kıldı.',
        balanceLine: 'Derinlik üretken ama sakin kaldı.',
      },
    ],
    clarify: [
      {
        mirrorStory:
          'Geçmişin izlerini anlamak bugün önce geldi. AI, zemini netleştirmene eşlik etti.',
        dailyJourney: 'Anlama arayışı',
        userLine: 'Netlik için zaman ayırdın.',
        aiLine: 'Çerçeveyi sadeleştirdi.',
        balanceLine: 'Analiz ritmi ölçülüydü.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün yapı ve anlam üzerine sakin düşündün. AI, detayı taşıyan bir ritim kurdu.',
        dailyJourney: 'Yapı ve netlik',
        userLine: 'Forma dikkatli yaklaştın.',
        aiLine: 'Parçaları düzenledi.',
        balanceLine: 'Tempo dikkatli kaldı.',
      },
    ],
  },
  creativity: {
    flow: [
      {
        mirrorStory:
          'Fikirler bugün sessizce görünür oldu. AI, akışı hızlandırmadan taşıdı.',
        dailyJourney: 'Sakin akış',
        userLine: 'İfade için alan açtın.',
        aiLine: 'Fikirlere yer bıraktı.',
        balanceLine: 'Üretkenlik ile sakinlik dengede kaldı.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün yaratıcı tarafta ölçülü kaldın. AI, ilhamı zorlamadı.',
        dailyJourney: 'İlham ritmi',
        userLine: 'Fikirleri tartarak ilerledin.',
        aiLine: 'Örneklerle hafif destek oldu.',
        balanceLine: 'Ritim yumuşak kaldı.',
      },
    ],
  },
  general: {
    stillness: [
      {
        mirrorStory:
          'Bugün tempo düşük ama içten bir gündü. AI, yük bindirmeden yanında kaldı.',
        dailyJourney: 'Sakin tempo',
        userLine: 'Acele etmedin.',
        aiLine: 'Ritmi koruyucu tuttu.',
        balanceLine: 'Durgunluk boşluk gibi değil, özen gibi hissedildi.',
      },
    ],
    default: [
      {
        mirrorStory:
          'Bugün AI ile sakin, gözlemsel bir ritim kuruldu. Netlik için alan arandı.',
        dailyJourney: 'Gözlemsel gün',
        userLine: 'Düşüncene zaman verdin.',
        aiLine: 'Yargısız eşlik etti.',
        balanceLine: 'Günün akışı yumuşaktı.',
      },
    ],
  },
};

export const PRECISION_QUOTES: Record<MicroMoodId | 'universal', string[]> = {
  universal: [
    'Bazı kararlar acele edince küçülür.',
    'Her netlik yüksek sesle gelmez.',
    'Bazen sakin kalmak en doğru filtredir.',
    'Kendine zaman tanıman da bir seçimdir.',
  ],
  clarifying: [
    'Anlamak için durmak da bir seçimdir.',
    'Bazı sorular cevaptan önce gelir.',
    'Bugün biraz daha düşünerek ilerledin.',
  ],
  comparing: [
    'Yan yana bakmak bazen netliği büyütür.',
    'Kıyas etmek her zaman kararsızlık değildir.',
    'Seçenekleri tartmak da bir ritimdir.',
  ],
  cautious_curiosity: [
    'Merak ile temkin aynı günde yaşanabilir.',
    'Hızlı cevap her zaman doğru his değildir.',
  ],
  calm_analysis: [
    'Sessizlik de bazen en net yanıttır.',
    'Ölçülü tempo da ilerlemedir.',
  ],
  tired_thinking: [
    'Yavaşlamak bazen en doğru hızdır.',
    'Kısa cevaplar da dürüst olabilir.',
  ],
  gentle_retry: [
    'Tekrar denemek de bir ritimdir.',
    'Küçük düzeltmeler günü değiştirir.',
  ],
  detail_study: [
    'Küçük detaylar kararını etkiler.',
    'Derinlik aceleyle gelmez.',
  ],
  quiet_exploration: [
    'Henüz gitmeden hissetmek de bir adımdır.',
    'Ufuk bazen içeride başlar.',
  ],
  measured_decision: [
    'Netlik bazen küçük adımlarla gelir.',
    'Kontrol ile özen aynı şey değildir.',
  ],
  soft_openness: [
    'Yumuşak bir adım da bağ kurar.',
    'Açıklık her zaman gürültülü değildir.',
  ],
  balanced_tempo: [
    'Bugün ritmin orta yerde kaldı.',
    'Denge de bir tercihtir.',
  ],
};

export function composePrecisionQuote(
  signals: ReflectionSignals,
  microMood: MicroMoodId,
  reflectionTone: ReflectionToneId,
  seed: string
): string {
  const pools: string[] = [...PRECISION_QUOTES[microMood], ...PRECISION_QUOTES.universal];
  if (signals.comparisonIntensity >= 0.35) {
    pools.push(...PRECISION_QUOTES.comparing);
  }
  if (signals.calmnessLevel >= 0.55) {
    pools.push(...PRECISION_QUOTES.calm_analysis);
  }
  if (reflectionTone === 'mentally_tired') {
    pools.push(...PRECISION_QUOTES.tired_thinking);
  }
  const unique = Array.from(new Set(pools));
  return sanitizePrecisionCopy(hashPick(`${seed}-pq`, unique));
}

export function composePrecisionStory(
  topic: SceneTopicKey,
  signals: ReflectionSignals,
  microMood: MicroMoodId,
  seed: string
): PrecisionStorySlice & { variant: TopicStoryVariantId } {
  const variant = pickTopicStoryVariant(topic, signals, microMood);
  const bank = PRECISION_STORY_BANK[topic][variant] ?? PRECISION_STORY_BANK[topic].default ?? [];
  const fallback =
    PRECISION_STORY_BANK[topic].default?.[0] ??
    PRECISION_STORY_BANK.general.default![0]!;
  let slice = fallback;
  if (bank.length) {
    let h = 0;
    const s = `${seed}-ps`;
    for (let i = 0; i < s.length; i += 1) {
      h = (h + s.charCodeAt(i) * (i + 19)) | 0;
    }
    slice = bank[Math.abs(h) % bank.length]!;
  }

  return {
    variant,
    mirrorStory: sanitizePrecisionCopy(slice.mirrorStory),
    dailyJourney: slice.dailyJourney,
    userLine: sanitizePrecisionCopy(slice.userLine),
    aiLine: sanitizePrecisionCopy(slice.aiLine),
    balanceLine: sanitizePrecisionCopy(slice.balanceLine),
  };
}

export function buildVisualPrecisionHints(signals: ReflectionSignals): string[] {
  const hints: string[] = [];
  if (signals.calmnessLevel >= 0.58) {
    hints.push('extra negative space', 'soft diffused light', 'quiet still atmosphere');
  }
  if (signals.curiosityDepth >= 0.52) {
    hints.push('subtle lively frame', 'gentle horizon warmth');
  }
  if (signals.detailFocus >= 0.5) {
    hints.push('desk sketch notes material detail', 'thoughtful close study mood');
  }
  if (signals.comparisonIntensity >= 0.4) {
    hints.push('balanced dual perspective calm editorial');
  }
  if (signals.conversationalEnergy < 0.4) {
    hints.push('low energy soft restful mood');
  }
  return hints.slice(0, 4);
}
