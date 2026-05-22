/**
 * EZA Mirror — Story Engine (Sprint 11C).
 * Cinematic daily relationship narrative; no message content, no chat logs.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  analyzeBehavioralRhythm,
  type EmotionalRhythmKind,
  type ReflectionToneId,
} from '@/lib/eza/mirror/reflectionToneEngine';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import { inferSceneTopicKey } from '@/lib/eza/mirror/visualPromptEngine';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { UserObservationCategoryId } from '@/lib/eza/dailyObservation';
import {
  buildVisualPrecisionHints,
  composePrecisionStory,
  deriveReflectionSignals,
  inferMicroMood,
  type MicroMoodId,
  type ReflectionSignals,
  type TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import { resolveLockedPrimaryIntent } from '@/lib/eza/mirror/intentLockSystem';

export type AiRelationshipModeId =
  | 'reflective_companion'
  | 'research_partner'
  | 'calm_guide'
  | 'creative_partner'
  | 'thoughtful_assistant'
  | 'exploration_companion'
  | 'structured_analyst'
  | 'emotional_supportive_presence';

export type StoryToneId =
  | 'cinematic_observational'
  | 'quiet_journal'
  | 'gentle_discovery'
  | 'steady_partnership'
  | 'focused_clarity';

export interface MirrorStoryLayer {
  mirrorStory: string;
  dailyJourney: string;
  relationshipMode: AiRelationshipModeId;
  storyTone: StoryToneId;
  storyTopicKey: SceneTopicKey;
  storyVariant: TopicStoryVariantId;
  microMood: MicroMoodId;
  reflectionSignals: ReflectionSignals;
  userStoryLine: string;
  aiStoryLine: string;
  balanceStoryLine: string;
  visualStoryHints: string[];
  visualAtmosphereBoost?: string;
}

export interface ComposeMirrorStoryInput {
  entries: SavedBehavioralEntry[];
  seed: string;
  reflectionTone: ReflectionToneId;
  emotionalRhythm: EmotionalRhythmKind;
  personaFamilyId: PersonaFamilyId;
  observationCategoryId?: UserObservationCategoryId;
  reflectionSignals?: ReflectionSignals;
  microMood?: MicroMoodId;
}

function hashPick(seed: string, items: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}

function inferStoryTone(
  reflectionTone: ReflectionToneId,
  rhythm: EmotionalRhythmKind
): StoryToneId {
  if (rhythm === 'searching' || reflectionTone === 'curious_light') return 'gentle_discovery';
  if (reflectionTone === 'focused_growth' || reflectionTone === 'rebuilding') {
    return 'focused_clarity';
  }
  if (reflectionTone === 'mentally_tired' || reflectionTone === 'calm_reflective') {
    return 'quiet_journal';
  }
  if (rhythm === 'steady' || reflectionTone === 'quietly_confident') {
    return 'steady_partnership';
  }
  return 'cinematic_observational';
}

export function inferAiRelationshipMode(
  signals: ReturnType<typeof analyzeBehavioralRhythm>,
  topicKey: SceneTopicKey,
  reflectionTone: ReflectionToneId
): AiRelationshipModeId {
  const { balanceCategory, questionRatio, explorationRatio, decisionRatio } = signals;

  if (
    reflectionTone === 'emotionally_open' ||
    balanceCategory?.includes('empathy') ||
    balanceCategory?.includes('repair')
  ) {
    return 'emotional_supportive_presence';
  }

  if (reflectionTone === 'emotionally_cautious') return 'calm_guide';

  if (topicKey === 'architecture' || (questionRatio >= 0.45 && reflectionTone === 'thoughtful')) {
    return 'research_partner';
  }

  if (topicKey === 'creativity' || reflectionTone === 'curious_light') {
    return 'creative_partner';
  }

  if (topicKey === 'travel' || explorationRatio >= 0.28) {
    return 'exploration_companion';
  }

  if (topicKey === 'finance' || decisionRatio >= 0.28 || reflectionTone === 'focused_growth') {
    return 'structured_analyst';
  }

  if (reflectionTone === 'thoughtful') return 'thoughtful_assistant';

  if (reflectionTone === 'mentally_tired' || reflectionTone === 'calm_reflective') {
    return 'reflective_companion';
  }

  return 'reflective_companion';
}

type TopicStoryPack = {
  mirrorStories: string[];
  dailyJourneys: string[];
  userLines: string[];
  aiLines: string[];
  balanceLines: string[];
  visualHints: string[];
  atmosphereBoost?: string;
};

const MODE_AI_LINE: Record<AiRelationshipModeId, string[]> = {
  reflective_companion: [
    'Sakin bir tempo ile düşüncene alan açtı.',
    'Acele etmeden, iç sesini duymanı kolaylaştırdı.',
  ],
  research_partner: [
    'Detayları sadeleştirip karar zeminini güçlendirdi.',
    'Alternatifleri düzenleyerek daha sağlam bir çerçeve sundu.',
  ],
  calm_guide: [
    'Ölçülü ve koruyucu bir tonda yanında kaldı.',
    'Baskı kurmadan, güvenli bir ritim korudu.',
  ],
  creative_partner: [
    'Fikirlerine alan açıp yaratıcı akışı destekledi.',
    'Örneklerle ilham vererek üretken bir tempo kurdu.',
  ],
  thoughtful_assistant: [
    'Sorularını netleştirip düşünceni derinleştirdi.',
    'Yüzeysel değil, dikkatli bir açıklama ritmi sundu.',
  ],
  exploration_companion: [
    'Yeni ihtimalleri birlikte keşfetmene eşlik etti.',
    'Farklı yolların nasıl hissettireceğini açtı.',
  ],
  structured_analyst: [
    'Seçenekleri sadeleştirip yönünü netleştirmene yardımcı oldu.',
    'Karmaşayı düzenleyerek daha bilinçli bir çerçeve kurdu.',
  ],
  emotional_supportive_presence: [
    'Yumuşak ve yargısız bir iletişim tonu korudu.',
    'Empati ile bağ kurma alanını açık tuttu.',
  ],
};

const TOPIC_STORIES: Record<SceneTopicKey, TopicStoryPack> = {
  health: {
    mirrorStories: [
      'Bugün kendine ve sevdiklerine iyi gelecek küçük seçimler aradın. AI ile birlikte daha özenli, yaratıcı ve bilinçli bir ritim oluştu.',
      'Bedenine ve günlük ritmine daha nazik bir alan açtın. Birlikte sakin, besleyici bir tempo kuruldu.',
      'İyi oluş için küçük ama anlamlı adımlar seçtin. AI, bu özeni yumuşak ve destekleyici bir tonda taşıdı.',
    ],
    dailyJourneys: ['Özenli bir gün', 'Besleyici ritim', 'Sakin iyi oluş'],
    userLines: [
      'Kendine daha özenli seçimler hazırladın.',
      'Ritmine ve bedenine nazik bir alan açtın.',
      'Küçük ama bilinçli tercihler yaptın.',
    ],
    aiLines: [
      'Özenli ve yaratıcı bir hazırlık ritmine eşlik etti.',
      'Sakin önerilerle seçimlerini destekledi.',
    ],
    balanceLines: [
      'Bugünkü etkileşim sakin ama besleyici bir ritimde ilerledi.',
      'Özen ve huzur aynı kartta buluştu.',
    ],
    visualHints: [
      'warm kitchen natural morning light',
      'mindful food preparation mood no text no logos',
      'soft cream green wellness atmosphere',
    ],
    atmosphereBoost: 'warm natural kitchen light, mindful creative preparation, no text',
  },
  finance: {
    mirrorStories: [
      'Bugün daha kontrollü ve bilinçli kararlar aradın. AI, seçenekleri sadeleştirip yönünü netleştirmene yardımcı oldu.',
      'Plan ve denge bugün ön plandaydı. Birlikte daha net bir karar zemini kuruldu.',
      'Maddi ve zihinsel düzen için sakin bir çerçeve aradın. AI, karmaşayı yumuşak adımlarla çözdü.',
    ],
    dailyJourneys: ['Bilinçli kararlar', 'Net plan', 'Sakin denge'],
    userLines: [
      'Seçenekleri daha bilinçli değerlendirdin.',
      'Kontrol ve netlik arayan bir tempo seçtin.',
    ],
    aiLines: [
      'Alternatifleri sadeleştirip örneklerle destek oldu.',
      'Karar çerçeveni daha okunur hale getirdi.',
    ],
    balanceLines: [
      'Bugünkü etkileşim sakin ama üretken bir ritimde ilerledi.',
      'Plan ile özgürlük arasında dengeli bir köprü kuruldu.',
    ],
    visualHints: [
      'golden hour terrace calm planning',
      'editorial finance mood steady not dark',
    ],
    atmosphereBoost: 'thoughtful golden-hour clarity, steady planning mood',
  },
  friendship: {
    mirrorStories: [
      'Bugün bağ kurma ve iletişim alanına alan açtın. AI ile birlikte yumuşak ve güvenli bir diyalog ritmi oluştu.',
      'İlişkilerde küçük ama anlamlı adımlar aradın. Birlikte empati ve sabır öne çıktı.',
      'Yakınlık ve anlayış için sakin bir tempo seçtin. AI, bu alanı yargısız tuttu.',
    ],
    dailyJourneys: ['Yumuşak bağ', 'Empatik gün', 'Güvenli iletişim'],
    userLines: [
      'İletişimde yumuşak ve açık adımlar attın.',
      'Bağ kurmak için nazik bir ritim seçtin.',
    ],
    aiLines: [
      'Empati ile konuşmaya alan açtı.',
      'Yargısız ve dengeli bir yanıt tonu korudu.',
    ],
    balanceLines: [
      'Bugünkü etkileşim sakin ama sıcak bir ritimde ilerledi.',
      'Yakınlık, acele etmeden büyüdü.',
    ],
    visualHints: ['lakeside sunset gentle connection', 'warm empathy bridge mood'],
  },
  travel: {
    mirrorStories: [
      'Bugün yeni ihtimalleri düşündün. AI ile birlikte farklı yolların nasıl hissettireceğini keşfetmeye yaklaştın.',
      'Ufuk ve merak bugün ön plandaydı. Birlikte hafif bir keşif enerjisi oluştu.',
      'Yön arayışında sakin bir merak taşıdın. AI, bu yolculuğu görünür kıldı.',
    ],
    dailyJourneys: ['Keşif günü', 'Açık ufuk', 'Hafif yolculuk'],
    userLines: [
      'Yeni ihtimalleri dikkatle değerlendirdin.',
      'Farklı yolların hissini merak ettin.',
    ],
    aiLines: [
      'Keşif için sakin bir çerçeve sundu.',
      'Alternatifleri görünür kılarak ufku genişletti.',
    ],
    balanceLines: [
      'Bugünkü etkileşim meraklı ama ölçülü bir ritimde ilerledi.',
      'Keşif ile sakinlik bir arada kaldı.',
    ],
    visualHints: [
      'historic city horizon discovery light',
      'journey mood warm sand blue gold',
    ],
    atmosphereBoost: 'open horizon discovery, gentle travel wonder',
  },
  architecture: {
    mirrorStories: [
      'Bugün geçmişin detaylarını anlamaya çalıştın. AI ile birlikte malzemeleri analiz ederek daha sağlam bir karar zemini kurdun.',
      'Yapı ve netlik için düşünceli bir tempo seçtin. Birlikte detayları sakin bir ustalıkla ele aldınız.',
      'Form, malzeme ve anlam üzerine ölçülü bir arayış vardı. AI, bu derinliği yapılandırdı.',
    ],
    dailyJourneys: ['Düşünceli yapı', 'Sakin ustalık', 'Detay ve netlik'],
    userLines: [
      'Detayları anlamak için ölçülü bir arayış seçtin.',
      'Yapı ve malzeme üzerine dikkatli düşündün.',
    ],
    aiLines: [
      'Analizi sadeleştirip daha sağlam bir çerçeve sundu.',
      'Karmaşık parçaları okunur bir düzene taşıdı.',
    ],
    balanceLines: [
      'Bugünkü etkileşim sakin ama üretken bir ritimde ilerledi.',
      'Derinlik ile netlik aynı masada buluştu.',
    ],
    visualHints: [
      'stone sketch materials thoughtful desk',
      'restoration craft mood calm mastery no text',
      'architectural storytelling integrated space',
    ],
    atmosphereBoost: 'thoughtful material study, calm craftsmanship atmosphere',
  },
  creativity: {
    mirrorStories: [
      'Bugün fikirlerine daha görünür bir alan açtın. AI ile birlikte yaratıcı ve akıcı bir üretim ritmi oluştu.',
      'İlham ve ifade bugün ön plandaydı. Birlikte düşünceyi forma taşıyan bir tempo kuruldu.',
      'Yaratıcı bir arayış içinde sakin kaldın. AI, bu akışı destekleyici bir eşlikçi oldu.',
    ],
    dailyJourneys: ['Yaratıcı akış', 'İlham günü', 'Görünür fikirler'],
    userLines: [
      'Yeni fikirleri dikkatle değerlendirdin.',
      'İfade etmek için sakin bir alan açtın.',
    ],
    aiLines: [
      'Fikirlerine alan açıp örneklerle destek oldu.',
      'Yaratıcı akışı yumuşak bir tempo ile taşıdı.',
    ],
    balanceLines: [
      'Bugünkü etkileşim ilhamlı ama dengeli bir ritimde ilerledi.',
      'Üretkenlik ile sakinlik bir arada kaldı.',
    ],
    visualHints: [
      'creative studio soft light inspiration',
      'artistic flow mood no text overlays',
    ],
  },
  general: {
    mirrorStories: [
      'Bugün AI ile sakin ve gözlemsel bir gün geçirdin. Düşüncene alan açan, yargısız bir ritim oluştu.',
      'Zihinsel tempo ölçülüydü; birlikte netlik arayan bir ilişki hissi kuruldu.',
      'Günün akışı yumuşaktı. AI, bu sakinliği taşıyan bir eşlikçi rolünde kaldı.',
    ],
    dailyJourneys: ['Sakin yansıma', 'Gözlemsel gün', 'Dengeli tempo'],
    userLines: [
      'Düşünceni ölçülü bir tempo ile taşıdın.',
      'Sakin ve dikkatli bir iletişim ritmi seçtin.',
    ],
    aiLines: [
      'Yargısız ve dengeli bir yanıt tonu korudu.',
      'Düşüncene alan açan sakin bir eşlik sundu.',
    ],
    balanceLines: [
      'Bugünkü etkileşim sakin ve dengeli bir ritimde ilerledi.',
      'Acele etmeden netlik arandı.',
    ],
    visualHints: ['soft contemplative space', 'journal-like calm atmosphere'],
  },
};

const LOG_LIKE_PATTERNS = [
  /\bsordun\b/i,
  /\baraştırdın\b/i,
  /\btarif\b/i,
  /\bbrownie\b/i,
  /\brestorasyon\s+malzemesini\b/i,
  /\bşunu\b/i,
  /\bbunu\b/i,
];

function sanitizeStoryLine(line: string): string {
  let t = line.trim();
  for (const p of LOG_LIKE_PATTERNS) {
    if (p.test(t)) {
      t = 'Bugünkü etkileşim sakin ve gözlemsel bir ritimde ilerledi.';
      break;
    }
  }
  return t;
}

export function relationshipModeLabelTr(mode: AiRelationshipModeId): string {
  const labels: Record<AiRelationshipModeId, string> = {
    reflective_companion: 'Sakin yansıma eşliği',
    research_partner: 'Araştırma ortağı',
    calm_guide: 'Sakin rehber',
    creative_partner: 'Yaratıcı ortak',
    thoughtful_assistant: 'Düşünceli asistan',
    exploration_companion: 'Keşif eşliği',
    structured_analyst: 'Yapılandırılmış analist',
    emotional_supportive_presence: 'Duygusal destek varlığı',
  };
  return labels[mode];
}

export function composeMirrorStory(input: ComposeMirrorStoryInput): MirrorStoryLayer {
  const rhythm = analyzeBehavioralRhythm(input.entries);
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries, rhythm);
  const storyTopicKey = inferSceneTopicKey(
    input.entries,
    input.observationCategoryId,
    input.personaFamilyId
  );
  const lockedIntent = resolveLockedPrimaryIntent({
    entries: input.entries,
    reflectionSignals,
  });
  const microMood =
    input.microMood ??
    (lockedIntent === 'premium_vehicle_comparison'
      ? 'comparing'
      : inferMicroMood(reflectionSignals, input.reflectionTone));
  const relationshipMode = inferAiRelationshipMode(
    rhythm,
    storyTopicKey,
    input.reflectionTone
  );
  const storyTone = inferStoryTone(input.reflectionTone, input.emotionalRhythm);
  const pack = TOPIC_STORIES[storyTopicKey];
  const seed = `${input.seed}-story-${storyTopicKey}-${relationshipMode}-${storyTone}-${microMood}`;

  const precision = composePrecisionStory(
    storyTopicKey,
    reflectionSignals,
    microMood,
    seed,
    lockedIntent
  );

  const aiStoryLine = sanitizeStoryLine(
    hashPick(`${seed}-a`, [precision.aiLine, ...MODE_AI_LINE[relationshipMode]])
  );

  const atmosphereBoost = [
    pack.atmosphereBoost,
    reflectionSignals.calmnessLevel >= 0.58 ? 'soft spacious calm light' : '',
    reflectionSignals.curiosityDepth >= 0.52 ? 'gentle lively frame' : '',
    reflectionSignals.detailFocus >= 0.5 ? 'thoughtful material detail mood' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return {
    mirrorStory: sanitizeStoryLine(precision.mirrorStory),
    dailyJourney: precision.dailyJourney,
    relationshipMode,
    storyTone,
    storyTopicKey,
    storyVariant: precision.variant,
    microMood,
    reflectionSignals,
    userStoryLine: sanitizeStoryLine(precision.userLine),
    aiStoryLine,
    balanceStoryLine: sanitizeStoryLine(precision.balanceLine),
    visualStoryHints: [...pack.visualHints, ...buildVisualPrecisionHints(reflectionSignals)],
    visualAtmosphereBoost: atmosphereBoost || pack.atmosphereBoost,
  };
}
