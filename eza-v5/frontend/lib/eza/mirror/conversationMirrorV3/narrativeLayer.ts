/**
 * V3.1 — Topic → Meaning → Emotion → Narrative Distance → Scene.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SainaMirrorEmotionalTone } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { toEmotionalAtmosphere } from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import type { NarrativeDistanceLevel } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';

export type NarrativeLayer = {
  narrativeTheme: string;
  meaning: string;
  emotion: string;
  storyArc: string;
  emotionalAtmosphere: string;
  narrativeDistance: NarrativeDistanceLevel;
};

const NARRATIVE_THEME_BY_TOPIC: Record<StoryTopicId, string> = {
  travel: 'Merak ve Keşif',
  vehicle: 'Karar ve Terazi',
  architecture: 'Form ve Hafıza',
  technology_ai: 'Anlam ve Yansıma',
  finance: 'Gelecek ve Eşik',
  health: 'Denge ve Bakım',
  food_culture: 'Tat ve Hafıza',
  family: 'Yakınlık ve Ritim',
  education: 'Öğrenme ve Işık',
  spiritual_reflection: 'Sessiz Anlam',
  general_curiosity: 'Günlük Merak',
};

const MEANING_BY_TOPIC: Record<StoryTopicId, string> = {
  travel: 'Uzaklık, merak ve tanıdık olmayan güzellik',
  vehicle: 'Seçim, denge ve yön arayışı',
  architecture: 'Hafıza, kalıcılık ve anlamlı bir şey inşa etmek',
  technology_ai: 'İnsanın zekâ hakkındaki iç yansıması',
  finance: 'Güven, eşik ve geleceğe bakış',
  health: 'Özen, ritim ve küçük günlük kararlar',
  food_culture: 'Anı, tat ve paylaşılan hafıza',
  family: 'Yakınlık, bağ ve sessiz ritim',
  education: 'Işığa doğru açılan merak',
  spiritual_reflection: 'Sessizlik, anlam ve iç yön',
  general_curiosity: 'Gündelik hayattaki ince merak',
};

const EMOTION_BY_TONE: Record<SainaMirrorEmotionalTone, string> = {
  curious: 'Merak',
  decisive: 'Kararlılık',
  reflective: 'Yansıma',
  hopeful: 'Umut',
  uncertain: 'Belirsizlik',
  focused: 'Odak',
  nostalgic: 'Hafıza',
  calm: 'Sakinlik',
  careful: 'Özen',
};

const STORY_ARC_BY_TOPIC: Record<StoryTopicId, string> = {
  travel: 'Ufka bakan bir an — yol henüz açılmış',
  vehicle: 'Terazide duran bir karar — henüz tamamlanmamış',
  architecture: 'Işığın duvarlarda kaldığı bir an',
  technology_ai: 'İnsan ve görünmeyen bağlantılar arasında bir durak',
  finance: 'Eşiğin eşiğinde duran bir bakış',
  health: 'Sabah ışığında sessiz bir ritüel',
  food_culture: 'Masada kalan bir anının izi',
  family: 'Yakınlığın sessiz dilinde bir kare',
  education: 'Sayfadan yükselen bir ışık',
  spiritual_reflection: 'Sessizliğin içinde bir yön',
  general_curiosity: 'Gündelik hayatın içinde parlayan bir soru',
};

export function resolveNarrativeLayer(input: {
  storyTopicId: StoryTopicId;
  emotionalTone: SainaMirrorEmotionalTone;
  visualKeywords: readonly string[];
  sceneMetaphor: string;
  narrativeDistance: NarrativeDistanceLevel;
}): NarrativeLayer {
  const narrativeTheme =
    NARRATIVE_THEME_BY_TOPIC[input.storyTopicId] ?? 'Günlük Merak';
  const meaning = MEANING_BY_TOPIC[input.storyTopicId] ?? 'Gündelik hayattaki duygusal iz';
  const emotion = EMOTION_BY_TONE[input.emotionalTone] ?? 'Yansıma';
  const storyArc = STORY_ARC_BY_TOPIC[input.storyTopicId] ?? 'Bir anın sinematik yansıması';
  const atmosphereTokens = toEmotionalAtmosphere(input.visualKeywords);
  const emotionalAtmosphere =
    atmosphereTokens.length > 0
      ? atmosphereTokens.join(', ')
      : `${emotion}, ${input.sceneMetaphor.slice(0, 80)}`;

  return {
    narrativeTheme,
    meaning,
    emotion,
    storyArc,
    emotionalAtmosphere,
    narrativeDistance: input.narrativeDistance,
  };
}
