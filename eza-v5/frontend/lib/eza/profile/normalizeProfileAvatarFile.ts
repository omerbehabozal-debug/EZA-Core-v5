/** Square center-crop for profile avatars — matches backend normalize_profile_avatar_bytes. */

export const PROFILE_AVATAR_OUTPUT_SIZE = 512;
export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_AVATAR_JPEG_QUALITY = 0.88;

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isAcceptedProfileAvatarFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  return ACCEPTED_TYPES.has(type);
}

export async function normalizeProfileAvatarFile(file: File): Promise<File> {
  if (!isAcceptedProfileAvatarFile(file)) {
    throw new Error('unsupported_avatar_format');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = PROFILE_AVATAR_OUTPUT_SIZE;
    canvas.height = PROFILE_AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, PROFILE_AVATAR_OUTPUT_SIZE, PROFILE_AVATAR_OUTPUT_SIZE);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', PROFILE_AVATAR_JPEG_QUALITY);
    });
    if (!blob) throw new Error('encode_failed');
    if (blob.size > PROFILE_AVATAR_MAX_BYTES) {
      throw new Error('avatar_too_large');
    }

    const stem = file.name.replace(/\.[^.]+$/, '').trim() || 'avatar';
    return new File([blob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
