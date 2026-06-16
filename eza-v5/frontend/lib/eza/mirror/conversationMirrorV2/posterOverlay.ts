/**
 * Mirror V2 — post-render brand overlay (logo + date).
 * Logo asset is composited by the system; OpenAI must not generate it.
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { MIRROR_V2_ASPECT } from '@/lib/eza/mirror/conversationMirrorV2/types';

export const MIRROR_V2_CARD_WIDTH = MIRROR_V2_ASPECT.width;
export const MIRROR_V2_CARD_HEIGHT = MIRROR_V2_ASPECT.height;

export const MIRROR_V2_SAFE_MARGIN_X = 64;
export const MIRROR_V2_SAFE_MARGIN_Y = 56;

export const MIRROR_V2_LOGO_COLOR = '#e7b45b';
export const MIRROR_V2_DATE_COLOR = 'rgba(245,245,240,0.78)';

export type MirrorPosterOverlaySpec = {
  logo: { x: number; y: number; color: string };
  date: { x: number; y: number; align: CanvasTextAlign; color: string; text: string };
};

export function buildPosterOverlaySpec(payload: SainaMirrorPayload): MirrorPosterOverlaySpec {
  return {
    logo: {
      x: MIRROR_V2_SAFE_MARGIN_X,
      y: MIRROR_V2_SAFE_MARGIN_Y,
      color: MIRROR_V2_LOGO_COLOR,
    },
    date: {
      x: MIRROR_V2_CARD_WIDTH - MIRROR_V2_SAFE_MARGIN_X,
      y: MIRROR_V2_SAFE_MARGIN_Y + 6,
      align: 'right',
      color: MIRROR_V2_DATE_COLOR,
      text: payload.date,
    },
  };
}

export type PosterBrandSignature = {
  line1: string;
  line2: string;
};

export type ApplyPosterOverlayOptions = {
  /** Optional logo image (SAINA mark). When omitted, text fallback is used. */
  logoImage?: CanvasImageSource | null;
  logoText?: string;
  fontFamily?: string;
  /** V3 — bottom-center brand signature (system-rendered, not OpenAI). */
  brandSignature?: PosterBrandSignature | null;
};

/**
 * Composite logo + date onto a generated poster image (browser canvas).
 * Returns a PNG blob for export/share.
 */
export async function applyPosterBrandOverlay(
  sourceImageUrl: string,
  payload: SainaMirrorPayload,
  options?: ApplyPosterOverlayOptions
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('applyPosterBrandOverlay requires a browser environment');
  }

  const spec = buildPosterOverlaySpec(payload);
  const img = await loadImageForOverlay(sourceImageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = MIRROR_V2_CARD_WIDTH;
  canvas.height = MIRROR_V2_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const fontFamily = options?.fontFamily ?? 'Georgia, serif';

  if (options?.logoImage) {
    const logoSize = 48;
    ctx.drawImage(options.logoImage, spec.logo.x, spec.logo.y, logoSize, logoSize);
    ctx.font = `600 22px ${fontFamily}`;
    ctx.fillStyle = spec.logo.color;
    ctx.textBaseline = 'top';
    ctx.fillText(options?.logoText ?? 'SAINA', spec.logo.x + logoSize + 10, spec.logo.y + 10);
  } else {
    ctx.font = `600 26px ${fontFamily}`;
    ctx.fillStyle = spec.logo.color;
    ctx.textBaseline = 'top';
    ctx.fillText(options?.logoText ?? 'SAINA', spec.logo.x, spec.logo.y);
  }

  ctx.font = `500 18px ${fontFamily}`;
  ctx.fillStyle = spec.date.color;
  ctx.textAlign = spec.date.align;
  ctx.textBaseline = 'top';
  ctx.fillText(spec.date.text, spec.date.x, spec.date.y);

  if (options?.brandSignature) {
    const sig = options.brandSignature;
    const centerX = canvas.width / 2;
    const bottomY = canvas.height - MIRROR_V2_SAFE_MARGIN_Y;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `600 14px ${fontFamily}`;
    ctx.fillStyle = 'rgba(231, 180, 91, 0.92)';
    ctx.fillText(sig.line1, centerX, bottomY - 18);

    ctx.font = `400 11px ${fontFamily}`;
    ctx.fillStyle = 'rgba(245, 245, 240, 0.62)';
    ctx.fillText(sig.line2, centerX, bottomY);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Poster export failed'))),
      'image/png',
      0.92
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load poster image'));
    img.src = url;
  });
}

async function loadImageForOverlay(url: string): Promise<HTMLImageElement> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return loadImage(url);
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return loadImage(url);
  }
}

/** Revoke blob URLs created by applyV2PosterBrandOverlayUrl. */
export function revokePosterObjectUrl(url: string | null | undefined): void {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
