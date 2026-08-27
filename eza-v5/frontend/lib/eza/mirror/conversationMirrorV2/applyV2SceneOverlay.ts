/**
 * Mirror V2 — apply brand overlay after scene generation (browser only).
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  applyPosterBrandOverlay,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/posterOverlay';

const SAINA_LOGO_SRC = '/bilign/bilign-mark.svg';
const SAINA_WORDMARK_SRC = '/bilign/bilign-wordmark.svg';

let cachedLogoImage: HTMLImageElement | null = null;
let cachedWordmarkImage: HTMLImageElement | null = null;

async function loadBrandImage(
  src: string,
  cache: HTMLImageElement | null,
  setCache: (img: HTMLImageElement) => void
): Promise<HTMLImageElement> {
  if (cache) return cache;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('biligN logo asset failed to load'));
    img.src = src;
  });
  setCache(img);
  return img;
}

export async function loadSainaLogoImage(): Promise<HTMLImageElement> {
  return loadBrandImage(SAINA_LOGO_SRC, cachedLogoImage, (img) => {
    cachedLogoImage = img;
  });
}

export async function loadSainaWordmarkImage(): Promise<HTMLImageElement> {
  return loadBrandImage(SAINA_WORDMARK_SRC, cachedWordmarkImage, (img) => {
    cachedWordmarkImage = img;
  });
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
  const [logoImage, logoWordmarkImage] = await Promise.all([
    loadSainaLogoImage(),
    loadSainaWordmarkImage(),
  ]);
  const blob = await applyPosterBrandOverlay(rawSceneImageUrl, payload, {
    logoImage,
    logoWordmarkImage,
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
