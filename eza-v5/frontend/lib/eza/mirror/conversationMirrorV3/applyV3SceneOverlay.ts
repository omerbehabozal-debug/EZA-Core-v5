/**
 * Mirror V3 — apply brand overlay after scene generation (browser only).
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  MIRROR_V3_BRAND_SIGNATURE,
} from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  applyPosterBrandOverlay,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/posterOverlay';
import {
  loadSainaLogoImage,
} from '@/lib/eza/mirror/conversationMirrorV2/applyV2SceneOverlay';

export function isV3MirrorCard(
  card: Pick<DailyMirrorCardModel, 'mirrorPipelineVersion' | 'mirrorV3Payload'> | null | undefined
): card is DailyMirrorCardModel & { mirrorV3Payload: SainaMirrorV3Payload } {
  return card?.mirrorPipelineVersion === 'v3' && card.mirrorV3Payload != null;
}

export async function applyV3PosterBrandOverlayUrl(
  rawSceneImageUrl: string,
  payload: SainaMirrorV3Payload
): Promise<string> {
  const logoImage = await loadSainaLogoImage();
  const blob = await applyPosterBrandOverlay(rawSceneImageUrl, payload, {
    logoImage,
    logoText: 'SAINA',
    brandSignature: MIRROR_V3_BRAND_SIGNATURE,
  });
  return URL.createObjectURL(blob);
}

export type ResolveV3SceneDisplayUrlOptions = {
  previousDisplayUrl?: string | null;
};

export async function resolveV3SceneDisplayUrl(
  rawSceneImageUrl: string,
  card: DailyMirrorCardModel | null,
  options?: ResolveV3SceneDisplayUrlOptions
): Promise<string> {
  if (!isV3MirrorCard(card)) return rawSceneImageUrl;

  if (options?.previousDisplayUrl) {
    revokePosterObjectUrl(options.previousDisplayUrl);
  }

  try {
    return await applyV3PosterBrandOverlayUrl(rawSceneImageUrl, card.mirrorV3Payload);
  } catch {
    return rawSceneImageUrl;
  }
}

export { revokePosterObjectUrl };
