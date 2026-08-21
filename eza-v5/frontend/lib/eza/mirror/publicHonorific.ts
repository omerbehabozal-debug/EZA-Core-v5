/**
 * Public honorific — Meraklı / Bilgin.
 * Not a subscription tier, auth role, or Yansı publicTitle.
 */

export const PUBLIC_HONORIFIC_CURIOUS = 'curious';
export const PUBLIC_HONORIFIC_BILGIN = 'bilgin';

export type PublicHonorificId =
  | typeof PUBLIC_HONORIFIC_CURIOUS
  | typeof PUBLIC_HONORIFIC_BILGIN;

export const PUBLIC_HONORIFIC_LABELS: Record<PublicHonorificId, string> = {
  curious: 'Meraklı',
  bilgin: 'Bilgin',
};

export function resolvePublicHonorificId(
  raw: string | null | undefined
): PublicHonorificId {
  const value = (raw || '').trim().toLowerCase();
  if (value === PUBLIC_HONORIFIC_BILGIN) return PUBLIC_HONORIFIC_BILGIN;
  return PUBLIC_HONORIFIC_CURIOUS;
}

export function resolvePublicHonorificLabel(
  raw: string | null | undefined
): string {
  return PUBLIC_HONORIFIC_LABELS[resolvePublicHonorificId(raw)];
}
