/**
 * Regenerate one scene for Narrative Alignment retry.
 * Keeps the same mapped prompt / meaning; only varies seed.
 */

import { generateMirrorScene } from '@/lib/eza/mirror/generateSceneApi';
import { withSceneVariationSeed } from '@/lib/eza/mirror/styleLensPrompt';
import { scenePromptHash } from '@/lib/eza/mirror/d2SceneGenerationGuard';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { RegenerateSceneFn } from '@/lib/eza/mirror/narrativeAlignment/publishGate';

function sceneAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/mirror-scene-assets\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

export type CreateAlignmentSceneRegeneratorInput = {
  card: DailyMirrorCardModel;
  conversationId?: string | null;
  generationId?: string | null;
  /** Base variation index; regenerator uses base+1. */
  variationIndex?: number;
  /** Optional hook after a successful regenerate (update UI cache). */
  onSceneReady?: (sceneImageUrl: string) => void | Promise<void>;
};

/**
 * Same interpretation / anchors / landing — new sceneAssetId only.
 */
export function createAlignmentSceneRegenerator(
  input: CreateAlignmentSceneRegeneratorInput
): RegenerateSceneFn {
  return async () => {
    const visual = input.card.visual;
    if (!visual?.prompt?.trim()) {
      throw new Error('alignment_regenerate_missing_prompt');
    }
    const variationIndex = (input.variationIndex ?? 0) + 1;
    const visualForApi = withSceneVariationSeed(visual, variationIndex);
    const finalScenePromptHash = await scenePromptHash(visualForApi.prompt || '');
    const result = await generateMirrorScene(visualForApi, input.card.date, {
      conversationId: input.conversationId ?? undefined,
      generationRequestId: input.generationId
        ? `${input.generationId}:align-retry`
        : undefined,
      generationPipeline: input.conversationId ? 'D2_V5' : 'LEGACY_V3',
      finalScenePromptHash,
    });
    await input.onSceneReady?.(result.sceneImageUrl);
    return {
      sceneImageUrl: result.sceneImageUrl,
      sceneAssetId: sceneAssetIdFromUrl(result.sceneImageUrl),
    };
  };
}
