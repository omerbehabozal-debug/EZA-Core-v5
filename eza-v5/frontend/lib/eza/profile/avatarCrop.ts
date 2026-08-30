/**
 * Client-side avatar crop — square normalized output, circular mask is UI-only.
 */

import {
  PROFILE_AVATAR_JPEG_QUALITY,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_OUTPUT_SIZE,
  isAcceptedProfileAvatarFile,
} from '@/lib/eza/profile/normalizeProfileAvatarFile';

export const AVATAR_CROP_VIEWPORT_PX = 280;
export const AVATAR_CROP_ZOOM_MIN = 1;
export const AVATAR_CROP_ZOOM_MAX = 3;

export type AvatarCropState = {
  /** Multiplier on minimum cover scale (1 = tightest cover). */
  zoom: number;
  /** Pan offset from centered crop in viewport pixels. */
  offsetX: number;
  offsetY: number;
};

export type OrientedAvatarImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

export function defaultAvatarCropState(): AvatarCropState {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

export function computeAvatarCoverScale(
  imageWidth: number,
  imageHeight: number,
  cropViewportPx: number
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  return Math.max(cropViewportPx / imageWidth, cropViewportPx / imageHeight);
}

export function computeAvatarCropSourceRect(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCropState,
  cropViewportPx: number = AVATAR_CROP_VIEWPORT_PX
): { sx: number; sy: number; size: number } {
  const cover = computeAvatarCoverScale(imageWidth, imageHeight, cropViewportPx);
  const scale = cover * Math.max(AVATAR_CROP_ZOOM_MIN, crop.zoom);
  const size = cropViewportPx / scale;
  const cx = imageWidth / 2 - crop.offsetX / scale;
  const cy = imageHeight / 2 - crop.offsetY / scale;
  return {
    sx: cx - size / 2,
    sy: cy - size / 2,
    size,
  };
}

/** Clamp pan so the crop square always stays inside the image. */
export function clampAvatarCropPan(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCropState,
  cropViewportPx: number = AVATAR_CROP_VIEWPORT_PX
): AvatarCropState {
  const zoom = Math.min(AVATAR_CROP_ZOOM_MAX, Math.max(AVATAR_CROP_ZOOM_MIN, crop.zoom));
  const cover = computeAvatarCoverScale(imageWidth, imageHeight, cropViewportPx);
  const scale = cover * zoom;
  const size = cropViewportPx / scale;
  const maxPanX = Math.max(0, (imageWidth - size) / 2) * scale;
  const maxPanY = Math.max(0, (imageHeight - size) / 2) * scale;
  return {
    zoom,
    offsetX: Math.max(-maxPanX, Math.min(maxPanX, crop.offsetX)),
    offsetY: Math.max(-maxPanY, Math.min(maxPanY, crop.offsetY)),
  };
}

export function releaseOrientedAvatarImage(image: OrientedAvatarImage | null | undefined): void {
  if (!image?.bitmap) return;
  if (typeof image.bitmap.close === 'function') {
    image.bitmap.close();
  }
}

export async function loadOrientedAvatarImage(file: File): Promise<OrientedAvatarImage> {
  if (!isAcceptedProfileAvatarFile(file)) {
    throw new Error('unsupported_avatar_format');
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    const bitmap = await createImageBitmap(file);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }
}

export async function createOrientedAvatarPreviewUrl(
  image: OrientedAvatarImage
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(image.bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', PROFILE_AVATAR_JPEG_QUALITY);
  });
  if (!blob) throw new Error('preview_failed');
  return URL.createObjectURL(blob);
}

export async function renderAvatarCropToCanvas(
  image: OrientedAvatarImage,
  crop: AvatarCropState,
  outputSize: number = PROFILE_AVATAR_OUTPUT_SIZE,
  cropViewportPx: number = AVATAR_CROP_VIEWPORT_PX
): Promise<HTMLCanvasElement> {
  const clamped = clampAvatarCropPan(image.width, image.height, crop, cropViewportPx);
  const { sx, sy, size } = computeAvatarCropSourceRect(
    image.width,
    image.height,
    clamped,
    cropViewportPx
  );

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.bitmap, sx, sy, size, size, 0, 0, outputSize, outputSize);
  return canvas;
}

export async function renderAvatarCropToFile(
  image: OrientedAvatarImage,
  crop: AvatarCropState,
  originalName: string,
  cropViewportPx: number = AVATAR_CROP_VIEWPORT_PX
): Promise<File> {
  const canvas = await renderAvatarCropToCanvas(image, crop, PROFILE_AVATAR_OUTPUT_SIZE, cropViewportPx);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', PROFILE_AVATAR_JPEG_QUALITY);
  });
  if (!blob) throw new Error('encode_failed');
  if (blob.size > PROFILE_AVATAR_MAX_BYTES) throw new Error('avatar_too_large');
  const stem = originalName.replace(/\.[^.]+$/, '').trim() || 'avatar';
  return new File([blob], `${stem}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export function getAvatarCropImageStyle(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCropState,
  cropViewportPx: number = AVATAR_CROP_VIEWPORT_PX
): { width: number; height: number; transform: string } {
  const cover = computeAvatarCoverScale(imageWidth, imageHeight, cropViewportPx);
  const scale = cover * Math.max(AVATAR_CROP_ZOOM_MIN, crop.zoom);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const left = cropViewportPx / 2 - width / 2 + crop.offsetX;
  const top = cropViewportPx / 2 - height / 2 + crop.offsetY;
  return {
    width,
    height,
    transform: `translate(${left}px, ${top}px)`,
  };
}
