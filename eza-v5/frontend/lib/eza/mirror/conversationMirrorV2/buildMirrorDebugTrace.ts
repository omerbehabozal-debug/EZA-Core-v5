/**
 * Mirror V2 — end-to-end debug trace for Conversation Mirror pipeline.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildDailyObservationFromEntries } from '@/lib/eza/dailyObservation';
import { composeEmotionalReflection } from '@/lib/eza/mirror/reflectionToneEngine';
import { composeMirrorStory } from '@/lib/eza/mirror/mirrorStoryEngine';
import { canonicalizeCoverageTokens } from '@/lib/eza/mirror/coverage/coverageSynonyms';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import {
  extractConversationCandidateTopics,
  selectWeightedConversationTopic,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import {
  TOPIC_MIRROR_TEMPLATES,
  pickTopicTemplate,
} from '@/lib/eza/mirror/conversationMirrorV2/topicCatalog';
import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';
import { composeSelectedTopicMirrorCopy, resolveSelectedTopicCopy } from '@/lib/eza/mirror/conversationMirrorV2/selectedTopicMirrorCopy';
import { buildMirrorV2ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { buildMirrorPayload, type BuildMirrorPayloadOptions } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import {
  matchTurnToClusters,
  CONVERSATION_TOPIC_CLUSTERS,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicClusters';
import type {
  BuildMirrorDebugTraceInput,
  MirrorDebugCandidateTopic,
  MirrorDebugQualityEvaluation,
  MirrorDebugRawMessage,
  MirrorDebugRedFlag,
  MirrorDebugSignal,
  MirrorDebugStoryEngine,
  MirrorDebugTopicSelection,
  MirrorV2DebugTrace,
} from '@/lib/eza/mirror/conversationMirrorV2/mirrorDebugTypes';

const SINGLE_TOPIC_DOMINANCE_RATIO = 0.7;
const RECENCY_WINDOW = 3;
const RECENCY_BOOST = 1.5;

const NARRATIVE_THEME_BY_TOPIC: Record<StoryTopicId, string> = {
  travel: 'Merak ve Keşif',
  vehicle: 'Karar ve Terazi',
  architecture: 'Form ve Işık',
  technology_ai: 'Anlam ve Sistem',
  finance: 'Gelecek ve Eşik',
  health: 'Denge ve Bakım',
  food_culture: 'Tat ve Hafıza',
  family: 'Yakınlık ve Ritim',
  education: 'Öğrenme ve Derinleşme',
  spiritual_reflection: 'Sessiz Anlam',
  general_curiosity: 'Günlük Merak',
};

const ARCHETYPE_BY_TOPIC: Record<StoryTopicId, string> = {
  travel: 'Explorer',
  vehicle: 'Evaluator',
  architecture: 'Craftsman',
  technology_ai: 'Builder',
  finance: 'Planner',
  health: 'Caretaker',
  food_culture: 'Storyteller',
  family: 'Companion',
  education: 'Scholar',
  spiritual_reflection: 'Seeker',
  general_curiosity: 'Observer',
};

const TITLE_TOPIC_INDEX = buildTitleTopicIndex();

function buildTitleTopicIndex(): Map<string, StoryTopicId> {
  const map = new Map<string, StoryTopicId>();
  for (const [topicId, template] of Object.entries(TOPIC_MIRROR_TEMPLATES)) {
    for (const title of template.titles) {
      map.set(title.toLowerCase(), topicId as StoryTopicId);
    }
  }
  return map;
}

function hashToUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function turnEngagement(entry: SavedBehavioralEntry): number {
  const alignment = entry.vector.alignment_score ?? entry.vector.eza_final ?? 70;
  const hintDepth = Math.min(4, (entry.mirrorCueHints ?? []).length);
  return 0.6 + hintDepth * 0.15 + Math.max(0, Math.min(1, alignment / 100)) * 0.4;
}

function formatHintsAsReadable(hints: string[]): string {
  if (!hints.length) return '(ipucu yok)';
  return hints.join(', ');
}

function buildRawConversation(
  entries: SavedBehavioralEntry[],
  conversationMessages?: BuildMirrorDebugTraceInput['options']['conversationMessages']
): MirrorDebugRawMessage[] {
  if (conversationMessages?.length) {
    const userMessages = conversationMessages.filter((m) => m.isUser && m.text.trim());
    return userMessages.map((msg, index) => ({
      index: index + 1,
      role: 'user' as const,
      text: msg.text.trim(),
      savedAt: msg.timestamp?.toISOString(),
      mirrorCueHints: canonicalizeCoverageTokens(
        entries[index]?.mirrorCueHints ?? []
      ),
      engagementScore: entries[index]
        ? Math.round(turnEngagement(entries[index]!) * 100)
        : undefined,
    }));
  }

  const chronological = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  return chronological.map((entry, index) => ({
    index: index + 1,
    role: 'user' as const,
    text: `Sistem ipuçları: ${formatHintsAsReadable(entry.mirrorCueHints ?? [])}`,
    savedAt: entry.savedAt,
    interactionId: entry.interaction_id,
    mirrorCueHints: entry.mirrorCueHints,
    engagementScore: Math.round(turnEngagement(entry) * 100),
  }));
}

function extractSignals(
  entries: SavedBehavioralEntry[],
  rawConversation: MirrorDebugRawMessage[]
): MirrorDebugSignal[] {
  const map = new Map<string, { score: number; sourceMessages: Set<number> }>();
  const chronological = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const total = chronological.length;

  chronological.forEach((entry, index) => {
    const messageIndex = index + 1;
    const recencyRank = total - 1 - index;
    const recencyWeight = recencyRank < RECENCY_WINDOW ? RECENCY_BOOST : 1;
    const engagement = turnEngagement(entry);
    const tokens = canonicalizeCoverageTokens(
      (entry.mirrorCueHints ?? []).map((hint) => String(hint))
    );

    for (const token of tokens) {
      const delta = Math.round(recencyWeight * engagement * 10) / 10;
      const prev = map.get(token);
      if (!prev) {
        map.set(token, { score: delta, sourceMessages: new Set([messageIndex]) });
      } else {
        prev.score = Math.round((prev.score + delta) * 10) / 10;
        prev.sourceMessages.add(messageIndex);
      }
    }
  });

  return Array.from(map.entries())
    .map(([signal, data]) => ({
      signal,
      score: data.score,
      sourceMessages: Array.from(data.sourceMessages).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.score - a.score);
}

function explainTopicSelection(
  candidates: MirrorDebugCandidateTopic[],
  seed: string,
  picked: MirrorDebugCandidateTopic | null
): MirrorDebugTopicSelection {
  if (!picked) {
    return {
      selectedTopic: 'Merak',
      primaryStoryTopicId: 'general_curiosity',
      method: 'fallback',
      dominantRatio: null,
      conversationConsistency: 'low',
      reasonLines: [
        'Aktif sohbette yeterli topic ipucu bulunamadı.',
        'Varsayılan general_curiosity şablonuna düşüldü.',
      ],
    };
  }

  if (candidates.length === 1) {
    return {
      selectedTopic: picked.topic,
      primaryStoryTopicId: picked.storyTopicId,
      method: 'single_candidate',
      dominantRatio: 1,
      conversationConsistency: 'high',
      reasonLines: [
        'Tek aday topic bulundu.',
        `storyTopicId: ${picked.storyTopicId}`,
        `weight: ${picked.weight}`,
      ],
    };
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  const dominant = candidates[0]!;
  const ratio = totalWeight > 0 ? dominant.weight / totalWeight : 0;
  const consistency: MirrorDebugTopicSelection['conversationConsistency'] =
    ratio >= 0.7 ? 'high' : ratio >= 0.45 ? 'medium' : 'low';

  if (ratio >= SINGLE_TOPIC_DOMINANCE_RATIO) {
    return {
      selectedTopic: picked.topic,
      primaryStoryTopicId: picked.storyTopicId,
      method: 'dominance',
      dominantRatio: Math.round(ratio * 100) / 100,
      conversationConsistency: consistency,
      reasonLines: [
        'Highest combined weight.',
        `Dominant topic ratio: ${Math.round(ratio * 100)}%.`,
        `Conversation consistency: ${consistency}.`,
        `Seçilen cluster: ${picked.clusterId} → ${picked.storyTopicId}.`,
      ],
    };
  }

  const roll = hashToUnit(`${seed}-topic`);
  return {
    selectedTopic: picked.topic,
    primaryStoryTopicId: picked.storyTopicId,
    method: 'weighted_roll',
    dominantRatio: Math.round(ratio * 100) / 100,
    conversationConsistency: consistency,
    reasonLines: [
      'Dominant topic eşiği (%70) aşılmadı — weighted deterministic roll uygulandı.',
      `Roll: ${roll.toFixed(4)} (seed: ${seed}-topic).`,
      `Toplam weight: ${totalWeight.toFixed(1)}.`,
      `Seçilen: ${picked.topic} (weight ${picked.weight}).`,
    ],
  };
}

function buildStoryEngineTrace(
  entries: SavedBehavioralEntry[],
  seed: string,
  selectedTopic: string,
  primaryStoryTopicId: StoryTopicId,
  payload: ReturnType<typeof buildMirrorPayload>
): MirrorDebugStoryEngine {
  const observation = buildDailyObservationFromEntries(entries, {
    seed,
    tone: 'standalone',
  });
  const personaFamilyId = observation.personaFamilyId ?? 'balanced_calm';

  const emotional = composeEmotionalReflection({
    entries,
    seed,
    observationHeadline: observation.manset || observation.primaryInsight,
    observationInsight: observation.primaryInsight || observation.supportLine,
    personaFamilyId,
  });

  const story = composeMirrorStory({
    entries,
    seed,
    reflectionTone: emotional.reflectionTone,
    emotionalRhythm: emotional.emotionalRhythm,
    personaFamilyId,
    observationCategoryId: observation.categoryId,
    reflectionSignals: emotional.reflectionSignals,
    microMood: emotional.microMood,
  });

  const storyLine = story.dailyJourney || story.mirrorStory || emotional.quote;
  const selectedCopy = composeSelectedTopicMirrorCopy(selectedTopic, seed);
  const template = pickTopicTemplate(primaryStoryTopicId, seed);

  const mirrorTitleCandidates = selectedCopy
    ? [selectedCopy.mirrorTitle]
    : [...template.titles];
  const sceneMetaphorCandidates = selectedCopy
    ? [selectedCopy.sceneMetaphor]
    : [...template.sceneMetaphors];

  const selectedMirrorTitle = payload.mirrorTitle;
  const selectedSceneMetaphor = payload.sceneMetaphor;

  let mirrorTitleReason: string;
  if (selectedCopy) {
    mirrorTitleReason =
      'Selected-topic copy override — başlık SAINA topic şablonundan sabitlendi (OpenAI seçmez).';
  } else {
    mirrorTitleReason = `Deterministic hashPick seed "${seed}-title" ile ${template.titles.length} aday arasından seçildi. Highest semantic match with ${primaryStoryTopicId} template pool.`;
  }

  let sceneMetaphorReason: string;
  if (selectedCopy) {
    sceneMetaphorReason =
      'Selected-topic copy override — sahne metaforu topic şablonundan sabitlendi.';
  } else {
    const signalWords = extractSignals(entries, []).slice(0, 5).map((s) => s.signal);
    sceneMetaphorReason = `hashPick seed "${seed}-scene" ile seçildi. En yüksek eşleşme: ${signalWords.join(', ') || primaryStoryTopicId} sinyalleri.`;
  }

  return {
    selectedTopic,
    narrativeTheme: NARRATIVE_THEME_BY_TOPIC[primaryStoryTopicId] ?? 'Günlük Merak',
    emotionalTone: payload.emotionalTone,
    archetype: ARCHETYPE_BY_TOPIC[primaryStoryTopicId] ?? 'Observer',
    storyTopicKey: story.storyTopicKey,
    relationshipMode: story.relationshipMode,
    storyTone: story.storyTone,
    mirrorTitleCandidates,
    selectedMirrorTitle,
    mirrorTitleReason,
    sceneMetaphorCandidates,
    selectedSceneMetaphor,
    sceneMetaphorReason,
    usedSelectedTopicCopy: Boolean(selectedCopy),
    storyLine: storyLine?.trim() || undefined,
  };
}

function tokenSetFromConversation(entries: SavedBehavioralEntry[]): Set<string> {
  const tokens = new Set<string>();
  for (const entry of entries) {
    for (const token of canonicalizeCoverageTokens(entry.mirrorCueHints ?? [])) {
      tokens.add(token.toLowerCase());
    }
  }
  return tokens;
}

function inferTitleStoryTopic(mirrorTitle: string): StoryTopicId | null {
  return TITLE_TOPIC_INDEX.get(mirrorTitle.toLowerCase()) ?? null;
}

function clusterLabelForStoryTopic(storyTopicId: StoryTopicId): string {
  const cluster = CONVERSATION_TOPIC_CLUSTERS.find((c) => c.storyTopicId === storyTopicId);
  return cluster?.label ?? TOPIC_MIRROR_TEMPLATES[storyTopicId]?.topicLabel ?? storyTopicId;
}

function evaluateQuality(
  entries: SavedBehavioralEntry[],
  payload: ReturnType<typeof buildMirrorPayload>,
  topicSelection: MirrorDebugTopicSelection,
  signals: MirrorDebugSignal[]
): MirrorDebugQualityEvaluation {
  const redFlags: MirrorDebugRedFlag[] = [];
  const reasonLines: string[] = [];
  let score = 100;

  const convTokens = tokenSetFromConversation(entries);
  const convTokenList = Array.from(convTokens);
  const keywordHits = payload.visualKeywords.filter((kw) => {
    const parts = kw.toLowerCase().split(/\s+/);
    return parts.some((p) => convTokens.has(p) || convTokenList.some((t) => p.includes(t) || t.includes(p)));
  });
  const topicTokenHits = convTokenList.filter((t) =>
    payload.selectedTopic.toLowerCase().includes(t) ||
    payload.topic.toLowerCase().includes(t)
  );

  if (keywordHits.length > 0) {
    reasonLines.push(
      `Scene keywords overlap conversation signals: ${keywordHits.join(', ')}.`
    );
  } else if (signals.length > 0) {
    score -= 12;
    reasonLines.push('Limited direct overlap between visual keywords and conversation signals.');
  }

  if (topicTokenHits.length > 0) {
    reasonLines.push(`Selected topic grounded in conversation tokens: ${topicTokenHits.join(', ')}.`);
  }

  const titleTopic = inferTitleStoryTopic(payload.mirrorTitle);
  const convStoryId = topicSelection.primaryStoryTopicId;

  if (titleTopic && titleTopic !== convStoryId) {
    score -= 45;
    const convLabel = clusterLabelForStoryTopic(convStoryId);
    redFlags.push({
      severity: 'warning',
      title: 'WARNING',
      conversationTopic: convLabel,
      mirrorTitle: payload.mirrorTitle,
      reason: `Selected title belongs to ${TITLE_TOPIC_INDEX.get(payload.mirrorTitle.toLowerCase()) ?? titleTopic} cluster. Conversation selected ${convStoryId} (${convLabel}). Conversation contains mismatched narrative framing.`,
    });
    reasonLines.push('Mirror title semantic cluster diverges from selected conversation topic.');
  } else {
    reasonLines.push(`Mirror title strongly connected to ${convStoryId} signals.`);
  }

  const selectedCopy = resolveSelectedTopicCopy(payload.selectedTopic, '');
  if (selectedCopy && payload.selectedTopic !== topicSelection.selectedTopic) {
    score -= 20;
    redFlags.push({
      severity: 'warning',
      title: 'WARNING',
      conversationTopic: topicSelection.selectedTopic,
      mirrorTitle: payload.mirrorTitle,
      reason: 'Payload selectedTopic drifted from topic resolution.',
    });
  }

  const startupTokens = ['startup', 'ürün', 'urun', 'product', 'mvp', 'roadmap'];
  const travelTokens = ['japan', 'japonya', 'tokyo', 'kyoto', 'travel'];
  const hasStartup = startupTokens.some((t) => convTokens.has(t));
  const hasTravel = travelTokens.some((t) => convTokens.has(t));

  if (hasTravel && !hasStartup && convStoryId !== 'travel') {
    score -= 35;
    redFlags.push({
      severity: 'critical',
      title: 'WARNING',
      conversationTopic: 'Japan Travel',
      mirrorTitle: payload.mirrorTitle,
      reason: `Conversation contains Japan/travel signals but selected storyTopicId is ${convStoryId}. Mismatch detected.`,
    });
  }

  if (hasStartup && !hasTravel && convStoryId === 'travel') {
    score -= 35;
    redFlags.push({
      severity: 'warning',
      title: 'WARNING',
      conversationTopic: 'Startup / Product',
      mirrorTitle: payload.mirrorTitle,
      reason: 'Startup/product signals present but travel topic selected.',
    });
  }

  if (titleTopic === 'technology_ai' && hasTravel && !hasStartup) {
    score -= 40;
    redFlags.push({
      severity: 'critical',
      title: 'WARNING',
      conversationTopic: clusterLabelForStoryTopic('travel'),
      mirrorTitle: payload.mirrorTitle,
      reason: 'Selected title belongs to startup/product strategy cluster. Conversation contains no startup signals.',
    });
  }

  if (redFlags.length === 0) {
    reasonLines.push('No unrelated topic contamination detected.');
  }

  if (payload.sceneMetaphor && keywordHits.length >= 2) {
    reasonLines.push('Scene metaphor directly derived from conversation keyword signals.');
  }

  return {
    alignmentScore: Math.max(0, Math.min(100, Math.round(score))),
    reasonLines,
    redFlags,
  };
}

/**
 * Build a full debug trace for one mirror generation pass.
 */
export function buildMirrorDebugTrace(
  input: BuildMirrorDebugTraceInput
): MirrorV2DebugTrace {
  const { entries, options } = input;
  const refDate = entries[0]?.savedAt ? new Date(entries[0].savedAt) : options.date ?? new Date();
  const dateIso = refDate.toISOString().slice(0, 10);
  const seed =
    options.seed ??
    `v2-${options.conversationId}-${entries.length}-${entries[0]?.interaction_id ?? 'empty'}-${dateIso}`;

  const payload = buildMirrorPayload(entries, options as BuildMirrorPayloadOptions);
  const openAiPrompt = buildMirrorV2ImagePrompt(payload);
  const rawConversation = buildRawConversation(entries, options.conversationMessages);
  const signals = extractSignals(entries, rawConversation);

  const internalCandidates = extractConversationCandidateTopics(entries);
  const candidateTopics: MirrorDebugCandidateTopic[] = internalCandidates.map((c) => ({
    topic: c.topic,
    weight: c.weight,
    messageCount: c.messageCount,
    depthScore: c.depthScore,
    storyTopicId: c.storyTopicId,
    clusterId: c.clusterId,
  }));

  const picked = selectWeightedConversationTopic(internalCandidates, seed);
  const topicSelection = explainTopicSelection(
    candidateTopics,
    seed,
    picked
      ? {
          topic: picked.topic,
          weight: picked.weight,
          messageCount: picked.messageCount,
          depthScore: picked.depthScore,
          storyTopicId: picked.storyTopicId,
          clusterId: picked.clusterId,
        }
      : null
  );

  const storyEngine = buildStoryEngineTrace(
    entries,
    seed,
    topicSelection.selectedTopic,
    topicSelection.primaryStoryTopicId,
    payload
  );

  const quality = evaluateQuality(entries, payload, topicSelection, signals);

  return {
    generatedAt: new Date().toISOString(),
    seed,
    conversationId: options.conversationId,
    rawConversation,
    signals,
    candidateTopics,
    topicSelection,
    storyEngine,
    payload,
    openAiPrompt,
    quality,
  };
}

/** Per-turn cluster hits — useful for lab message-level inspection. */
export function debugMatchTurnClusters(hints: string[]) {
  const tokens = canonicalizeCoverageTokens(hints);
  return matchTurnToClusters(tokens);
}
