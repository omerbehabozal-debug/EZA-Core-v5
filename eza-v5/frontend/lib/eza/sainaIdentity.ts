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
  return returnPath;
}

export function resolveSainaUserDisplayName(
  email?: string | null,
  fullName?: string | null
): string {
  if (fullName?.trim()) return fullName.trim();
  if (!email?.trim()) return 'Misafir';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'Misafir';

  if (local.includes('.') || local.includes('_') || local.includes('-')) {
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

export function resolveSainaUserInitial(email?: string | null): string {
  if (!email?.trim()) return '·';
  const local = email.split('@')[0]?.trim();
  if (!local) return '·';
  return local.charAt(0).toUpperCase();
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
