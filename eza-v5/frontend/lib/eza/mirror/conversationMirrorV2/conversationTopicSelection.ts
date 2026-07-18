/**
 * Conversation Mirror V2 — topic extraction scoped to a single active chat thread.
 *
 * Decision order (semantic-first):
 * 1. Conversation meaning summary (entities + intent + domain signals)
 * 2. Cue/cluster scoring as supporting evidence
 * 3. Consistency gate — high-confidence meaning cannot be overridden by ambiguous cues
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  getTopicForToken,
  TOPIC_CUE_RULES,
} from '@/lib/eza/mirror/storyTopicCueRegistry';
import { getCoverageTopicForToken } from '@/lib/eza/mirror/coverage/coverageLibrary';
import { canonicalizeCoverageTokens } from '@/lib/eza/mirror/coverage/coverageSynonyms';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import { TOPIC_MIRROR_TEMPLATES } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalog';
import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import {
  matchTurnToClusters,
  type ConversationTopicCluster,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicClusters';
import {
  AMBIGUOUS_TOPIC_TOKENS,
  buildConversationMeaningSummary,
  isTopicConsistentWithMeaning,
  remapAmbiguousCueToken,
  type ConversationMeaningSummary,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationMeaningSummary';

export type ConversationCandidateTopic = SainaMirrorPayload['candidateTopics'][number];

type InternalCandidate = ConversationCandidateTopic & {
  storyTopicId: StoryTopicId;
  clusterId: string;
};

const MAX_CANDIDATES = 5;
const RECENCY_WINDOW = 3;
const RECENCY_BOOST = 1.5;
const SINGLE_TOPIC_DOMINANCE_RATIO = 0.7;
/** Meaning confidence at/above this blocks cue overrides from ambiguous tokens. */
const MEANING_AUTHORITY_CONFIDENCE = 0.62;

const TOKEN_DISPLAY_LABEL = new Map<string, string>(
  TOPIC_CUE_RULES.map((rule) => [rule.token, rule.token])
);

function hashToUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function resolveStoryTopicForToken(token: string): StoryTopicId | undefined {
  return getTopicForToken(token) ?? getCoverageTopicForToken(token);
}

function displayLabelForToken(token: string, storyTopicId: StoryTopicId): string {
  const normalized = token.trim();
  if (!normalized) {
    return TOPIC_MIRROR_TEMPLATES[storyTopicId]?.topicLabel ?? 'Merak';
  }
  if (normalized.length <= 3) {
    return TOPIC_MIRROR_TEMPLATES[storyTopicId]?.topicLabel ?? normalized;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function turnEngagement(entry: SavedBehavioralEntry): number {
  const alignment = entry.vector.alignment_score ?? entry.vector.eza_final ?? 70;
  const hintDepth = Math.min(4, (entry.mirrorCueHints ?? []).length);
  return 0.6 + hintDepth * 0.15 + Math.max(0, Math.min(1, alignment / 100)) * 0.4;
}

function clusterKey(cluster: ConversationTopicCluster): string {
  return `cluster:${cluster.id}`;
}

function tokenFallbackKey(topic: string, storyTopicId: StoryTopicId): string {
  return `token:${storyTopicId}::${topic.toLowerCase()}`;
}

function upsertCandidate(
  map: Map<string, InternalCandidate>,
  key: string,
  next: Omit<InternalCandidate, 'weight'> & { weightDelta: number; depthDelta: number }
): void {
  const prev = map.get(key);
  if (!prev) {
    map.set(key, {
      topic: next.topic,
      source: 'active_conversation',
      storyTopicId: next.storyTopicId,
      clusterId: next.clusterId,
      messageCount: next.messageCount,
      depthScore: next.depthDelta,
      weight: next.weightDelta,
    });
    return;
  }

  prev.messageCount = (prev.messageCount ?? 0) + (next.messageCount ?? 0);
  prev.depthScore = Math.round(((prev.depthScore ?? 0) + next.depthDelta) * 10) / 10;
  prev.weight = Math.round((prev.weight + next.weightDelta) * 10) / 10;
}

function collectAllCueTokens(entries: SavedBehavioralEntry[]): string[] {
  const tokens: string[] = [];
  for (const entry of entries) {
    for (const hint of entry.mirrorCueHints ?? []) {
      const t = String(hint).trim().toLowerCase();
      if (t && !tokens.includes(t)) tokens.push(t);
    }
  }
  return tokens;
}

function filterClustersForMeaning(
  clusters: ConversationTopicCluster[],
  meaning: ConversationMeaningSummary,
  tokens: readonly string[]
): ConversationTopicCluster[] {
  if (meaning.confidence < MEANING_AUTHORITY_CONFIDENCE) return clusters;

  return clusters.filter((cluster) => {
    if (isTopicConsistentWithMeaning(cluster.storyTopicId, meaning)) return true;

    // Drop health/wellness hits that only come from ambiguous walk cues under travel meaning.
    const onlyAmbiguous =
      tokens.length > 0 &&
      tokens.every((token) => AMBIGUOUS_TOPIC_TOKENS.has(token.toLowerCase()));
    if (
      cluster.storyTopicId === 'health' &&
      meaning.primaryTopic === 'travel' &&
      onlyAmbiguous
    ) {
      return false;
    }
    if (
      cluster.storyTopicId === 'health' &&
      meaning.primaryTopic === 'travel' &&
      cluster.id === 'health_wellness'
    ) {
      return false;
    }
    return false;
  });
}

/**
 * Extract weighted candidate topics from active conversation entries only.
 * Never reads global history or other chat threads.
 */
export function extractConversationCandidateTopics(
  entries: SavedBehavioralEntry[],
  options?: { conversationTexts?: readonly string[]; meaning?: ConversationMeaningSummary }
): InternalCandidate[] {
  const meaning =
    options?.meaning ??
    buildConversationMeaningSummary({
      conversationTexts: options?.conversationTexts,
      cueTokens: collectAllCueTokens(entries),
    });

  const map = new Map<string, InternalCandidate>();
  const chronological = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const total = chronological.length;

  chronological.forEach((entry, index) => {
    const recencyRank = total - 1 - index;
    const recencyWeight = recencyRank < RECENCY_WINDOW ? RECENCY_BOOST : 1;
    const engagement = turnEngagement(entry);

    const rawTokens = canonicalizeCoverageTokens(
      (entry.mirrorCueHints ?? []).map((hint) => String(hint))
    );
    if (!rawTokens.length) return;

    const remapped = rawTokens.map((token) => remapAmbiguousCueToken(token, meaning));
    const tokens = remapped.map((item) => item.token);
    const topicOverrides = remapped
      .map((item) => item.topicOverride)
      .filter((topic): topic is StoryTopicId => Boolean(topic));

    let clusters = matchTurnToClusters(tokens);
    clusters = filterClustersForMeaning(clusters, meaning, tokens);

    // If remapping forced travel/architecture for ambiguous walk, inject synthetic cluster weight.
    if (
      !clusters.length &&
      topicOverrides.includes(meaning.primaryTopic) &&
      meaning.confidence >= MEANING_AUTHORITY_CONFIDENCE
    ) {
      const label =
        TOPIC_MIRROR_TEMPLATES[meaning.primaryTopic]?.topicLabel ?? meaning.primaryTopic;
      const key = `meaning:${meaning.primaryTopic}`;
      const depthDelta = Math.round(tokens.length * engagement * recencyWeight * 10) / 10;
      upsertCandidate(map, key, {
        topic: label,
        source: 'active_conversation',
        storyTopicId: meaning.primaryTopic,
        clusterId: key,
        messageCount: 1,
        depthDelta,
        weightDelta: Math.round((4 + depthDelta) * 10) / 10,
      });
      return;
    }

    const depthDelta = Math.round(tokens.length * engagement * recencyWeight * 10) / 10;

    if (clusters.length > 0) {
      for (const cluster of clusters) {
        const weightDelta =
          Math.round((3 + depthDelta / clusters.length + (recencyWeight > 1 ? 1.5 : 0)) * 10) /
          10;
        upsertCandidate(map, clusterKey(cluster), {
          topic: cluster.label,
          source: 'active_conversation',
          storyTopicId: cluster.storyTopicId,
          clusterId: cluster.id,
          messageCount: 1,
          depthDelta: Math.round((depthDelta / clusters.length) * 10) / 10,
          weightDelta,
        });
      }
      return;
    }

    for (const item of remapped) {
      const storyTopicId =
        item.topicOverride ??
        resolveStoryTopicForToken(item.token) ??
        'general_curiosity';

      // Skip ambiguous→health when meaning says otherwise
      if (
        AMBIGUOUS_TOPIC_TOKENS.has(item.token) &&
        storyTopicId === 'health' &&
        meaning.primaryTopic !== 'health' &&
        meaning.confidence >= MEANING_AUTHORITY_CONFIDENCE
      ) {
        continue;
      }

      const topic = displayLabelForToken(item.token, storyTopicId);
      const key = tokenFallbackKey(topic, storyTopicId);
      const weightDelta =
        Math.round((1.5 + depthDelta / tokens.length + (recencyWeight > 1 ? 0.5 : 0)) * 10) /
        10;
      upsertCandidate(map, key, {
        topic,
        source: 'active_conversation',
        storyTopicId,
        clusterId: key,
        messageCount: 1,
        depthDelta: Math.round((depthDelta / tokens.length) * 10) / 10,
        weightDelta,
      });
    }
  });

  // Seed meaning primary only when no cue/cluster candidate already covers it.
  if (meaning.confidence >= MEANING_AUTHORITY_CONFIDENCE) {
    const hasAligned = Array.from(map.values()).some(
      (candidate) => candidate.storyTopicId === meaning.primaryTopic
    );
    if (!hasAligned) {
      const label =
        TOPIC_MIRROR_TEMPLATES[meaning.primaryTopic]?.topicLabel ?? meaning.primaryTopic;
      const key = `meaning:${meaning.primaryTopic}`;
      upsertCandidate(map, key, {
        topic: label,
        source: 'active_conversation',
        storyTopicId: meaning.primaryTopic,
        clusterId: key,
        messageCount: Math.max(1, entries.length),
        depthDelta: 5,
        weightDelta: Math.round((6 + meaning.confidence * 4) * 10) / 10,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CANDIDATES);
}

/** Deterministic weighted pick — not uniform random; favors depth and frequency. */
export function selectWeightedConversationTopic(
  candidates: InternalCandidate[],
  seed: string
): InternalCandidate | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0] ?? null;

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (totalWeight <= 0) return candidates[0] ?? null;

  const dominant = candidates[0]!;
  if (dominant.weight / totalWeight >= SINGLE_TOPIC_DOMINANCE_RATIO) {
    return dominant;
  }

  let roll = hashToUnit(`${seed}-topic`) * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }
  return candidates[0] ?? null;
}

export type ActiveConversationTopicResolution = {
  selectedTopic: string;
  candidateTopics: ConversationCandidateTopic[];
  primaryTopic: StoryTopicId;
  meaning: ConversationMeaningSummary;
};

export type ResolveActiveConversationTopicsOptions = {
  conversationTexts?: readonly string[];
};

/**
 * Resolve the cinematic topic for one conversation thread.
 * Semantic meaning is the primary authority when confidence is high.
 */
export function resolveActiveConversationTopics(
  entries: SavedBehavioralEntry[],
  seed: string,
  options?: ResolveActiveConversationTopicsOptions
): ActiveConversationTopicResolution {
  const meaning = buildConversationMeaningSummary({
    conversationTexts: options?.conversationTexts,
    cueTokens: collectAllCueTokens(entries),
  });

  const candidates = extractConversationCandidateTopics(entries, {
    conversationTexts: options?.conversationTexts,
    meaning,
  });

  let picked: InternalCandidate | null = null;

  if (meaning.confidence >= MEANING_AUTHORITY_CONFIDENCE) {
    const aligned = candidates
      .filter((candidate) => candidate.storyTopicId === meaning.primaryTopic)
      .sort((a, b) => b.weight - a.weight);
    if (aligned.length) {
      // Prefer specific place/cluster labels over generic token labels.
      const japanPreferred = aligned.find((candidate) =>
        /japonya seyahati/i.test(candidate.topic)
      );
      picked = japanPreferred ?? aligned[0] ?? null;
    }
  }

  if (!picked) {
    picked = selectWeightedConversationTopic(candidates, seed);
  }

  // Consistency validation: high-confidence meaning wins over conflicting cue pick.
  if (
    picked &&
    meaning.confidence >= MEANING_AUTHORITY_CONFIDENCE &&
    !isTopicConsistentWithMeaning(picked.storyTopicId, meaning)
  ) {
    const meaningCandidate = candidates
      .filter((c) => c.storyTopicId === meaning.primaryTopic)
      .sort((a, b) => b.weight - a.weight)[0];
    if (meaningCandidate) {
      picked = meaningCandidate;
    } else {
      picked = {
        topic:
          TOPIC_MIRROR_TEMPLATES[meaning.primaryTopic]?.topicLabel ?? meaning.primaryTopic,
        source: 'active_conversation',
        weight: meaning.confidence * 10,
        messageCount: entries.length,
        depthScore: 5,
        storyTopicId: meaning.primaryTopic,
        clusterId: `meaning:${meaning.primaryTopic}`,
      };
    }
  }

  const primaryTopic = picked?.storyTopicId ?? meaning.primaryTopic ?? 'general_curiosity';
  const selectedTopic =
    picked?.topic ??
    TOPIC_MIRROR_TEMPLATES[primaryTopic]?.topicLabel ??
    'Merak';

  return {
    selectedTopic,
    candidateTopics: candidates.map(
      ({ topic, weight, messageCount, depthScore, source }) => ({
        topic,
        weight,
        messageCount,
        depthScore,
        source,
      })
    ),
    primaryTopic,
    meaning,
  };
}
