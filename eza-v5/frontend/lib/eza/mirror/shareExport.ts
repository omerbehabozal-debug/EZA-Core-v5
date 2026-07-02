/**
 * EZA Mirror — client-side Daily Mirror card export (PNG).
 */

import { MIRROR_SHARE_EXPORT_TEXT, MIRROR_SHARE_EXPORT_TEXT_LONG } from '@/lib/eza/mirror/copy';
import {
  buildDailyMirrorExportFilename,
  buildDailyMirrorShareText,
} from '@/lib/eza/mirror/dailyMirrorShareText';
import { resolveMirrorShareCaption } from '@/lib/eza/mirror-share/resolveMirrorShareCaption';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

export type MirrorExportFormat = 'png';

export const MIRROR_EXPORT_TARGET_WIDTH = 1080;

export const MIRROR_EXPORT_TARGET_HEIGHT = 1920;

export const MIRROR_EXPORT_DEFAULT_PIXEL_RATIO = 2;

/** Prefer share-only poster DOM; fall back to in-app card root. */
export function resolveMirrorExportCaptureNode(
  container: HTMLElement | null | undefined
): HTMLElement | null {
  if (!container) return null;
  const shareRoot = container.querySelector<HTMLElement>('[data-mirror-share-root]');
  if (shareRoot) return shareRoot;
  const cardRoot = container.querySelector<HTMLElement>('[data-mirror-card-root]');
  return cardRoot ?? container;
}

export type MirrorShareResult = 'shared' | 'downloaded' | 'copied' | 'unsupported' | 'failed';

export interface MirrorExportOptions {
  format?: MirrorExportFormat;
  width?: number;
  height?: number;
  pixelRatio?: number;
}

function resolveExportHeight(node: HTMLElement, targetWidth: number): number {
  const w = node.offsetWidth || 1;
  const h = node.offsetHeight || 1;
  return Math.max(1, Math.round((targetWidth * h) / w));
}

/**
 * Capture a DOM node (Daily Mirror card wrapper) as PNG blob.
 */
export async function exportMirrorCardToPng(
  node: HTMLElement,
  options?: MirrorExportOptions
): Promise<Blob> {
  const format = options?.format ?? 'png';
  if (format !== 'png') {
    throw new Error('unsupported_format');
  }

  const { toBlob } = await import('html-to-image');
  const width = options?.width ?? MIRROR_EXPORT_TARGET_WIDTH;
  const height =
    options?.height ??
    (node.dataset.mirrorAspect === '9-16'
      ? MIRROR_EXPORT_TARGET_HEIGHT
      : resolveExportHeight(node, width));
  const pixelRatio = options?.pixelRatio ?? MIRROR_EXPORT_DEFAULT_PIXEL_RATIO;

  const blob = await toBlob(node, {
    cacheBust: true,
    pixelRatio,
    width,
    height,
    fetchRequestInit: { mode: 'cors', credentials: 'omit' },
    style: {
      margin: '0',
      padding: '0',
    },
    skipFonts: false,
  });

  if (!blob) {
    throw new Error('export_failed');
  }
  return blob;
}

/** @deprecated Prefer buildDailyMirrorExportFilename(card) — kept for date-only callers. */
export function buildMirrorExportFilename(dateIso?: string): string {
  return buildDailyMirrorExportFilename(null, dateIso);
}

export function resolveMirrorShareText(card?: DailyMirrorCardModel | null): string {
  if (card?.mirrorShare || card?.mirrorV3Payload) {
    return resolveMirrorShareCaption(card);
  }
  if (card) {
    return buildDailyMirrorShareText(card);
  }
  return MIRROR_SHARE_EXPORT_TEXT;
}

export function resolveMirrorExportFilename(
  card?: DailyMirrorCardModel | null,
  dateIso?: string
): string {
  return buildDailyMirrorExportFilename(card, dateIso);
}

export function downloadMirrorCardPng(blob: Blob, filename?: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? buildMirrorExportFilename();
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    const file = new File([''], 'probe.png', { type: 'image/png' });
    return navigator.canShare?.({ files: [file] }) ?? false;
  } catch {
    return false;
  }
}

export async function shareMirrorCardPng(
  blob: Blob,
  options?: { title?: string; text?: string; filename?: string }
): Promise<MirrorShareResult> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return 'unsupported';
  }

  const title = options?.title ?? 'EZA Ayna';
  const text = options?.text ?? MIRROR_SHARE_EXPORT_TEXT;
  const filename = options?.filename ?? buildMirrorExportFilename();
  const file = new File([blob], filename, { type: 'image/png' });

  try {
    if (canShareFiles()) {
      await navigator.share({ title, text, files: [file] });
      return 'shared';
    }
    await navigator.share({ title, text });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'failed';
    }
    return 'failed';
  }
}

export async function copyMirrorShareText(
  text: string = MIRROR_SHARE_EXPORT_TEXT
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function getMirrorShareTexts(card?: DailyMirrorCardModel | null) {
  const short = resolveMirrorShareText(card);
  return {
    short,
    long: card
      ? `${short}\n\nMesaj içeriği paylaşılmaz.`
      : MIRROR_SHARE_EXPORT_TEXT_LONG,
  };
}

export const MIRROR_EXPORT_ERROR_MESSAGE =
  'Kart görseli şu an hazırlanamadı. Biraz sonra tekrar dene veya sayfayı yenile.';
