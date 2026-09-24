/**
 * Public Yansı consumer depth — Reel preview vs Chat replay.
 * Same artifact/session; presentation depth only.
 */

export type YansiPublicDepth = 'reel' | 'chat';

export const YANSI_PUBLIC_DEPTH_QUERY = 'mode';
export const YANSI_PUBLIC_VERSION_QUERY = 'journeyVersion';

export function parseYansiPublicDepth(
  search: string | URLSearchParams | null | undefined
): YansiPublicDepth {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : null;
  const raw = (params?.get(YANSI_PUBLIC_DEPTH_QUERY) || '').trim().toLowerCase();
  return raw === 'chat' ? 'chat' : 'reel';
}

export function parsePinnedJourneyVersion(
  search: string | URLSearchParams | null | undefined
): number | null {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : null;
  const raw = params?.get(YANSI_PUBLIC_VERSION_QUERY);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export type BuildMirrorPublicPathOptions = {
  journeyVersion?: number | null;
  mode?: YansiPublicDepth;
};

/**
 * Canonical public path. Discover → Reel uses PUSH with this href.
 * In-Reel slug changes use replace (no stack growth).
 */
export function buildYansiPublicHref(
  slug: string,
  options?: BuildMirrorPublicPathOptions
): string {
  const safe = (slug || '').trim();
  if (!safe) return '/m';
  const params = new URLSearchParams();
  const version =
    options?.journeyVersion != null &&
    Number.isInteger(options.journeyVersion) &&
    options.journeyVersion >= 1
      ? options.journeyVersion
      : null;
  if (version != null) {
    params.set(YANSI_PUBLIC_VERSION_QUERY, String(version));
  }
  if (options?.mode === 'chat') {
    params.set(YANSI_PUBLIC_DEPTH_QUERY, 'chat');
  }
  const q = params.toString();
  return q ? `/m/${safe}?${q}` : `/m/${safe}`;
}

/** Sync URL without App Router remount (preserves discovery session). */
export function replaceYansiPublicUrl(href: string): void {
  if (typeof window === 'undefined') return;
  const desired = href.startsWith('/') ? href : `/${href}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === desired) return;
  window.history.replaceState(window.history.state, '', desired);
}

export type YansiPublicHistoryState = {
  yansiPublicDepth?: YansiPublicDepth;
};

/** PUSH chat depth without App Router remount. */
export function pushYansiChatDepth(href: string): void {
  if (typeof window === 'undefined') return;
  const desired = href.startsWith('/') ? href : `/${href}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === desired) return;
  const state: YansiPublicHistoryState = { yansiPublicDepth: 'chat' };
  window.history.pushState(state, '', desired);
}

/**
 * Exit CHAT → REEL.
 * Prefer history.back() when chat was pushed (exact stack unwind).
 * Deep-linked chat uses replaceState to drop mode=chat without leaving /m.
 */
export function returnToYansiReelDepth(input: {
  reelHref: string;
  onDepthChange?: (depth: YansiPublicDepth) => void;
}): void {
  if (typeof window === 'undefined') {
    input.onDepthChange?.('reel');
    return;
  }
  const state = window.history.state as YansiPublicHistoryState | null;
  if (state?.yansiPublicDepth === 'chat') {
    window.history.back();
    return;
  }
  replaceYansiPublicUrl(input.reelHref);
  input.onDepthChange?.('reel');
}

/**
 * Back from Reel → Discover when possible; safe fallback for deep links.
 * Prefer history.back over push('/standalone/discover') to restore scroll.
 */
export function navigateBackFromYansiReel(router: {
  back: () => void;
  replace: (href: string) => void;
}): void {
  if (typeof window !== 'undefined') {
    const referrer = document.referrer || '';
    let sameOriginReferrer = false;
    try {
      if (referrer) {
        const ref = new URL(referrer);
        sameOriginReferrer = ref.origin === window.location.origin;
      }
    } catch {
      sameOriginReferrer = false;
    }
    if (sameOriginReferrer || window.history.length > 1) {
      router.back();
      return;
    }
  }
  router.replace('/standalone/discover');
}
