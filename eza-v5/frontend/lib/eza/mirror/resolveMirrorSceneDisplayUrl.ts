/**
 * Unified mirror scene display URL — V3 brand overlay, then V2, else raw.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  resolveV2SceneDisplayUrl,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/applyV2SceneOverlay';
import { resolveV3SceneDisplayUrl } from '@/lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay';

export type ResolveMirrorSceneDisplayUrlOptions = {
  previousDisplayUrl?: string | null;
};

export async function resolveMirrorSceneDisplayUrl(
  rawSceneImageUrl: string,
  card: DailyMirrorCardModel | null,
  options?: ResolveMirrorSceneDisplayUrlOptions
): Promise<string> {
  if (card?.mirrorPipelineVersion === 'v3') {
    return resolveV3SceneDisplayUrl(rawSceneImageUrl, card, options);
  }
  return resolveV2SceneDisplayUrl(rawSceneImageUrl, card, options);
}

export { revokePosterObjectUrl };
