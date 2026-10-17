import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

export const SAINA_DISCOVER_ROUTE = '/standalone/discover';
export const SAINA_MY_PAGE_ROUTE = '/standalone/sayfam';

/** Explicit new-chat draft — bare `/standalone` redirects to Keşfet (home). */
export const SAINA_NEW_CHAT_PARAM = 'new';
export const SAINA_NEW_CHAT_ROUTE = `/standalone?${SAINA_NEW_CHAT_PARAM}=1`;

export type SainaAppView = 'chat' | 'pattern' | 'discover' | 'yansi' | 'my-page' | 'business';

export const SAINA_BUSINESS_ROUTE = '/standalone/business';

export function isPublicYansiExperiencePath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  return path === '/m' || path.startsWith('/m/');
}

export function resolveSainaAppView(pathname: string | null): SainaAppView | null {
  if (!pathname) return null;
  if (pathname === SAINA_MY_PAGE_ROUTE) return 'my-page';
  if (isPublicYansiExperiencePath(pathname)) {
    return 'yansi';
  }
  if (pathname === SAINA_DISCOVER_ROUTE || pathname.startsWith(`${SAINA_DISCOVER_ROUTE}/`)) {
    return 'discover';
  }
  // Management console only — public brand pages keep their own light shell.
  if (pathname === SAINA_BUSINESS_ROUTE) return 'business';
  if (pathname === '/standalone') return 'chat';
  if (pathname === MIRROR_PATTERN_ROUTE || pathname.startsWith(`${MIRROR_PATTERN_ROUTE}/`)) {
    return 'pattern';
  }
  return null;
}

export function isSainaAppRoute(pathname: string | null): boolean {
  return resolveSainaAppView(pathname) != null;
}

/** True when URL asks for an empty draft chat (not Keşfet home). */
export function isSainaNewChatRequest(search: string | null | undefined): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(SAINA_NEW_CHAT_PARAM) === '1';
}
