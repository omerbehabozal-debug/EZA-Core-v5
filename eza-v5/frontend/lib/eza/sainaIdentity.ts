export function buildSainaAuthReturnUrl(parts: {
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}): string {
  const pathname = parts.pathname?.trim() || '/standalone';
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
  const safe = returnUrl.trim() || '/standalone';
  return `/platform/${page}?return=${encodeURIComponent(safe)}`;
}

/** Validates post-login redirect target (relative path only). */
export function resolveSafeAuthReturnPath(returnPath: string | null | undefined): string {
  if (!returnPath?.startsWith('/')) return '/standalone';
  if (returnPath.startsWith('//')) return '/standalone';
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
