/**
 * V4.5 — evidence-first scene composition with fused evidence + world layer.
 */

import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import { resolveEvidenceFusion } from '@/lib/eza/mirror/conversationMirrorV3/evidenceFusionV44';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type SceneComposition = {
  heroScene: string;
  evidenceFusionScene: string;
  worldLayer: string;
  /** Internal trace only — never rendered in OpenAI prompt. */
  supportingClues: string[];
  sceneMetaphor: string;
};

export function resolveSceneComposition(input: {
  evidence: readonly ConversationEvidence[];
  storyTopicId: StoryTopicId;
  selectedTopic: string;
  fallbackSceneMetaphor: string;
}): SceneComposition {
  const primary =
    input.evidence.find((item) => item.role === 'primary') ?? input.evidence[0];

  const fusion = resolveEvidenceFusion({
    evidence: input.evidence,
    storyTopicId: input.storyTopicId,
    selectedTopic: input.selectedTopic,
  });

  const supportingClues = input.evidence
    .filter((item) => item.role !== 'primary')
    .slice(0, 6)
    .map((item) => `${item.label} → ${item.visualHint}`);

  const sceneMetaphor = primary ? primary.visualHint : input.fallbackSceneMetaphor;

  return {
    heroScene: fusion.heroScene,
    evidenceFusionScene: fusion.evidenceFusionScene,
    worldLayer: fusion.worldLayer,
    supportingClues,
    sceneMetaphor,
  };
}

/** @deprecated — use formatEvidenceFusionBlock from evidenceFusionV44 in prompts. */
export function formatSceneCompositionBlock(composition: SceneComposition): string {
  return [
    'Evidence fusion scene (70% — single frame, single environment):',
    composition.evidenceFusionScene,
    '',
    `Hero anchor: ${composition.heroScene}`,
    '',
    'World Layer:',
    composition.worldLayer,
  ].join('\n');
}
