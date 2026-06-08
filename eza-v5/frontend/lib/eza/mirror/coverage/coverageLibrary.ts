/**
 * Topic Coverage Library — scalable registry-first cue/subtopic foundation (P5.2A).
 * Add new cities, countries, and concepts via CoverageCueRule + CoverageSubtopicRule entries.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { TopicCueRule } from '@/lib/eza/mirror/storyTopicCueRegistry';
import { MAX_CUE_TOKEN_LENGTH } from '@/lib/eza/mirror/storyTopicCueRegistry';
import {
  canonicalizeCoverageToken,
  canonicalizeCoverageTokens,
  getSynonymVariants,
  matchCoveragePattern,
  normalizeCoverageText,
  normalizeCoverageToken,
} from '@/lib/eza/mirror/coverage/coverageSynonyms';
import {
  applyCoverageConflictRules,
  resolveCoverageTopicBoosts,
  type CoverageConflictCandidate,
} from '@/lib/eza/mirror/coverage/coverageConflictRules';

export const COVERAGE_LIBRARY_VERSION = '5.2.0';

export type CoverageExtractPhase = 'topic' | 'subtopic' | 'both';

export type CoverageCueRule = {
  token: string;
  displayLabelTr: string;
  topic: StoryTopicId;
  subtopic?: SceneSubtopicId;
  patterns: readonly string[];
  synonymGroupId?: string;
  priority: number;
  contextTags?: readonly string[];
  minHits?: number;
  extractPhase: CoverageExtractPhase;
};

export type CoverageSubtopicRule = {
  id: string;
  topic: StoryTopicId;
  subtopic: SceneSubtopicId;
  whenAll?: readonly string[];
  whenAny?: readonly string[];
  whenAnyMin?: number;
  whenNone?: readonly string[];
  priority: number;
  confidence: number;
};

export type CoverageDomain = {
  id: StoryTopicId;
  labelTr: string;
  active: boolean;
  subtopicResolver: boolean;
};

/** Extensible domain list — inactive domains reserved for 5.2B+. */
export const COVERAGE_DOMAINS: readonly CoverageDomain[] = [
  { id: 'travel', labelTr: 'Seyahat', active: true, subtopicResolver: true },
  { id: 'architecture', labelTr: 'Mimari', active: true, subtopicResolver: true },
  { id: 'vehicle', labelTr: 'Araç', active: true, subtopicResolver: true },
  { id: 'technology_ai', labelTr: 'Teknoloji & AI', active: true, subtopicResolver: true },
  { id: 'finance', labelTr: 'Finans', active: false, subtopicResolver: false },
  { id: 'health', labelTr: 'Sağlık', active: false, subtopicResolver: false },
  { id: 'food_culture', labelTr: 'Yemek & Kültür', active: false, subtopicResolver: false },
  { id: 'family', labelTr: 'Aile', active: false, subtopicResolver: false },
  { id: 'education', labelTr: 'Eğitim', active: false, subtopicResolver: false },
  { id: 'spiritual_reflection', labelTr: 'Manevi', active: false, subtopicResolver: false },
];

function cue(
  token: string,
  displayLabelTr: string,
  topic: StoryTopicId,
  patterns: readonly string[],
  opts: Partial<Omit<CoverageCueRule, 'token' | 'displayLabelTr' | 'topic' | 'patterns'>> = {}
): CoverageCueRule {
  const safe = token.slice(0, MAX_CUE_TOKEN_LENGTH);
  const synonymPatterns = opts.synonymGroupId
    ? getSynonymVariants(opts.synonymGroupId)
    : [];
  const merged = Array.from(new Set([...patterns, ...synonymPatterns]));
  return {
    token: safe,
    displayLabelTr,
    topic,
    patterns: merged,
    priority: opts.priority ?? 50,
    extractPhase: opts.extractPhase ?? 'both',
    ...opts,
  };
}

/** Canonical cue registry — extend by appending rules, not editing resolver if-chains. */
export const COVERAGE_CUE_RULES: readonly CoverageCueRule[] = [
  // —— Travel ——
  cue('ispanya', 'İspanya', 'travel', ['ispanya', 'spain'], {
    synonymGroupId: 'ispanya',
    subtopic: 'travel_spain',
    priority: 70,
    extractPhase: 'both',
  }),
  cue('sevilla', 'Sevilla', 'travel', ['sevilla', 'seville'], {
    synonymGroupId: 'sevilla',
    subtopic: 'travel_andalusia',
    priority: 82,
    contextTags: ['andalusia'],
    extractPhase: 'both',
  }),
  cue('endülüs', 'Endülüs', 'travel', ['endülüs', 'endulus', 'andalusia', 'andalucia'], {
    synonymGroupId: 'endulus',
    subtopic: 'travel_andalusia',
    priority: 82,
    contextTags: ['andalusia'],
    extractPhase: 'both',
  }),
  cue('cordoba', 'Cordoba', 'travel', ['cordoba', 'kordoba'], {
    synonymGroupId: 'cordoba',
    subtopic: 'travel_andalusia',
    priority: 81,
    contextTags: ['andalusia'],
    extractPhase: 'both',
  }),
  cue('granada', 'Granada', 'travel', ['granada', 'gırnata', 'girnata'], {
    synonymGroupId: 'granada',
    subtopic: 'travel_andalusia',
    priority: 81,
    contextTags: ['andalusia'],
    extractPhase: 'both',
  }),
  cue('mardin', 'Mardin', 'architecture', ['mardin'], {
    synonymGroupId: 'mardin',
    subtopic: 'arch_mardin_heritage',
    priority: 78,
    contextTags: ['heritage', 'city'],
    extractPhase: 'both',
  }),
  cue('taş şehir', 'Taş Şehir', 'architecture', ['taş şehir', 'tas sehir'], {
    synonymGroupId: 'mardin',
    subtopic: 'arch_mardin_heritage',
    priority: 76,
    contextTags: ['heritage'],
    extractPhase: 'subtopic',
  }),
  cue('avlu', 'Avlu', 'architecture', ['avlu', 'courtyard', 'avlulu ev'], {
    synonymGroupId: 'avlu',
    priority: 55,
    contextTags: ['heritage'],
    extractPhase: 'both',
  }),
  cue('tarihi yapı', 'Tarihi Yapı', 'architecture', ['tarihi yapı', 'tarihi yapi'], {
    priority: 54,
    contextTags: ['heritage'],
    extractPhase: 'both',
  }),
  cue('taş', 'Taş', 'architecture', ['taş', 'tas', 'stone'], {
    synonymGroupId: 'tas',
    priority: 52,
    contextTags: ['heritage'],
    extractPhase: 'both',
  }),
  // —— Architecture (gap + scale) ——
  cue('tonoz', 'Tonoz', 'architecture', ['tonoz', 'vault', 'beşik tonoz', 'besik tonoz'], {
    synonymGroupId: 'tonoz',
    subtopic: 'arch_vault_study',
    priority: 72,
    contextTags: ['vault'],
    extractPhase: 'both',
  }),
];

/** Subtopic resolution rules — priority-ordered declarative matchers. */
export const COVERAGE_SUBTOPIC_RULES: readonly CoverageSubtopicRule[] = [
  // Travel — existing (migrated for unified coverage path)
  {
    id: 'travel_silk_road_cities',
    topic: 'travel',
    subtopic: 'travel_silk_road',
    whenAll: ['semerkant', 'buhara'],
    priority: 95,
    confidence: 0.88,
  },
  {
    id: 'travel_silk_road_uz',
    topic: 'travel',
    subtopic: 'travel_silk_road',
    whenAll: ['özbekistan', 'semerkant', 'buhara'],
    priority: 96,
    confidence: 0.88,
  },
  {
    id: 'travel_samarkand',
    topic: 'travel',
    subtopic: 'travel_samarkand',
    whenAny: ['semerkant'],
    priority: 80,
    confidence: 0.72,
  },
  {
    id: 'travel_bukhara',
    topic: 'travel',
    subtopic: 'travel_bukhara',
    whenAny: ['buhara'],
    priority: 80,
    confidence: 0.72,
  },
  {
    id: 'travel_uzbekistan',
    topic: 'travel',
    subtopic: 'travel_uzbekistan',
    whenAny: ['özbekistan'],
    whenNone: ['semerkant', 'buhara'],
    priority: 75,
    confidence: 0.72,
  },
  {
    id: 'travel_andalusia',
    topic: 'travel',
    subtopic: 'travel_andalusia',
    whenAny: ['sevilla', 'endülüs', 'cordoba', 'granada'],
    priority: 85,
    confidence: 0.72,
  },
  {
    id: 'travel_spain',
    topic: 'travel',
    subtopic: 'travel_spain',
    whenAny: ['ispanya'],
    priority: 70,
    confidence: 0.72,
  },
  {
    id: 'travel_mardin',
    topic: 'travel',
    subtopic: 'travel_mardin',
    whenAll: ['mardin'],
    whenAny: ['seyahat', 'gezi', 'rota', 'yolculuk', 'keşif', 'harita'],
    priority: 88,
    confidence: 0.72,
  },
  {
    id: 'travel_generic_journey',
    topic: 'travel',
    subtopic: 'travel_generic_journey',
    whenAny: ['seyahat', 'rota', 'harita', 'keşif', 'yolculuk'],
    priority: 40,
    confidence: 0.72,
  },
  // Architecture
  {
    id: 'arch_mardin_heritage',
    topic: 'architecture',
    subtopic: 'arch_mardin_heritage',
    whenAny: ['mardin', 'taş şehir', 'avlu', 'tarihi yapı'],
    whenAnyMin: 1,
    priority: 85,
    confidence: 0.72,
  },
  {
    id: 'arch_mardin_stone',
    topic: 'architecture',
    subtopic: 'arch_mardin_stone',
    whenAll: ['mardin'],
    whenAny: ['taş', 'mermer', 'cephe'],
    priority: 86,
    confidence: 0.72,
  },
  {
    id: 'arch_vault_study',
    topic: 'architecture',
    subtopic: 'arch_vault_study',
    whenAny: ['tonoz'],
    whenNone: ['cami'],
    priority: 82,
    confidence: 0.72,
  },
  {
    id: 'arch_mosque_heritage',
    topic: 'architecture',
    subtopic: 'arch_mosque_heritage',
    whenAny: ['cami', 'minare', 'islamic', 'osmanlı', 'kubbe'],
    priority: 78,
    confidence: 0.72,
  },
  {
    id: 'arch_facade_restoration',
    topic: 'architecture',
    subtopic: 'arch_facade_restoration',
    whenAny: ['cephe', 'söve', 'taş kaplama', 'mermer', 'malzeme'],
    priority: 70,
    confidence: 0.72,
  },
  {
    id: 'arch_material_study',
    topic: 'architecture',
    subtopic: 'arch_material_study',
    whenAny: ['restorasyon', 'rölöve', 'restitüsyon'],
    whenNone: ['tonoz'],
    priority: 65,
    confidence: 0.72,
  },
];

export function hasCoverageToken(tokens: readonly string[], token: string): boolean {
  const canon = canonicalizeCoverageTokens(tokens);
  const want =
    canonicalizeCoverageToken(token) ?? normalizeCoverageToken(token);
  return canon.includes(want);
}

function subtopicRuleMatches(tokens: readonly string[], rule: CoverageSubtopicRule): boolean {
  if (rule.whenAll?.length && !rule.whenAll.every((t) => hasCoverageToken(tokens, t))) {
    return false;
  }
  if (rule.whenNone?.length && rule.whenNone.some((t) => hasCoverageToken(tokens, t))) {
    return false;
  }
  if (rule.whenAny?.length) {
    const hits = rule.whenAny.filter((t) => hasCoverageToken(tokens, t)).length;
    const min = rule.whenAnyMin ?? 1;
    if (hits < min) return false;
  }
  if (!rule.whenAll?.length && !rule.whenAny?.length) return false;
  return true;
}

function collectSubtopicCandidates(
  topic: StoryTopicId,
  tokens: readonly string[]
): CoverageConflictCandidate[] {
  const canon = canonicalizeCoverageTokens(tokens);
  const candidates: CoverageConflictCandidate[] = [];

  for (const rule of COVERAGE_SUBTOPIC_RULES) {
    if (rule.topic !== topic) continue;
    if (!subtopicRuleMatches(canon, rule)) continue;
    candidates.push({
      subtopic: rule.subtopic,
      confidence: rule.confidence,
      priority: rule.priority,
      ruleId: rule.id,
    });
  }

  return candidates;
}

/**
 * Coverage-first subtopic resolution. Returns null when no coverage rule matches
 * (legacy resolver may handle remaining cases in 5.2A).
 */
export function resolveCoverageSubtopic(
  primaryTopic: StoryTopicId,
  cueTokens: readonly string[]
): { subtopic: SceneSubtopicId; confidence: number; ruleId?: string } | null {
  const domain = COVERAGE_DOMAINS.find((d) => d.id === primaryTopic);
  if (!domain?.active || !domain.subtopicResolver) return null;

  const tokens = canonicalizeCoverageTokens(cueTokens);
  if (!tokens.length) return null;

  const candidates = collectSubtopicCandidates(primaryTopic, tokens);
  if (!candidates.length) return null;

  const resolved = applyCoverageConflictRules(primaryTopic, tokens, candidates);
  if (!resolved) return null;

  return {
    subtopic: resolved.subtopic,
    confidence: resolved.confidence,
    ruleId: resolved.ruleId,
  };
}

/** Rules merged into story cue extraction (topic + subtopic phases). */
export function getCoverageExtractionRules(): readonly TopicCueRule[] {
  return COVERAGE_CUE_RULES.filter(
    (r) => r.extractPhase === 'topic' || r.extractPhase === 'both'
  ).map((r) => ({
    token: r.token,
    topic: r.topic,
    patterns: r.patterns,
  }));
}

/** Extract whitelist tokens using coverage normalization + synonym patterns. */
export function extractCoverageCueTokens(
  userText: string,
  maxTokens: number
): string[] {
  const normalized = normalizeCoverageText(userText);
  if (!normalized.trim()) return [];

  const rules = [...COVERAGE_CUE_RULES].sort(
    (a, b) =>
      Math.max(...b.patterns.map((p) => p.length)) -
      Math.max(...a.patterns.map((p) => p.length))
  );

  const found: string[] = [];
  for (const entry of rules) {
    if (found.includes(entry.token)) continue;
    if (entry.patterns.some((pattern) => matchCoveragePattern(normalized, pattern))) {
      found.push(entry.token);
    }
    if (found.length >= maxTokens) break;
  }

  return found.map(
    (t) => canonicalizeCoverageToken(t) ?? normalizeCoverageToken(t)
  );
}

const COVERAGE_TOKEN_TO_TOPIC = new Map<string, StoryTopicId>(
  COVERAGE_CUE_RULES.map((r) => [r.token, r.topic])
);

/** Topic lookup for coverage-only cue tokens (e.g. ispanya, mardin). */
export function getCoverageTopicForToken(token: string): StoryTopicId | undefined {
  const canon =
    canonicalizeCoverageToken(token) ?? normalizeCoverageToken(token);
  return COVERAGE_TOKEN_TO_TOPIC.get(canon);
}

export { resolveCoverageTopicBoosts };
