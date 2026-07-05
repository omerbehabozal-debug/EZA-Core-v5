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

export function resolveSainaUserDisplayName(email?: string | null): string {
  if (!email?.trim()) return 'Misafir';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'Misafir';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function resolveSainaUserInitial(email?: string | null): string {
  if (!email?.trim()) return '·';
  const local = email.split('@')[0]?.trim();
  if (!local) return '·';
  return local.charAt(0).toUpperCase();
}

export function resolveSainaPlanLabel(planTier: string): string | null {
  if (planTier === 'premium') return 'SAINA Premium ✦';
  if (planTier === 'free') return 'SAINA Free';
  return null;
}

export function isSainaAuthReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return returnPath.startsWith('/standalone') || returnPath.startsWith('/m/');
}
