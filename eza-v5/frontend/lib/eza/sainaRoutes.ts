import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

export const SAINA_DISCOVER_ROUTE = '/standalone/discover';

export type SainaAppView = 'chat' | 'pattern' | 'discover';

export function resolveSainaAppView(pathname: string | null): SainaAppView | null {
  if (!pathname) return null;
  if (pathname === SAINA_DISCOVER_ROUTE || pathname.startsWith(`${SAINA_DISCOVER_ROUTE}/`)) {
    return 'discover';
  }
  if (pathname === '/standalone') return 'chat';
  if (pathname === MIRROR_PATTERN_ROUTE || pathname.startsWith(`${MIRROR_PATTERN_ROUTE}/`)) {
    return 'pattern';
  }
  return null;
}

export function isSainaAppRoute(pathname: string | null): boolean {
  return resolveSainaAppView(pathname) != null;
}
