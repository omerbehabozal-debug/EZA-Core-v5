/** Canonical identity avatar outer geometry (px). Real photo and grapheme fallback match. */
export const PROFILE_AVATAR_SIZE_PX = {
  header: 44,
  panel: 72,
  heroDesktop: 84,
  heroMobile: 66,
  authorRow: 28,
  md: 56,
} as const;

/**
 * Desktop role scale. CSS custom properties on `.saina-page` are the runtime
 * authority (`--bilign-avatar-*`). Same crop and halo family; size follows role.
 * header/panel/heroMobile stay on PROFILE_AVATAR_SIZE_PX (chrome, profile, ≤899).
 */
export const BILIGN_AVATAR_ROLE_PX = {
  primary: 88,
  publisher: 56,
  navigation: 40,
  participant: 32,
  participantCompact: 28,
} as const;

export type ProfileAvatarSizeToken = keyof typeof PROFILE_AVATAR_SIZE_PX;
