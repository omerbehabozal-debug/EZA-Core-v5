/**
 * Conversation Mirror V2 — topic extraction scoped to a single active chat thread.
 * SAINA selects topics; OpenAI only renders the chosen cinematic narrative.
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

export type ConversationCandidateTopic = SainaMirrorPayload['candidateTopics'][number];

type InternalCandidate = ConversationCandidateTopic & {
  storyTopicId: StoryTopicId;
  clusterId: string;
};

const MAX_CANDIDATES = 5;
const RECENCY_WINDOW = 3;
const RECENCY_BOOST = 1.5;
const SINGLE_TOPIC_DOMINANCE_RATIO = 0.7;

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

/**
 * Extract weighted candidate topics from active conversation entries only.
 * Never reads global history or other chat threads.
 */
export function extractConversationCandidateTopics(
  entries: SavedBehavioralEntry[]
): InternalCandidate[] {
  const map = new Map<string, InternalCandidate>();
  const chronological = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const total = chronological.length;

  chronological.forEach((entry, index) => {
    const recencyRank = total - 1 - index;
    const recencyWeight = recencyRank < RECENCY_WINDOW ? RECENCY_BOOST : 1;
    const engagement = turnEngagement(entry);

    const tokens = canonicalizeCoverageTokens(
      (entry.mirrorCueHints ?? []).map((hint) => String(hint))
    );
    if (!tokens.length) return;

    const clusters = matchTurnToClusters(tokens);
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

    for (const token of tokens) {
      const storyTopicId = resolveStoryTopicForToken(token) ?? 'general_curiosity';
      const topic = displayLabelForToken(token, storyTopicId);
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
};

/**
 * Resolve the cinematic topic for one conversation thread.
 * Selected topic is always grounded in that thread's messages.
 */
export function resolveActiveConversationTopics(
  entries: SavedBehavioralEntry[],
  seed: string
): ActiveConversationTopicResolution {
  const candidates = extractConversationCandidateTopics(entries);
  const picked = selectWeightedConversationTopic(candidates, seed);

  const primaryTopic = picked?.storyTopicId ?? 'general_curiosity';
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
  };
}
