/**
 * Conversation meaning summary — semantic-first authority for Mirror topic choice.
 *
 * Cue registry remains a supporting signal. Ambiguous tokens (e.g. "yürüyüş")
 * are interpreted from conversation-level entities and intent, not alone.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import { normalizeCoverageText } from '@/lib/eza/mirror/coverage/coverageSynonyms';

export type ConversationMeaningSummary = {
  primaryTopic: StoryTopicId;
  secondaryTopics: StoryTopicId[];
  userIntent: string;
  entities: string[];
  visualMood: string[];
  confidence: number;
  source: 'semantic_heuristic' | 'cue_fallback';
  /** Why primaryTopic won — for tests/debug. */
  rationale: string;
};

/** Tokens that alone are too ambiguous to force a topic. */
export const AMBIGUOUS_TOPIC_TOKENS = new Set([
  'yürüyüş',
  'yuruyus',
  'walk',
  'walking',
  'yol',
  'path',
  'rota',
]);

type DomainSignal = {
  topic: StoryTopicId;
  weight: number;
  matches: string[];
};

const TRAVEL_ENTITY_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'Kyoto', pattern: /\bkyoto\b/i },
  { label: 'Tokyo', pattern: /\btokyo\b/i },
  { label: 'Osaka', pattern: /\bosaka\b/i },
  { label: 'Japonya', pattern: /\bjaponya\b|\bjapan\b/i },
  { label: 'Gion', pattern: /\bgion\b/i },
  { label: 'Pontocho', pattern: /\bpontocho\b|\bpontoc[h]?o\b/i },
  { label: 'Özbekistan', pattern: /\bözbekistan\b|\buzbekistan\b/i },
  { label: 'Semerkant', pattern: /\bsemerkant\b|\bsamarkand\b/i },
  { label: 'Roma', pattern: /\broma\b|\brome\b/i },
  { label: 'İtalya', pattern: /\bitalya\b|\bitaly\b|\bitalya'?da\b/i },
  { label: 'Paris', pattern: /\bparis\b/i },
  { label: 'İstanbul', pattern: /\bistanbul\b/i },
];

const DOMAIN_PATTERNS: readonly {
  topic: StoryTopicId;
  weight: number;
  patterns: RegExp[];
  labels?: string[];
}[] = [
  {
    topic: 'travel',
    weight: 3.2,
    patterns: [
      /\b(seyahat|gezi|tatil|tur|yolculuk|itinerary|travel|trip|journey)\b/i,
      /\b(kafe|cafe|müze|muze|tapınak|tapinak|onsen|otel|hotel|istasyon|station)\b/i,
      /\b(yağmur|yagmur|rain|akşam|aksam|evening|sokak lamba)/i,
      /\b(gezmek|gezebil|ziyaret|öner.*yer|nerelere)\b/i,
    ],
  },
  {
    topic: 'health',
    weight: 3.0,
    patterns: [
      /\b(kalori|kilo|adım|adim|10\s*bin|fitness|wellness|beslenme|diyet|diet)\b/i,
      /\b(diş macunu|dis macunu|florür|florur|toothpaste|tiroid|guatr)\b/i,
      /\b(her gün|her gun|günde|gunde)\s+\d*.*(yürü|yuru|adım|adim)/i,
      /\b(egzersiz|exercise|sağlıklı yaşam|saglikli yasam)\b/i,
    ],
  },
  {
    topic: 'architecture',
    weight: 3.0,
    patterns: [
      /\b(yürüyüş yolu|yuruyus yolu|kaldırım|kaldirim|yaya aks|cephe|facade|mimari|restorasyon)\b/i,
      /\b(projelendir|genişlik|genislik|malzeme|villa|atelier)\b/i,
    ],
  },
  {
    topic: 'food_culture',
    weight: 2.6,
    patterns: [/\b(tarif|recipe|baklava|sütlaç|sutlac|mutfak|yemek)\b/i],
  },
  {
    topic: 'vehicle',
    weight: 2.8,
    patterns: [/\b(bmw|mercedes|audi|araba|otomobil|sedan|suv|sürüş|surus)\b/i],
  },
];

function collectEntities(blob: string): string[] {
  const entities: string[] = [];
  for (const entry of TRAVEL_ENTITY_PATTERNS) {
    if (entry.pattern.test(blob) && !entities.includes(entry.label)) {
      entities.push(entry.label);
    }
  }
  return entities;
}

function scoreDomains(blob: string, entities: string[]): DomainSignal[] {
  const signals: DomainSignal[] = [];

  for (const domain of DOMAIN_PATTERNS) {
    const matches: string[] = [];
    for (const pattern of domain.patterns) {
      const hit = blob.match(pattern);
      if (hit?.[0]) matches.push(hit[0]);
    }
    if (!matches.length) continue;
    signals.push({
      topic: domain.topic,
      weight: domain.weight * matches.length,
      matches,
    });
  }

  if (entities.length) {
    const travel = signals.find((s) => s.topic === 'travel');
    const boost = 4 + entities.length * 1.5;
    if (travel) {
      travel.weight += boost;
      travel.matches.push(...entities);
    } else {
      signals.push({
        topic: 'travel',
        weight: boost,
        matches: [...entities],
      });
    }
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

function inferIntent(blob: string, primary: StoryTopicId): string {
  if (/\b(yağmur|yagmur|rain)\b/i.test(blob) && primary === 'travel') {
    return 'plan_rainy_day_alternatives';
  }
  if (/\b(öner|oner|plan|nerede|nerelere|rota)\b/i.test(blob) && primary === 'travel') {
    return 'plan_travel_activities';
  }
  if (/\b(kalori|kilo|adım|adim|fitness)\b/i.test(blob)) {
    return 'track_health_habit';
  }
  if (/\b(projelendir|genişlik|genislik|kaldırım|kaldirim)\b/i.test(blob)) {
    return 'design_urban_walkway';
  }
  return 'explore_topic';
}

function inferVisualMood(blob: string, primary: StoryTopicId, entities: string[]): string[] {
  const mood: string[] = [];
  if (/\b(yağmur|yagmur|rain)\b/i.test(blob)) mood.push('rainy');
  if (/\b(akşam|aksam|evening|dusk)\b/i.test(blob)) mood.push('evening');
  if (/\b(kafe|cafe|sıcak|sicak|warm)\b/i.test(blob)) mood.push('warm_interior');
  if (entities.some((e) => /japan|kyoto|gion|tokyo|osaka|japonya/i.test(e))) {
    mood.push('japanese');
  }
  if (primary === 'health') mood.push('quiet_wellness');
  if (primary === 'architecture') mood.push('urban_structure');
  if (!mood.length && primary === 'travel') mood.push('travel_atmosphere');
  return mood;
}

/**
 * Build a structured meaning summary from full conversation text (preferred)
 * and/or cue tokens (fallback support).
 */
export function buildConversationMeaningSummary(input: {
  conversationTexts?: readonly string[];
  cueTokens?: readonly string[];
}): ConversationMeaningSummary {
  const textBlob = normalizeCoverageText((input.conversationTexts ?? []).join('\n'));
  const cueBlob = normalizeCoverageText((input.cueTokens ?? []).join(' '));
  const blob = [textBlob, cueBlob].filter(Boolean).join('\n');

  if (!blob.trim()) {
    return {
      primaryTopic: 'general_curiosity',
      secondaryTopics: [],
      userIntent: 'explore_topic',
      entities: [],
      visualMood: [],
      confidence: 0.2,
      source: 'cue_fallback',
      rationale: 'empty_conversation',
    };
  }

  const entities = collectEntities(blob);
  const ranked = scoreDomains(blob, entities);
  const primary = ranked[0]?.topic ?? 'general_curiosity';
  const secondary = ranked
    .slice(1)
    .filter((s) => s.weight >= (ranked[0]?.weight ?? 0) * 0.35)
    .map((s) => s.topic)
    .filter((topic, index, all) => all.indexOf(topic) === index)
    .slice(0, 3);

  const top = ranked[0];
  const second = ranked[1];
  let confidence = 0.45;
  if (top) {
    confidence = Math.min(0.97, 0.55 + top.weight * 0.06);
    if (entities.length && primary === 'travel') confidence = Math.min(0.97, confidence + 0.12);
    if (second && top.weight > 0) {
      const margin = (top.weight - second.weight) / top.weight;
      confidence = Math.min(0.97, confidence + margin * 0.15);
    }
  }

  // Ambiguous walk alone → do not claim high-confidence health
  const onlyAmbiguousWalk =
    primary === 'health' &&
    !/\b(kalori|kilo|adım|adim|fitness|diş|dis macunu|florür|beslenme)\b/i.test(blob) &&
    /\b(yürü|yuru|walk)\b/i.test(blob);
  if (onlyAmbiguousWalk && entities.length === 0) {
    confidence = Math.min(confidence, 0.4);
  }

  const source: ConversationMeaningSummary['source'] =
    confidence >= 0.62 || entities.length > 0 ? 'semantic_heuristic' : 'cue_fallback';

  return {
    primaryTopic: primary,
    secondaryTopics: secondary,
    userIntent: inferIntent(blob, primary),
    entities,
    visualMood: inferVisualMood(blob, primary, entities),
    confidence: Math.round(confidence * 100) / 100,
    source,
    rationale: top
      ? `${top.topic}:${top.matches.slice(0, 4).join(',')}`
      : 'no_domain_match',
  };
}

/**
 * Whether a cue-derived topic conflicts with a high-confidence meaning summary.
 */
export function isTopicConsistentWithMeaning(
  topic: StoryTopicId,
  meaning: ConversationMeaningSummary
): boolean {
  if (meaning.confidence < 0.62) return true;
  if (topic === meaning.primaryTopic) return true;
  if (meaning.secondaryTopics.includes(topic)) return true;
  // Soft allow: general_curiosity never hard-conflicts
  if (topic === 'general_curiosity' || meaning.primaryTopic === 'general_curiosity') {
    return true;
  }
  return false;
}

/**
 * Remap ambiguous cue tokens using conversation meaning (supporting signal only).
 */
export function remapAmbiguousCueToken(
  token: string,
  meaning: ConversationMeaningSummary
): { token: string; topicOverride?: StoryTopicId } {
  const normalized = token.trim().toLowerCase();
  if (!AMBIGUOUS_TOPIC_TOKENS.has(normalized)) {
    return { token: normalized };
  }

  if (meaning.primaryTopic === 'travel' && meaning.confidence >= 0.55) {
    return { token: normalized, topicOverride: 'travel' };
  }
  if (meaning.primaryTopic === 'architecture' && meaning.confidence >= 0.55) {
    return { token: normalized, topicOverride: 'architecture' };
  }
  if (
    meaning.primaryTopic === 'health' &&
    meaning.confidence >= 0.7 &&
    !meaning.entities.length
  ) {
    return { token: normalized, topicOverride: 'health' };
  }

  // Ambiguous without strong domain → do not force health
  return { token: normalized, topicOverride: meaning.primaryTopic };
}
