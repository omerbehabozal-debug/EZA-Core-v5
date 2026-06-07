/**
 * Subtopic cue registry — extra whitelist tokens for subtopic resolution (TR/EN).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { TopicCueRule } from '@/lib/eza/mirror/storyTopicCueRegistry';
import { MAX_CUE_TOKEN_LENGTH } from '@/lib/eza/mirror/storyTopicCueRegistry';

function rule(token: string, topic: StoryTopicId, patterns: readonly string[]): TopicCueRule {
  return { token: token.slice(0, MAX_CUE_TOKEN_LENGTH), topic, patterns };
}

/** Extra cues merged into story extraction for subtopic detection. */
export const SUBTOPIC_EXTRA_CUE_RULES: readonly TopicCueRule[] = [
  rule('minare', 'architecture', ['minare', 'minaret']),
  rule('osmanlı', 'architecture', ['osmanlı', 'ottoman']),
  rule('kubbe', 'architecture', ['kubbe', 'dome']),
  rule('islamic', 'architecture', ['islamic', 'islami']),
  rule('söve', 'architecture', ['söve', 'molding', 'cornice']),
  rule('taş kaplama', 'architecture', ['taş kaplama', 'stone cladding', 'stone facing']),
  rule('mermer', 'architecture', ['mermer', 'marble']),
  rule('rölöve', 'architecture', ['rölöve', 'survey drawing', 'measured drawing']),
  rule('restitüsyon', 'architecture', ['restitüsyon', 'restitution']),
  rule('tonoz', 'architecture', ['tonoz', 'vault']),
  rule('premium', 'vehicle', ['premium', 'luxury', 'lüks']),
  rule('elektrikli', 'vehicle', ['elektrikli', 'electric']),
  rule('ev', 'vehicle', [' ev ', 'electric vehicle', 'elektrik araç']),
  rule('şarj', 'vehicle', ['şarj', 'charging', 'charge station']),
  rule('togg', 'vehicle', ['togg', 't10x']),
  rule('t10x', 'vehicle', ['t10x']),
  rule('codex', 'technology_ai', ['codex']),
  rule('kod', 'technology_ai', [' kod ', 'coding', 'code']),
  rule('mvp', 'technology_ai', ['mvp']),
  rule('roadmap', 'technology_ai', ['roadmap']),
  rule('startup', 'technology_ai', ['startup', 'start-up']),
  rule('arayüz', 'technology_ai', ['arayüz', 'interface', 'ui design']),
  rule('platform', 'technology_ai', ['platform']),
  rule('governance', 'technology_ai', ['governance', 'yönetişim']),
];

/** Cue groups used only for subtopic matching (already-extracted tokens). */
export const TRAVEL_CITY_TOKENS = ['özbekistan', 'semerkant', 'buhara'] as const;
export const TRAVEL_JOURNEY_TOKENS = ['seyahat', 'rota', 'harita', 'keşif', 'yolculuk'] as const;

export const ARCH_MOSQUE_TOKENS = ['cami', 'minare', 'islamic', 'osmanlı', 'kubbe'] as const;
export const ARCH_FACADE_TOKENS = ['cephe', 'söve', 'taş kaplama', 'mermer', 'malzeme'] as const;
export const ARCH_MATERIAL_TOKENS = ['restorasyon', 'rölöve', 'restitüsyon', 'tonoz', 'kubbe'] as const;

export const VEHICLE_LUXURY_TOKENS = [
  'bmw',
  'mercedes',
  'audi',
  'konfor',
  'premium',
  'hangisi',
  'vs',
  'c serisi',
  '3 serisi',
] as const;
export const VEHICLE_SUV_TOKENS = ['suv', 'togg', 't10x'] as const;
export const VEHICLE_EV_TOKENS = ['elektrikli', 'ev', 'şarj'] as const;

export const TECH_CODING_TOKENS = ['cursor', 'codex', 'ai', 'kod'] as const;
export const TECH_PRODUCT_TOKENS = ['ürün', 'mvp', 'roadmap', 'startup', 'arayüz'] as const;
export const TECH_STRATEGY_TOKENS = ['eza', 'strateji', 'platform', 'governance'] as const;

export function hasAnyToken(tokens: readonly string[], group: readonly string[]): boolean {
  const set = new Set(tokens.map((t) => t.toLowerCase()));
  return group.some((g) => set.has(g.toLowerCase()));
}

export function countMatching(tokens: readonly string[], group: readonly string[]): number {
  const set = new Set(tokens.map((t) => t.toLowerCase()));
  return group.filter((g) => set.has(g.toLowerCase())).length;
}

export const SUBTOPIC_TOKEN_TO_TOPIC = new Map<string, StoryTopicId>(
  SUBTOPIC_EXTRA_CUE_RULES.map((r) => [r.token, r.topic])
);
