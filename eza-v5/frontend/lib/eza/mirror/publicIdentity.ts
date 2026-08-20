/**
 * Phase 8.5 — public identity constants (privacy-safe).
 * Phase 8.5B — default avatar helpers (never email-derived).
 */

/** Neutral product-safe fallback — never email-derived. */
export const PUBLIC_DISPLAY_NAME_FALLBACK = 'biligN kullanıcısı';

export const PUBLIC_DISPLAY_NAME_MAX_LEN = 48;
export const PUBLIC_DISPLAY_NAME_MIN_LEN = 2;

/** First grapheme of a public display name for default avatar. Never from email. */
export function resolvePublicAvatarGrapheme(
  displayName: string | null | undefined
): string {
  const raw = (displayName || '').trim();
  if (!raw || raw === PUBLIC_DISPLAY_NAME_FALLBACK) return 'b';
  const chars = Array.from(raw);
  const first = chars[0] || 'b';
  return first.toLocaleUpperCase('tr-TR');
}

/** Soft deterministic tint from opaque public UUID (optional visual variety). */
export function avatarTintFromPublicUserId(userId: string | null | undefined): string {
  const id = (userId || '').replace(/-/g, '');
  let hash = 0;
  for (let i = 0; i < Math.min(id.length, 16); i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 18% 28%)`;
}
