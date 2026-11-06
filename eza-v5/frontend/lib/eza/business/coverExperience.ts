import { computeAvatarCropSourceRect, type AvatarCropState } from '@/lib/eza/profile/avatarCrop';

export const COVER_MAX_SECONDS = 20;
export const COVER_CROP_PX = 1024;

export function coverInterval(
  durationSeconds: number,
  startSeconds: number,
  endSeconds: number,
): { start: number; end: number } | { error: string } {
  if (!(durationSeconds > 0) || !(endSeconds > startSeconds) || startSeconds < 0) {
    return { error: 'Kesit videonun içinde kalmalı.' };
  }
  if (endSeconds - startSeconds > COVER_MAX_SECONDS + 0.001) {
    return { error: 'Kapak en fazla 20 saniye olabilir.' };
  }
  if (endSeconds > durationSeconds + 0.05) {
    return { error: 'Kesit videonun içinde kalmalı.' };
  }
  return { start: startSeconds, end: endSeconds };
}

export function squareCoverRect(width: number, height: number, zoom = 1) {
  const crop: AvatarCropState = { zoom, offsetX: 0, offsetY: 0 };
  const rect = computeAvatarCropSourceRect(width, height, crop, COVER_CROP_PX);
  return rect.size > 0 ? rect : null;
}

export function coverOutputKey(file: { name: string; size: number; lastModified: number }, zoom: number) {
  return `${file.name}:${file.size}:${file.lastModified}:${zoom}`;
}

/** The bytes that will be uploaded. Callers preview this blob, not the source file. */
export async function renderSquareCover(file: Blob, zoom = 1): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const rect = squareCoverRect(bitmap.width, bitmap.height, zoom);
    if (!rect) throw new Error('Görsel kırpılamadı.');
    const canvas = document.createElement('canvas');
    canvas.width = COVER_CROP_PX;
    canvas.height = COVER_CROP_PX;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Görsel kırpılamadı.');
    context.drawImage(bitmap, rect.sx, rect.sy, rect.size, rect.size, 0, 0, COVER_CROP_PX, COVER_CROP_PX);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Görsel kırpılamadı.');
    return blob;
  } finally {
    bitmap.close();
  }
}
