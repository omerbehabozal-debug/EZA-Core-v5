/**
 * EZA Mirror — client-side Daily Mirror card export (PNG).
 */

import {
  MIRROR_SHARE_EXPORT_TEXT,
  MIRROR_SHARE_EXPORT_TEXT_LONG,
} from '@/lib/eza/mirror/copy';

export type MirrorExportFormat = 'png';

export const MIRROR_EXPORT_TARGET_WIDTH = 1080;

export const MIRROR_EXPORT_TARGET_HEIGHT = 1920;

export const MIRROR_EXPORT_DEFAULT_PIXEL_RATIO = 2;

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

export function buildMirrorExportFilename(dateIso?: string): string {
  const day = dateIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return `eza-mirror-${day}.png`;
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

  const title = options?.title ?? 'EZA Mirror';
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

export function getMirrorShareTexts() {
  return {
    short: MIRROR_SHARE_EXPORT_TEXT,
    long: MIRROR_SHARE_EXPORT_TEXT_LONG,
  };
}

export const MIRROR_EXPORT_ERROR_MESSAGE =
  'Kart görseli şu an hazırlanamadı. Biraz sonra tekrar dene veya sayfayı yenile.';
