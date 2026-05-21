/**
 * EZA Mirror — scene topic presets (textless illustration scenes).
 */

export const DEFAULT_ATMOSPHERE_LABEL = 'sakin, yumuşak, düşünsel atmosfer';

export const DEFAULT_EMOTION_LABEL = 'dengeli ve meraklı';

export type SceneTopicKey =
  | 'health'
  | 'finance'
  | 'friendship'
  | 'travel'
  | 'architecture'
  | 'creativity'
  | 'general';

export const SCENE_TOPIC_LABEL: Record<SceneTopicKey, string> = {
  health: 'sağlık ve iyi oluş',
  finance: 'finans ve planlama',
  friendship: 'arkadaşlık ve ilişki',
  travel: 'seyahat ve keşif',
  architecture: 'mimari ve yapı',
  creativity: 'yaratıcılık ve ilham',
  general: 'genel düşünce',
};

export interface SceneTopicPreset {
  key: SceneTopicKey;
  sceneElements: string[];
  palette: string;
  atmosphereDefault: string;
}

export const SCENE_TOPIC_PRESETS: Record<SceneTopicKey, SceneTopicPreset> = {
  health: {
    key: 'health',
    sceneElements: [
      'wellness path and calm lake',
      'lavender morning light',
      'nature cream lavender green',
      'restorative body-mind balance mood',
      'Şefkatli Geyik canon atmosphere',
    ],
    palette: 'soft green, lavender, sky blue, cream white',
    atmosphereDefault: 'fresh morning wellness, gentle and restorative',
  },
  finance: {
    key: 'finance',
    sceneElements: [
      'city terrace golden hour',
      'quiet skyline green gold cream',
      'marble table calm planning',
      'Bilgeli Baykuş strategic atmosphere',
      'editorial finance calm not dark',
    ],
    palette: 'muted green, warm gold, soft cream',
    atmosphereDefault: 'thoughtful golden-hour planning, steady and clear',
  },
  friendship: {
    key: 'friendship',
    sceneElements: [
      'park bridge lakeside sunset',
      'warm purple peach reconciliation',
      'Köprü Kurucu empathy connection mood',
      'gentle communication atmosphere',
    ],
    palette: 'warm purple, soft peach, sage green',
    atmosphereDefault: 'gentle connection, trust and empathy',
  },
  travel: {
    key: 'travel',
    sceneElements: [
      'train station historic city',
      'old streets horizon discovery',
      'warm sand blue gold light',
      'Keşif Yolcusu journey mood',
      'not round bean head not felt toy traveler',
    ],
    palette: 'warm sand, dusty blue, soft amber',
    atmosphereDefault: 'curious journey, open horizon',
  },
  architecture: {
    key: 'architecture',
    sceneElements: [
      'cinematic architecture storytelling',
      'historic stone courtyard at golden hour',
      'material craft samples elegant shadows',
      'contemplative designer mood integrated in space',
    ],
    palette: 'stone gray, warm ivory, soft copper',
    atmosphereDefault: 'structured calm, light on stone and glass',
  },
  creativity: {
    key: 'creativity',
    sceneElements: [
      'art studio music corner',
      'quality materials open window sunset',
      'Yaratıcı Ruh inspired warm colors',
      'calm creative inspiration',
    ],
    palette: 'amber, coral, soft violet',
    atmosphereDefault: 'playful inspiration, warm and bright',
  },
  general: {
    key: 'general',
    sceneElements: [
      'tranquil indoor-outdoor threshold',
      'soft light',
      'calm reflective mood',
    ],
    palette: 'soft violet, pale blue, warm white',
    atmosphereDefault: DEFAULT_ATMOSPHERE_LABEL,
  },
};

