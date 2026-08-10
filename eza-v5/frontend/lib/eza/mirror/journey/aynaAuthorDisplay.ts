/**
 * Phase 3.8 — resolve safe author display for Ayna panel stamping.
 * Never invent popularity; display name only.
 */

export function resolveAuthorDisplayName(input: {
  fullName?: string | null;
  email?: string | null;
  userId?: string | null;
}): string {
  const full = (input.fullName || '').trim();
  if (full) return full;
  const email = (input.email || '').trim();
  if (email.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  const uid = (input.userId || '').trim();
  if (uid) return `Yazar ${uid.slice(0, 6)}`;
  return 'Yazar';
}

export function formatParentLineageLabel(
  parentAuthorDisplayName: string | null | undefined
): string {
  const name = (parentAuthorDisplayName || '').trim();
  if (!name) return 'Bir Yansısından devam etti';
  return `${name}'in Yansısından devam etti`;
}
