/**
 * Semantic topic clusters for Conversation Mirror — groups cue tokens into
 * human-readable sub-topics within a single chat thread.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type ConversationTopicCluster = {
  id: string;
  label: string;
  storyTopicId: StoryTopicId;
  anchors: readonly string[];
  /** Minimum anchor hits required in one turn (default 1). */
  minAnchors?: number;
};

export const CONVERSATION_TOPIC_CLUSTERS: readonly ConversationTopicCluster[] = [
  {
    id: 'fluoride_toothpaste',
    label: 'Florürlü diş macunu',
    storyTopicId: 'health',
    anchors: ['florür', 'florurlu', 'florursuz', 'fluoride'],
    minAnchors: 1,
  },
  {
    id: 'whitening_toothpaste',
    label: 'Beyazlatıcı diş macunu',
    storyTopicId: 'health',
    anchors: ['beyazlatıcı', 'beyazlatici', 'beyazlatma', 'whitening'],
    minAnchors: 1,
  },
  {
    id: 'sensitive_teeth',
    label: 'Hassas dişler',
    storyTopicId: 'health',
    anchors: ['hassas diş', 'hassasiyet', 'hassas'],
    minAnchors: 1,
  },
  {
    id: 'toothpaste_choice',
    label: 'Diş macunu seçimi',
    storyTopicId: 'health',
    anchors: ['diş macunu', 'dis macunu', 'toothpaste', 'macun'],
    minAnchors: 1,
  },
  {
    id: 'vehicle_compare',
    label: 'BMW vs Mercedes',
    storyTopicId: 'vehicle',
    anchors: ['bmw', 'mercedes', 'karşılaştır', 'versus', 'vs', 'sedan'],
    minAnchors: 1,
  },
  {
    id: 'facade_material',
    label: 'Cephe malzeme bilgisi',
    storyTopicId: 'architecture',
    anchors: ['cephe', 'malzeme', 'mimari', 'restorasyon', 'facade', 'architecture', 'building'],
    minAnchors: 1,
  },
  {
    id: 'baklava_recipe',
    label: 'Baklava tarifi',
    storyTopicId: 'food_culture',
    anchors: ['baklava'],
    minAnchors: 1,
  },
  {
    id: 'sutlac_recipe',
    label: 'Sütlaç tarifi',
    storyTopicId: 'food_culture',
    anchors: ['sütlaç', 'sutlac'],
    minAnchors: 1,
  },
  {
    id: 'japan_travel',
    label: 'Japonya seyahati',
    storyTopicId: 'travel',
    anchors: ['japonya', 'japan', 'tokyo', 'kyoto'],
    minAnchors: 1,
  },
  {
    id: 'health_wellness',
    label: 'Sağlık ve beslenme',
    storyTopicId: 'health',
    anchors: ['sağlık', 'beslenme', 'yürüyüş', 'health', 'walk'],
    minAnchors: 1,
  },
  {
    id: 'generic_recipe',
    label: 'Tarif sohbeti',
    storyTopicId: 'food_culture',
    anchors: ['tarif', 'recipe', 'mutfak'],
    minAnchors: 1,
  },
];

export function scoreClusterForTurn(
  tokens: readonly string[],
  cluster: ConversationTopicCluster
): number {
  const normalized = tokens.map((t) => t.toLowerCase());
  const matched = cluster.anchors.filter((anchor) =>
    normalized.includes(anchor.toLowerCase())
  );
  const min = cluster.minAnchors ?? 1;
  if (matched.length < min) return 0;
  let score = matched.length;
  if (cluster.anchors.length > 1 && matched.length >= 2) score += 2;
  return score;
}

export function matchTurnToCluster(
  tokens: readonly string[]
): ConversationTopicCluster | null {
  const matches = matchTurnToClusters(tokens);
  return matches[0] ?? null;
}

/** All semantic clusters referenced in one turn (for multi-topic extraction). */
export function matchTurnToClusters(
  tokens: readonly string[]
): ConversationTopicCluster[] {
  const scored = CONVERSATION_TOPIC_CLUSTERS.map((cluster) => ({
    cluster,
    score: scoreClusterForTurn(tokens, cluster),
  })).filter((entry) => entry.score > 0);

  if (!scored.length) return [];

  scored.sort((a, b) => b.score - a.score);
  let clusters = scored.map((entry) => entry.cluster);

  const hasSpecificFood = clusters.some(
    (cluster) => cluster.id === 'baklava_recipe' || cluster.id === 'sutlac_recipe'
  );
  if (hasSpecificFood) {
    clusters = clusters.filter((cluster) => cluster.id !== 'generic_recipe');
  }

  return clusters;
}
