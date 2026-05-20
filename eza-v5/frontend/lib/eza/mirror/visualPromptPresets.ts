/**
 * EZA Mirror — scene topic presets (textless illustration scenes).
 */

import { DEFAULT_ATMOSPHERE_LABEL, DEFAULT_EMOTION_LABEL } from '@/lib/eza/mirror/visualStyleContract';

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

export { DEFAULT_ATMOSPHERE_LABEL, DEFAULT_EMOTION_LABEL };

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
      'wellness garden',
      'morning light',
      'calm lake or seaside path',
      'soft green and lavender tones',
      'restorative mood',
    ],
    palette: 'soft green, lavender, sky blue, cream white',
    atmosphereDefault: 'fresh morning wellness, gentle and restorative',
  },
  finance: {
    key: 'finance',
    sceneElements: [
      'city terrace at golden hour',
      'quiet modern skyline',
      'marble cafe table',
      'green and gold tones',
      'calm planning mood',
    ],
    palette: 'muted green, warm gold, soft cream',
    atmosphereDefault: 'thoughtful golden-hour planning, steady and clear',
  },
  friendship: {
    key: 'friendship',
    sceneElements: [
      'park bridge',
      'lakeside path',
      'sunset',
      'warm purple and peach tones',
      'reconciliation and empathy mood',
    ],
    palette: 'warm purple, soft peach, sage green',
    atmosphereDefault: 'gentle connection, trust and empathy',
  },
  travel: {
    key: 'travel',
    sceneElements: [
      'historic city',
      'train station',
      'old streets',
      'horizon line',
      'discovery mood',
      'warm sand and blue tones',
    ],
    palette: 'warm sand, dusty blue, soft amber',
    atmosphereDefault: 'curious journey, open horizon',
  },
  architecture: {
    key: 'architecture',
    sceneElements: [
      'quiet courtyard',
      'historic facade',
      'modern material samples',
      'sunlight and shadows',
      'elegant spatial mood',
    ],
    palette: 'stone gray, warm ivory, soft copper',
    atmosphereDefault: 'structured calm, light on stone and glass',
  },
  creativity: {
    key: 'creativity',
    sceneElements: [
      'artist studio',
      'music corner',
      'art materials',
      'open window',
      'sunset light',
      'inspiring warm colors',
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
