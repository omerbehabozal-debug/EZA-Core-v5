/**
 * Mirror V3.1 — build cinematic poster payload with narrative distance copy.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildMirrorPayload,
  type BuildMirrorPayloadOptions,
} from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { polishMirrorPayloadCopy } from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import { resolveActiveConversationTopics } from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import { resolveMeaningMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV3/meaningMirrorCopy';
import {
  polishNarrativeMirrorText,
  sanitizeNarrativeMirrorCopy,
  extractTopicTokens,
} from '@/lib/eza/mirror/conversationMirrorV3/narrativeCopySanitizer';
import { resolveNarrativeDistance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { resolveNarrativeLayer } from '@/lib/eza/mirror/conversationMirrorV3/narrativeLayer';
import { resolveConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
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
  const narrativeDistance = resolveNarrativeDistance(seed);
  const narrative = resolveNarrativeLayer({
    storyTopicId: topicResolution.primaryTopic,
    emotionalTone: base.emotionalTone,
    visualKeywords: base.visualKeywords,
    sceneMetaphor: base.sceneMetaphor,
    narrativeDistance: narrativeDistance.level,
  });

  const meaningCopy = resolveMeaningMirrorCopy({
    storyTopicId: topicResolution.primaryTopic,
    selectedTopic: topicResolution.selectedTopic,
    seed,
    narrativeDistance: narrativeDistance.level,
  });

  const topicTokens = extractTopicTokens(
    topicResolution.selectedTopic,
    base.topic,
    base.selectedTopic
  );
  const mirrorText = polishNarrativeMirrorText(
    sanitizeNarrativeMirrorCopy(meaningCopy, topicTokens) || meaningCopy
  );

  const polishedVisual = polishMirrorPayloadCopy({
    mirrorTitle: base.mirrorTitle,
    mirrorText,
    closingLine: base.closingLine,
    sceneMetaphor: base.sceneMetaphor,
    visualKeywords: base.visualKeywords,
  });

  const conversationEvidence = resolveConversationEvidence({
    entries,
    storyTopicId: topicResolution.primaryTopic,
    selectedTopic: topicResolution.selectedTopic,
    candidateTopics: topicResolution.candidateTopics,
  });

  return {
    ...base,
    pipelineVersion: MIRROR_PIPELINE_VERSION,
    refinementVersion: MIRROR_REFINEMENT_VERSION,
    conversationEvidence,
    narrativeTheme: narrative.narrativeTheme,
    meaning: narrative.meaning,
    emotion: narrative.emotion,
    narrativeDistance: narrativeDistance.level,
    narrativeDistanceLabel: narrativeDistance.label,
    emotionalAtmosphere: narrative.emotionalAtmosphere,
    mirrorTitle: polishedVisual.mirrorTitle,
    mirrorText: polishedVisual.mirrorText,
    closingLine: polishedVisual.closingLine,
    sceneMetaphor: polishedVisual.sceneMetaphor,
    visualKeywords: polishedVisual.visualKeywords,
  };
}
