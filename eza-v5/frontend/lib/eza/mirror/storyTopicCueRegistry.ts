/**
 * Whitelist cue registry for story topic resolution (TR/EN tokens only).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export const MAX_CUE_TOKEN_LENGTH = 24;
export const MAX_CUE_TOKENS_PER_TURN = 8;
export const MAX_CUE_TOKENS_AGGREGATE = 12;

export type TopicCueRule = {
  token: string;
  topic: StoryTopicId;
  patterns: readonly string[];
};

function rule(token: string, topic: StoryTopicId, patterns: readonly string[]): TopicCueRule {
  const safe = token.slice(0, MAX_CUE_TOKEN_LENGTH);
  return { token: safe, topic, patterns };
}

/** Vehicle compare cues — shared with intent lock (not a StoryTopicId). */
export const VEHICLE_COMPARE_TOKENS = [
  'compare',
  'comparison',
  'versus',
  'vs',
  'which',
  'better',
  'between',
  'kıyas',
  'karşılaştır',
  'hangisi',
  'tercih',
  'seçenek',
  'karar',
  'decision',
  'choice',
  'öncelik',
  'priority',
] as const;

export const TOPIC_CUE_RULES: readonly TopicCueRule[] = [
  rule('bmw', 'vehicle', ['bmw']),
  rule('mercedes', 'vehicle', ['mercedes', 'mercedes-benz']),
  rule('audi', 'vehicle', ['audi']),
  rule('sedan', 'vehicle', ['sedan']),
  rule('suv', 'vehicle', ['suv']),
  rule('araba', 'vehicle', ['araba', 'araç', 'otomobil']),
  rule('car', 'vehicle', ['car', 'vehicle']),
  rule('konfor', 'vehicle', ['konfor', 'comfort']),
  rule('uzun yol', 'vehicle', ['uzun yol', 'long drive']),
  rule('sürüş', 'vehicle', ['sürüş', 'driving', 'drive']),
  rule('c serisi', 'vehicle', ['c serisi', 'c-class', 'c class']),
  rule('3 serisi', 'vehicle', ['3 serisi', '3 series', 'serie 3']),

  rule('özbekistan', 'travel', ['özbekistan', 'uzbekistan', 'özbek']),
  rule('semerkant', 'travel', ['semerkant', 'samarkand', 'registan']),
  rule('buhara', 'travel', ['buhara', 'bukhara', 'hive']),
  rule('seyahat', 'travel', ['seyahat', 'travel', 'trip', 'journey', 'gezi']),
  rule('rota', 'travel', ['rota', 'route', 'itinerary', 'yolculuk']),
  rule('harita', 'travel', ['harita', 'map', 'station', 'tren']),
  rule('keşif', 'travel', ['keşif', 'explore', 'exploration']),

  rule('mimari', 'architecture', ['mimari', 'architecture', 'architect']),
  rule('restorasyon', 'architecture', ['restorasyon', 'restoration', 'restore']),
  rule('cephe', 'architecture', ['cephe', 'facade', 'facade']),
  rule('cami', 'architecture', ['cami', 'mosque', 'minare']),
  rule('villa', 'architecture', ['villa', 'courtyard', 'atelier']),
  rule('malzeme', 'architecture', ['malzeme', 'material', 'stone', 'heritage']),

  rule('eza', 'technology_ai', ['eza', 'ezacore']),
  rule('cursor', 'technology_ai', ['cursor']),
  rule('ai', 'technology_ai', [' ai ', ' yapay zeka', 'artificial intelligence']),
  rule('ürün', 'technology_ai', ['ürün', 'product', 'mvp', 'roadmap', 'feature']),
  rule('strateji', 'technology_ai', ['strateji', 'strategy', 'platform']),

  rule('finans', 'finance', ['finans', 'finance', 'financial', 'money']),
  rule('bütçe', 'finance', ['bütçe', 'budget', 'yatırım', 'invest']),
  rule('risk', 'finance', ['risk', 'saving', 'spend']),

  rule('sağlık', 'health', ['sağlık', 'health', 'wellness', 'fitness']),
  rule('uyku', 'health', ['uyku', 'sleep', 'beslenme', 'nutrition']),
  rule('iyi oluş', 'health', ['iyi oluş', 'wellbeing']),

  rule('yemek', 'food_culture', ['yemek', 'food', 'meal', 'ne yiyebilirim', 'ne yiyelim']),
  rule('tarif', 'food_culture', ['tarif', 'recipe', 'mutfak', 'kitchen', 'cook', 'cooking']),
  rule('gluten', 'food_culture', ['gluten', 'culinary', 'beslen']),

  rule('aile', 'family', ['aile', 'family', 'ebeveyn', 'parent', 'çocuk', 'child']),
  rule('ilişki', 'family', ['ilişki', 'relationship', 'arkadaş', 'friend']),

  rule('eğitim', 'education', ['eğitim', 'education', 'öğren', 'learn', 'ders', 'study']),
  rule('okul', 'education', ['okul', 'school', 'üniversite', 'university']),

  rule('manevi', 'spiritual_reflection', ['manevi', 'spiritual', 'dua', 'prayer', 'inanç', 'faith']),
  rule('sakin', 'spiritual_reflection', ['meditasyon', 'meditation', 'reflection']),
];

const TOKEN_TO_TOPIC = new Map<string, StoryTopicId>(
  TOPIC_CUE_RULES.map((r) => [r.token, r.topic])
);

const OBSERVATION_CATEGORY_TO_TOPIC: Record<string, StoryTopicId> = {
  curiosity_exploration: 'travel',
  exploration: 'travel',
  clarity_simplification: 'architecture',
  explanation_seek: 'architecture',
  question_clarity: 'architecture',
  creative_ideas: 'technology_ai',
  ideation_creation: 'technology_ai',
  decision_direction: 'finance',
  planning_structure: 'finance',
  fast_practical: 'finance',
  flow_harmony: 'health',
  safe_balance: 'health',
  sensitive_careful: 'family',
  balanced_calm: 'general_curiosity',
  deep_thinking: 'general_curiosity',
};

export function getTopicForToken(token: string): StoryTopicId | undefined {
  return TOKEN_TO_TOPIC.get(token);
}

export function getTopicForObservationCategory(category: string): StoryTopicId | undefined {
  return OBSERVATION_CATEGORY_TO_TOPIC[category.toLowerCase()];
}

export function isVehicleMirrorCueToken(token: string): boolean {
  const topic = getTopicForToken(token);
  if (topic === 'vehicle') return true;
  return (VEHICLE_COMPARE_TOKENS as readonly string[]).includes(token);
}

export function getVehicleLockCueTokens(): string[] {
  return TOPIC_CUE_RULES.filter((r) => r.topic === 'vehicle').map((r) => r.token);
}
