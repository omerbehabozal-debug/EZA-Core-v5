/**
 * Phase 7.5.1 — Discover delivery helpers.
 *
 * Ranking, mode contract, and exposure semantics stay elsewhere.
 * This module only decides how pages append, when to prefetch, and
 * how to ignore stale or out-of-order responses.
 */

import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

/** Must match backend DEFAULT_DISCOVER_LIMIT. */
export const DISCOVER_PAGE_SIZE = 24;

/** Must match backend MAX_DISCOVER_OFFSET. Do not request past this. */
export const DISCOVER_MAX_OFFSET = 500;

/**
 * Sentinel rootMargin below the scrollport.
 *
 * Cards are ~550px tall (1:1 visual + body + gap). 8000px ≈ 14 cards,
 * so a fast fling still has a buffer after the one-page-ahead prefetch
 * of page 2 (48 cards loaded before the user is near the end).
 */
export const DISCOVER_PREFETCH_ROOT_MARGIN_PX = 8000;

/** Rastlantısal first-page only: keep fetching while the hide-list emptied the page. */
export const DISCOVER_FIRST_EMPTY_FILL_PAGES = 6;

export function discoverPrefetchObserverOptions(
  root: Element | null
): IntersectionObserverInit {
  return {
    root,
    rootMargin: `0px 0px ${DISCOVER_PREFETCH_ROOT_MARGIN_PX}px 0px`,
    threshold: 0,
  };
}

export function nextDiscoverPageOffset(
  offset: number,
  pageSize = DISCOVER_PAGE_SIZE
): number {
  return Math.max(0, offset) + pageSize;
}

export function discoverPageHasMore(input: {
  offset: number;
  receivedCount: number;
  total: number;
  pageSize?: number;
  maxOffset?: number;
}): boolean {
  const pageSize = input.pageSize ?? DISCOVER_PAGE_SIZE;
  const maxOffset = input.maxOffset ?? DISCOVER_MAX_OFFSET;
  if (input.receivedCount <= 0) return false;
  if (input.receivedCount < pageSize) return false;
  const nextOffset = nextDiscoverPageOffset(input.offset, pageSize);
  if (nextOffset > maxOffset) return false;
  if (nextOffset >= input.total) return false;
  return true;
}

export function canRequestDiscoverOffset(
  offset: number,
  maxOffset = DISCOVER_MAX_OFFSET
): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= maxOffset;
}

export function appendDiscoverItems(
  existing: DiscoverMirror[],
  incoming: DiscoverMirror[]
): { items: DiscoverMirror[]; added: number; skipped: number } {
  const seen = new Set(
    existing.map((item) => item.slug.trim().toLowerCase()).filter(Boolean)
  );
  const extra: DiscoverMirror[] = [];
  for (const item of incoming) {
    const key = item.slug.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    extra.push(item);
  }
  return {
    items: extra.length > 0 ? existing.concat(extra) : existing,
    added: extra.length,
    skipped: incoming.length - extra.length,
  };
}

export function shouldAcceptDiscoverPage(input: {
  requestId: number;
  currentId: number;
  expectedOffset: number;
  receivedOffset: number;
}): boolean {
  if (input.requestId !== input.currentId) return false;
  if (input.expectedOffset !== input.receivedOffset) return false;
  return true;
}

export function createDiscoverNextPageGate(): {
  tryBegin: () => boolean;
  end: () => void;
  reset: () => void;
  isInFlight: () => boolean;
} {
  let inFlight = false;
  return {
    tryBegin: () => {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end: () => {
      inFlight = false;
    },
    reset: () => {
      inFlight = false;
    },
    isInFlight: () => inFlight,
  };
}

export function pageSlugSetsDisjoint(
  pages: Array<Array<{ slug: string }>>
): boolean {
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page) {
      const key = item.slug.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}
