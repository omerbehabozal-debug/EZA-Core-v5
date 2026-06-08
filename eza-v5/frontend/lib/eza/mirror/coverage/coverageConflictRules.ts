/**
 * Coverage conflict rules — reusable priority resolution (not hardcoded if-chains).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  canonicalizeCoverageToken,
  canonicalizeCoverageTokens,
  normalizeCoverageToken,
} from '@/lib/eza/mirror/coverage/coverageSynonyms';

function hasCoverageToken(tokens: readonly string[], token: string): boolean {
  const canon = canonicalizeCoverageTokens(tokens);
  const want =
    canonicalizeCoverageToken(token) ?? normalizeCoverageToken(token);
  return canon.includes(want);
}

export type CoverageConflictCandidate = {
  subtopic: SceneSubtopicId;
  confidence: number;
  priority: number;
  ruleId?: string;
};

export type CoverageConflictRule = {
  id: string;
  topic: StoryTopicId;
  whenAll?: readonly string[];
  whenAny?: readonly string[];
  whenNone?: readonly string[];
  preferSubtopic: SceneSubtopicId;
  suppressSubtopics?: readonly SceneSubtopicId[];
  priority: number;
  reason: string;
};

/** Context tag sets reused by topic boost and subtopic rules. */
export const COVERAGE_CONTEXT_TAGS = {
  travel: ['seyahat', 'gezi', 'rota', 'yolculuk', 'keşif', 'harita'] as const,
  architecture: [
    'mimari',
    'taş',
    'avlu',
    'ev',
    'restorasyon',
    'cephe',
    'malzeme',
    'tarihi yapı',
  ] as const,
  andalusia: ['sevilla', 'endülüs', 'cordoba', 'granada'] as const,
  mosque: ['cami', 'kubbe', 'minare', 'osmanlı', 'islamic'] as const,
  vault: ['tonoz', 'restorasyon', 'malzeme', 'rölöve', 'restitüsyon'] as const,
} as const;

export const COVERAGE_CONFLICT_RULES: readonly CoverageConflictRule[] = [
  {
    id: 'tonoz_mosque_heritage',
    topic: 'architecture',
    whenAll: ['tonoz', 'cami', 'kubbe'],
    preferSubtopic: 'arch_mosque_heritage',
    suppressSubtopics: ['arch_vault_study', 'arch_material_study'],
    priority: 100,
    reason: 'Tonoz + cami + kubbe → mosque heritage world',
  },
  {
    id: 'tonoz_vault_study',
    topic: 'architecture',
    whenAny: ['tonoz'],
    whenNone: ['cami'],
    preferSubtopic: 'arch_vault_study',
    suppressSubtopics: ['arch_mosque_heritage', 'arch_material_study'],
    priority: 95,
    reason: 'Tonoz without cami → vault / material study',
  },
  {
    id: 'tonoz_vault_with_restoration',
    topic: 'architecture',
    whenAll: ['tonoz'],
    whenAny: ['restorasyon', 'malzeme'],
    whenNone: ['cami'],
    preferSubtopic: 'arch_vault_study',
    suppressSubtopics: ['arch_mosque_heritage', 'arch_facade_restoration'],
    priority: 96,
    reason: 'Tonoz + restoration context → vault study',
  },
  {
    id: 'mardin_travel',
    topic: 'travel',
    whenAll: ['mardin'],
    whenAny: [...COVERAGE_CONTEXT_TAGS.travel],
    preferSubtopic: 'travel_mardin',
    suppressSubtopics: ['travel_generic_journey', 'travel_spain'],
    priority: 90,
    reason: 'Mardin + travel context → travel Mardin',
  },
  {
    id: 'mardin_architecture_heritage',
    topic: 'architecture',
    whenAll: ['mardin'],
    whenAny: [...COVERAGE_CONTEXT_TAGS.architecture, 'taş şehir', 'mardin evleri'],
    preferSubtopic: 'arch_mardin_heritage',
    suppressSubtopics: ['topic_generic', 'arch_facade_restoration'],
    priority: 90,
    reason: 'Mardin + heritage context → Mardin stone heritage',
  },
  {
    id: 'mardin_architecture_default',
    topic: 'architecture',
    whenAll: ['mardin'],
    preferSubtopic: 'arch_mardin_heritage',
    suppressSubtopics: ['topic_generic'],
    priority: 80,
    reason: 'Mardin alone → architecture heritage default',
  },
  {
    id: 'spain_andalusia',
    topic: 'travel',
    whenAll: ['ispanya'],
    whenAny: [...COVERAGE_CONTEXT_TAGS.andalusia],
    preferSubtopic: 'travel_andalusia',
    suppressSubtopics: ['travel_spain', 'travel_generic_journey'],
    priority: 85,
    reason: 'Spain + Andalusia city → Andalusia subtopic',
  },
  {
    id: 'andalusia_cities',
    topic: 'travel',
    whenAny: [...COVERAGE_CONTEXT_TAGS.andalusia],
    preferSubtopic: 'travel_andalusia',
    suppressSubtopics: ['travel_spain', 'travel_generic_journey'],
    priority: 84,
    reason: 'Andalusia city without explicit Spain still maps to Andalusia',
  },
  {
    id: 'spain_only',
    topic: 'travel',
    whenAll: ['ispanya'],
    whenNone: [...COVERAGE_CONTEXT_TAGS.andalusia],
    preferSubtopic: 'travel_spain',
    suppressSubtopics: ['travel_generic_journey', 'travel_andalusia'],
    priority: 75,
    reason: 'Spain without Andalusia city → travel_spain',
  },
];

function ruleMatches(tokens: readonly string[], rule: CoverageConflictRule): boolean {
  if (rule.whenAll?.length && !rule.whenAll.every((t) => hasCoverageToken(tokens, t))) {
    return false;
  }
  if (rule.whenAny?.length && !rule.whenAny.some((t) => hasCoverageToken(tokens, t))) {
    return false;
  }
  if (rule.whenNone?.length && rule.whenNone.some((t) => hasCoverageToken(tokens, t))) {
    return false;
  }
  if (!rule.whenAll?.length && !rule.whenAny?.length) {
    return false;
  }
  return true;
}

/**
 * Apply conflict rules to candidate list; returns adjusted winner or conflict-picked subtopic.
 */
export function applyCoverageConflictRules(
  topic: StoryTopicId,
  tokens: readonly string[],
  candidates: CoverageConflictCandidate[]
): CoverageConflictCandidate | null {
  if (!candidates.length) return null;

  const topicRules = COVERAGE_CONFLICT_RULES.filter((r) => r.topic === topic).sort(
    (a, b) => b.priority - a.priority
  );

  for (const rule of topicRules) {
    if (!ruleMatches(tokens, rule)) continue;

    const preferred = candidates.find((c) => c.subtopic === rule.preferSubtopic);
    if (preferred) {
      return { ...preferred, priority: rule.priority, ruleId: rule.id };
    }

    return {
      subtopic: rule.preferSubtopic,
      confidence: 0.72,
      priority: rule.priority,
      ruleId: rule.id,
    };
  }

  const ranked = [...candidates].sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
  return ranked[0] ?? null;
}

/** Topic-level boost when ambiguous city tokens need context (e.g. Mardin). */
export function resolveCoverageTopicBoosts(
  tokens: readonly string[]
): ReadonlyArray<{ topic: StoryTopicId; weight: number }> {
  const boosts: { topic: StoryTopicId; weight: number }[] = [];

  if (!hasCoverageToken(tokens, 'mardin')) return boosts;

  const hasTravel = COVERAGE_CONTEXT_TAGS.travel.some((t) => hasCoverageToken(tokens, t));
  const hasArch = COVERAGE_CONTEXT_TAGS.architecture.some((t) => hasCoverageToken(tokens, t));

  if (hasTravel && !hasArch) {
    boosts.push({ topic: 'travel', weight: 2 });
  } else if (hasArch || !hasTravel) {
    boosts.push({ topic: 'architecture', weight: hasArch ? 2 : 1.5 });
  }

  return boosts;
}
