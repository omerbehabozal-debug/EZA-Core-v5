/**
 * Mirror V2 — apply brand overlay after scene generation (browser only).
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  applyPosterBrandOverlay,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/posterOverlay';

const SAINA_LOGO_SRC = '/saina/saina-mark-original-sadik.svg';

let cachedLogoImage: HTMLImageElement | null = null;

export async function loadSainaLogoImage(): Promise<HTMLImageElement> {
  if (cachedLogoImage) return cachedLogoImage;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SAINA logo asset failed to load'));
    img.src = SAINA_LOGO_SRC;
  });
  cachedLogoImage = img;
  return img;
}

export function isV2MirrorCard(
  card: Pick<DailyMirrorCardModel, 'mirrorPipelineVersion' | 'mirrorV2Payload'> | null | undefined
): card is DailyMirrorCardModel & { mirrorV2Payload: SainaMirrorPayload } {
  return card?.mirrorPipelineVersion === 'v2' && card.mirrorV2Payload != null;
}

/**
 * Apply logo + date overlay for V2 posters. Returns a blob object URL.
 * V1 cards should never call this helper.
 */
export async function applyV2PosterBrandOverlayUrl(
  rawSceneImageUrl: string,
  payload: SainaMirrorPayload
): Promise<string> {
  const logoImage = await loadSainaLogoImage();
  const blob = await applyPosterBrandOverlay(rawSceneImageUrl, payload, {
    logoImage,
    logoText: 'SAINA',
  });
  return URL.createObjectURL(blob);
}

export type ResolveV2SceneDisplayUrlOptions = {
  /** Revoke prior blob URL before assigning a new one. */
  previousDisplayUrl?: string | null;
};

/**
 * Returns raw scene URL for display (PR D0 — no canvas text burn-in).
 * Use applyV2PosterBrandOverlayUrl explicitly for share/QA composition.
 */
export async function resolveV2SceneDisplayUrl(
  rawSceneImageUrl: string,
  _card: DailyMirrorCardModel | null,
  options?: ResolveV2SceneDisplayUrlOptions
): Promise<string> {
  if (options?.previousDisplayUrl) {
    revokePosterObjectUrl(options.previousDisplayUrl);
  }
  return rawSceneImageUrl;
}

export { revokePosterObjectUrl };
