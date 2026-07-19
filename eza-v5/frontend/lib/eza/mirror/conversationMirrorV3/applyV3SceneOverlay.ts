/**
 * Mirror V3 — scene display URL resolution (PR D0 text-free).
 *
 * Brand/date/signature canvas overlays must not be burned into the raw Mirror
 * scene used for in-app display. Share/export may still call
 * applyV3PosterBrandOverlayUrl explicitly when composing a share artifact.
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

/** Optional share/export helper — not used for raw in-app scene display (PR D0). */
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

/**
 * PR D0: return the provider scene as-is (no canvas text/logo burn-in).
 */
export async function resolveV3SceneDisplayUrl(
  rawSceneImageUrl: string,
  _card: DailyMirrorCardModel | null,
  options?: ResolveV3SceneDisplayUrlOptions
): Promise<string> {
  if (options?.previousDisplayUrl) {
    revokePosterObjectUrl(options.previousDisplayUrl);
  }
  return rawSceneImageUrl;
}

export { revokePosterObjectUrl };
