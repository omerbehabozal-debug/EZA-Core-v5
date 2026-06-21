/**
 * Mirror V4 — build cinematic poster payload.
 * Pipeline: Topic → Evidence → Scene → Meaning → Emotion.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildMirrorPayload,
  type BuildMirrorPayloadOptions,
} from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { polishMirrorPayloadCopy } from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import { resolveActiveConversationTopics } from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import { resolveEvidenceMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV3/evidenceAwareMirrorCopy';
import { resolveNarrativeDistance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { resolveNarrativeLayer } from '@/lib/eza/mirror/conversationMirrorV3/narrativeLayer';
import { resolveConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import { resolveSceneComposition } from '@/lib/eza/mirror/conversationMirrorV3/sceneCompositionV4';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  MIRROR_PIPELINE_VERSION,
  MIRROR_REFINEMENT_VERSION,
} from '@/lib/eza/mirror/conversationMirrorV3/types';

export type BuildMirrorPayloadV3Options = BuildMirrorPayloadOptions;

export function buildMirrorPayloadV3(
  entries: SavedBehavioralEntry[],
  options: BuildMirrorPayloadV3Options
): SainaMirrorV3Payload {
  const seed =
    options.seed ??
    `v3-${options.conversationId}-${entries.length}-${entries[0]?.interaction_id ?? 'empty'}`;
  const base = buildMirrorPayload(entries, { ...options, seed });
  const topicResolution = resolveActiveConversationTopics(entries, seed);

  const conversationEvidence = resolveConversationEvidence({
    entries,
    storyTopicId: topicResolution.primaryTopic,
    selectedTopic: topicResolution.selectedTopic,
    candidateTopics: topicResolution.candidateTopics,
  });

  const sceneComposition = resolveSceneComposition({
    evidence: conversationEvidence,
    storyTopicId: topicResolution.primaryTopic,
    selectedTopic: topicResolution.selectedTopic,
    fallbackSceneMetaphor: base.sceneMetaphor,
  });

  const narrativeDistance = resolveNarrativeDistance(seed);
  const narrative = resolveNarrativeLayer({
    storyTopicId: topicResolution.primaryTopic,
    emotionalTone: base.emotionalTone,
    visualKeywords: base.visualKeywords,
    sceneMetaphor: sceneComposition.sceneMetaphor,
    narrativeDistance: narrativeDistance.level,
  });

  const evidenceCopy = resolveEvidenceMirrorCopy({
    evidence: conversationEvidence,
    selectedTopic: topicResolution.selectedTopic,
    storyTopicId: topicResolution.primaryTopic,
    seed,
  });

  const polishedVisual = polishMirrorPayloadCopy({
    mirrorTitle: evidenceCopy.mirrorTitle,
    mirrorText: evidenceCopy.mirrorText,
    closingLine: undefined,
    sceneMetaphor: sceneComposition.sceneMetaphor,
    visualKeywords: base.visualKeywords,
  });

  return {
    ...base,
    pipelineVersion: MIRROR_PIPELINE_VERSION,
    refinementVersion: MIRROR_REFINEMENT_VERSION,
    storyTopicId: topicResolution.primaryTopic,
    conversationEvidence,
    sceneComposition,
    narrativeTheme: narrative.narrativeTheme,
    meaning: narrative.meaning,
    emotion: narrative.emotion,
    narrativeDistance: narrativeDistance.level,
    narrativeDistanceLabel: narrativeDistance.label,
    emotionalAtmosphere: narrative.emotionalAtmosphere,
    mirrorTitle: polishedVisual.mirrorTitle,
    mirrorText: polishedVisual.mirrorText,
    closingLine: undefined,
    sceneMetaphor: polishedVisual.sceneMetaphor,
    visualKeywords: polishedVisual.visualKeywords,
  };
}
