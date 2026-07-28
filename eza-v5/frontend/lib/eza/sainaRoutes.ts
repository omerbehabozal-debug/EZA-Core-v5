import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

export const SAINA_DISCOVER_ROUTE = '/standalone/discover';

/** Explicit new-chat draft — bare `/standalone` redirects to Keşfet (home). */
export const SAINA_NEW_CHAT_PARAM = 'new';
export const SAINA_NEW_CHAT_ROUTE = `/standalone?${SAINA_NEW_CHAT_PARAM}=1`;

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

/** True when URL asks for an empty draft chat (not Keşfet home). */
export function isSainaNewChatRequest(search: string | null | undefined): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(SAINA_NEW_CHAT_PARAM) === '1';
}
