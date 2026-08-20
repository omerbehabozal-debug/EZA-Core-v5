export function buildSainaAuthReturnUrl(parts: {
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}): string {
  const pathname = parts.pathname?.trim() || '/standalone/discover';
  let search = parts.search ?? '';
  if (search && !search.startsWith('?')) {
    search = `?${search}`;
  }
  let hash = parts.hash ?? '';
  if (hash && !hash.startsWith('#')) {
    hash = `#${hash}`;
  }
  return `${pathname}${search}${hash}`;
}

export function buildSainaAuthHref(returnUrl: string, page: 'login' | 'register'): string {
  const safe = returnUrl.trim() || '/standalone/discover';
  return `/platform/${page}?return=${encodeURIComponent(safe)}`;
}

/** Validates post-auth redirect target (same-origin relative path only). */
export function resolveSafeAuthReturnPath(returnPath: string | null | undefined): string {
  const fallback = '/standalone/discover';
  if (!returnPath?.startsWith('/')) return fallback;
  if (returnPath.startsWith('//')) return fallback;
  if (returnPath.includes('\\')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(returnPath.slice(1))) return fallback;
  if (returnPath.includes('://')) return fallback;
  // Phase 8.7 — product allowlist (reject unknown relative paths).
  const pathOnly = (returnPath.split(/[?#]/)[0] || '').trim();
  const allowed =
    pathOnly === '/' ||
    pathOnly.startsWith('/standalone') ||
    pathOnly.startsWith('/m/') ||
    pathOnly.startsWith('/platform') ||
    pathOnly.startsWith('/dev/');
  if (!allowed) return fallback;
  return returnPath;
}

export function resolveSainaUserDisplayName(
  email?: string | null,
  fullName?: string | null,
  publicDisplayName?: string | null
): string {
  const chosen = (publicDisplayName || fullName || '').trim();
  if (chosen) return chosen;
  // Phase 8.5 — never transform email local-part into a display name.
  // Owner chrome may still show email separately; account label stays neutral.
  if (email?.trim()) return 'Hesabım';
  return 'Misafir';
}

export function resolveSainaUserInitial(
  email?: string | null,
  publicDisplayName?: string | null,
  fullName?: string | null
): string {
  const chosen = (publicDisplayName || fullName || '').trim();
  if (chosen) return chosen.charAt(0).toUpperCase();
  if (email?.trim()) return '·';
  return '·';
}

import { resolveSainaAccountLabel } from '@/lib/eza/plan/sainaAccountTiers';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

export function resolveSainaPlanLabel(planTier: SainaPlanTier | string): string | null {
  return resolveSainaAccountLabel(planTier as SainaPlanTier);
}

export function isSainaAuthReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return returnPath.startsWith('/standalone') || returnPath.startsWith('/m/');
}
