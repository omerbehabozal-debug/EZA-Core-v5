/**
 * Story topic resolver — aggregate whitelist cues from behavioral entries.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { StoryTopicId, StoryTopicResolution, StoryTopicSource } from '@/lib/eza/mirror/storyTopicTypes';
import {
  getTopicForObservationCategory,
  getTopicForToken,
  isVehicleMirrorCueToken,
  MAX_CUE_TOKENS_AGGREGATE,
  MAX_CUE_TOKENS_PER_TURN,
  TOPIC_CUE_RULES,
  VEHICLE_COMPARE_TOKENS,
} from '@/lib/eza/mirror/storyTopicCueRegistry';

const MAX_ENTRIES = 10;
const RECENCY_BOOST = 1.5;
const RECENCY_WINDOW = 3;

const STORY_TOPIC_TO_SCENE: Record<StoryTopicId, SceneTopicKey> = {
  vehicle: 'general',
  travel: 'travel',
  architecture: 'architecture',
  technology_ai: 'creativity',
  finance: 'finance',
  health: 'health',
  food_culture: 'health',
  family: 'friendship',
  education: 'general',
  spiritual_reflection: 'health',
  general_curiosity: 'general',
};

function normalizeText(text: string): string {
  return ` ${text.trim().toLowerCase().replace(/\s+/g, ' ')} `;
}

function matchRule(text: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p.length <= 3 && /^[a-z0-9]+$/.test(p)) {
    return new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  }
  return text.includes(p);
}

/** Extract whitelist tokens from a single user message (no raw sentence stored). */
export function extractStoryCueTokens(userText: string): string[] {
  const normalized = normalizeText(userText);
  if (!normalized.trim()) return [];

  const sorted = [...TOPIC_CUE_RULES].sort(
    (a, b) => Math.max(...b.patterns.map((p) => p.length)) - Math.max(...a.patterns.map((p) => p.length))
  );

  const found: string[] = [];
  for (const entry of sorted) {
    if (found.includes(entry.token)) continue;
    if (entry.patterns.some((pattern) => matchRule(normalized, pattern))) {
      found.push(entry.token);
    }
    if (found.length >= MAX_CUE_TOKENS_PER_TURN) break;
  }

  for (const compare of VEHICLE_COMPARE_TOKENS) {
    if (found.length >= MAX_CUE_TOKENS_PER_TURN) break;
    const c = compare.trim();
    if (c === 'vs' && /\bvs\b/.test(normalized)) {
      if (!found.includes('vs')) found.push('vs');
    } else if (c && matchRule(normalized, c) && !found.includes(c)) {
      found.push(c);
    }
  }

  return found.slice(0, MAX_CUE_TOKENS_PER_TURN);
}

/** Vehicle-only subset for legacy mirrorCueHints / intent lock API. */
export function extractVehicleMirrorCueHints(userText: string): string[] {
  return extractStoryCueTokens(userText).filter(isVehicleMirrorCueToken);
}

export function mapStoryTopicToSceneTopic(topic: StoryTopicId): SceneTopicKey {
  return STORY_TOPIC_TO_SCENE[topic] ?? 'general';
}

function collectAggregateCueTokens(entries: SavedBehavioralEntry[]): string[] {
  const tokens: string[] = [];
  for (const entry of entries) {
    for (const hint of entry.mirrorCueHints ?? []) {
      const t = String(hint).slice(0, 24);
      if (t && !tokens.includes(t)) tokens.push(t);
    }
    if (tokens.length >= MAX_CUE_TOKENS_AGGREGATE) break;
  }
  return tokens.slice(0, MAX_CUE_TOKENS_AGGREGATE);
}

function scoreTopics(entries: SavedBehavioralEntry[]): Map<StoryTopicId, number> {
  const scores = new Map<StoryTopicId, number>();
  const bump = (topic: StoryTopicId, amount: number) => {
    scores.set(topic, (scores.get(topic) ?? 0) + amount);
  };

  const recent = [...entries]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, MAX_ENTRIES);

  recent.forEach((entry, index) => {
    const weight = index < RECENCY_WINDOW ? RECENCY_BOOST : 1;

    for (const token of entry.mirrorCueHints ?? []) {
      const topic = getTopicForToken(String(token));
      if (topic) bump(topic, 1 * weight);
    }

    const obs = parseStandaloneObservation(entry.standaloneObservation);
    const userCat = obs?.user_pattern?.category;
    if (userCat) {
      const topic = getTopicForObservationCategory(userCat);
      if (topic) bump(topic, 0.75 * weight);
    }

    for (const signal of obs?.user_pattern?.signals ?? []) {
      const topic = getTopicForToken(String(signal).slice(0, 24));
      if (topic) bump(topic, 0.5 * weight);
    }

    const intent = (entry.vector.intent ?? '').toLowerCase();
    if (intent) {
      for (const rule of TOPIC_CUE_RULES) {
        if (rule.patterns.some((p) => intent.includes(p.trim()))) {
          bump(rule.topic, 0.35 * weight);
        }
      }
    }
  });

  return scores;
}

function pickTopTopics(scores: Map<StoryTopicId, number>): {
  primary: StoryTopicId;
  secondary?: StoryTopicId;
  confidence: number;
} {
  const ranked = Array.from(scores.entries())
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return { primary: 'general_curiosity', confidence: 0.15 };
  }

  const [primaryTopic, primaryScore] = ranked[0];
  const [, secondaryScore] = ranked[1] ?? [undefined, 0];
  const total = ranked.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(0.95, Math.max(0.2, primaryScore / (total + 0.01)));

  let secondary: StoryTopicId | undefined;
  if (ranked.length > 1 && secondaryScore >= primaryScore * 0.55) {
    secondary = ranked[1][0];
  }

  return { primary: primaryTopic, secondary, confidence };
}

export function resolveStoryTopics(
  entries: SavedBehavioralEntry[]
): StoryTopicResolution {
  if (!entries.length) {
    return {
      primaryTopic: 'general_curiosity',
      confidence: 0.1,
      cueTokens: [],
      source: 'fallback',
    };
  }

  const scores = scoreTopics(entries);
  const { primary, secondary, confidence } = pickTopTopics(scores);
  const cueTokens = collectAggregateCueTokens(entries);

  let source: StoryTopicSource = 'fallback';
  const hasCueScore = Array.from(scores.entries()).some(
    ([topic, s]) => s > 0 && topic === primary
  );
  const hasObsScore = scores.get(primary) !== undefined && cueTokens.length === 0;

  if (cueTokens.length > 0 && hasCueScore) {
    source = 'cues';
  } else if (hasCueScore) {
    source = 'mixed';
  } else if (primary !== 'general_curiosity') {
    source = 'observation';
  }

  return {
    primaryTopic: primary,
    secondaryTopic: secondary,
    confidence,
    cueTokens,
    source,
  };
}
