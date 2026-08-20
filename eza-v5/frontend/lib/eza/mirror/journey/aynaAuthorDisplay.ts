/**
 * Phase 3.8 / 8.5 — resolve safe author display for Ayna panel stamping.
 * Never invent popularity; never derive from email local-part.
 */

import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';

export function resolveAuthorDisplayName(input: {
  fullName?: string | null;
  publicDisplayName?: string | null;
  email?: string | null;
  userId?: string | null;
}): string {
  const chosen = (input.publicDisplayName || input.fullName || '').trim();
  if (chosen) return chosen;
  // Phase 8.5 — email / local-part must never become a public display name.
  void input.email;
  return PUBLIC_DISPLAY_NAME_FALLBACK;
}

export function formatParentLineageLabel(
  parentAuthorDisplayName: string | null | undefined
): string {
  const name = (parentAuthorDisplayName || '').trim();
  if (!name) return 'Bir Yansısından devam etti';
  return `${name}'in Yansısından devam etti`;
}
