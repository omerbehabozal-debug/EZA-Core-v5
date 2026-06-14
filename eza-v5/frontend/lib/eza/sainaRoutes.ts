import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

export type SainaAppView = 'chat' | 'pattern';

export function resolveSainaAppView(pathname: string | null): SainaAppView | null {
  if (!pathname) return null;
  if (pathname === '/standalone') return 'chat';
  if (pathname === MIRROR_PATTERN_ROUTE || pathname.startsWith(`${MIRROR_PATTERN_ROUTE}/`)) {
    return 'pattern';
  }
  return null;
}

export function isSainaAppRoute(pathname: string | null): boolean {
  return resolveSainaAppView(pathname) != null;
}
