/** Canonical identity avatar outer geometry (px). Real photo and grapheme fallback match. */
export const PROFILE_AVATAR_SIZE_PX = {
  header: 44,
  panel: 72,
  heroDesktop: 84,
  heroMobile: 66,
  authorRow: 28,
  md: 56,
} as const;

export type ProfileAvatarSizeToken = keyof typeof PROFILE_AVATAR_SIZE_PX;
