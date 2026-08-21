/**
 * Desktop Yansı creator identity — public name only.
 * Never email, plan, role, or fabricated handle.
 */

import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import { SAINA_MENU_GUEST_LABEL } from '@/lib/eza/sainaCopy';
import {
  resolvePublicHonorificId,
  resolvePublicHonorificLabel,
  type PublicHonorificId,
} from '@/lib/eza/mirror/publicHonorific';

export function resolveYansiCreatorDisplayName(input: {
  isGuest: boolean;
  publicDisplayName?: string | null;
}): string {
  if (input.isGuest) return SAINA_MENU_GUEST_LABEL;
  const chosen = (input.publicDisplayName || '').trim();
  if (chosen) return chosen;
  return PUBLIC_DISPLAY_NAME_FALLBACK;
}

export function resolveYansiCreatorHonorific(input: {
  isGuest: boolean;
  publicHonorific?: string | null;
}): { id: PublicHonorificId; label: string } | null {
  if (input.isGuest) return null;
  const id = resolvePublicHonorificId(input.publicHonorific);
  return { id, label: resolvePublicHonorificLabel(id) };
}
