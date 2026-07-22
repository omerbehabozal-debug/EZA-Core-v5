/**
 * Canonical Mirror master image size — mirrors backend `mirror_image_size.py`.
 * One generated asset; UI crops responsively (no per-device regenerate).
 */

/** gpt-image-1 API-supported sizes (do not invent pixel dimensions). */
export const MIRROR_OPENAI_ALLOWED_IMAGE_SIZES = [
  '1024x1024',
  '1024x1536',
  '1536x1024',
  'auto',
] as const;

export type MirrorOpenAIImageSize = (typeof MIRROR_OPENAI_ALLOWED_IMAGE_SIZES)[number];

/** Square master — best crop-safe compromise across phone/tablet/desktop/social/cover. */
export const MIRROR_CANONICAL_IMAGE_SIZE: MirrorOpenAIImageSize = '1024x1024';

export function isAllowedMirrorImageSize(size: string): size is MirrorOpenAIImageSize {
  return (MIRROR_OPENAI_ALLOWED_IMAGE_SIZES as readonly string[]).includes(size);
}
