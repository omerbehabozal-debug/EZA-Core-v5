/**
 * Fetch the next unseen Discover candidate for vertical /m navigation.
 * Client-side excludes current + session history. No backend excludeSlug.
 */

import {
  DISCOVER_MAX_OFFSET,
  DISCOVER_PAGE_SIZE,
  canRequestDiscoverOffset,
  discoverPageHasMore,
  nextDiscoverPageOffset,
} from '@/lib/eza/mirror-network/discoverFeed';
import {
  fetchDiscoverMirrors,
  type FetchDiscoverMirrorsResult,
} from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { DEFAULT_DISCOVER_MODE, type DiscoverMode } from '@/lib/eza/mirror-network/discoverModes';
import { normalizeDiscoverSlug } from '@/lib/eza/mirror/journey/yansiDiscoverySession';

/** Hard cap on page fetches per DOWN to avoid unbounded loops. */
export const MAX_DISCOVER_CANDIDATE_PAGES = 8;

export type NextDiscoverCandidateOk = {
  ok: true;
  slug: string;
  nextOffset: number;
  randomSession: string;
  exhausted: false;
};

export type NextDiscoverCandidateFail = {
  ok: false;
  reason: 'exhausted' | 'error';
  nextOffset: number;
  randomSession: string;
  exhausted: boolean;
};

export type NextDiscoverCandidateResult =
  | NextDiscoverCandidateOk
  | NextDiscoverCandidateFail;

export type FetchDiscoverPageFn = (options: {
  limit?: number;
  offset?: number;
  mode?: DiscoverMode;
  randomSession?: string | null;
  signal?: AbortSignal;
}) => Promise<FetchDiscoverMirrorsResult>;

export async function fetchNextDiscoverCandidate(input: {
  excludeSlugs: Iterable<string>;
  randomSession: string;
  offset: number;
  mode?: DiscoverMode;
  pageSize?: number;
  maxPages?: number;
  signal?: AbortSignal;
  fetchPage?: FetchDiscoverPageFn;
}): Promise<NextDiscoverCandidateResult> {
  const exclude = new Set(
    Array.from(input.excludeSlugs, (s) => normalizeDiscoverSlug(s)).filter(Boolean)
  );
  const mode = input.mode ?? DEFAULT_DISCOVER_MODE;
  const pageSize = input.pageSize ?? DISCOVER_PAGE_SIZE;
  const maxPages = input.maxPages ?? MAX_DISCOVER_CANDIDATE_PAGES;
  const fetchPage = input.fetchPage ?? fetchDiscoverMirrors;
  let offset = Math.max(0, Math.floor(input.offset));
  let randomSession = input.randomSession;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    if (!canRequestDiscoverOffset(offset, DISCOVER_MAX_OFFSET)) {
      return {
        ok: false,
        reason: 'exhausted',
        nextOffset: offset,
        randomSession,
        exhausted: true,
      };
    }

    const result = await fetchPage({
      limit: pageSize,
      offset,
      mode,
      randomSession: mode === 'random' ? randomSession : null,
      signal: input.signal,
    });
    pagesFetched += 1;

    if (!result.ok) {
      return {
        ok: false,
        reason: 'error',
        nextOffset: offset,
        randomSession,
        exhausted: false,
      };
    }

    if (result.data.randomSession) {
      randomSession = result.data.randomSession;
    }

    for (const item of result.data.items) {
      const slug = normalizeDiscoverSlug(item.slug);
      if (!slug || exclude.has(slug)) continue;
      return {
        ok: true,
        slug,
        nextOffset: offset,
        randomSession,
        exhausted: false,
      };
    }

    const hasMore = discoverPageHasMore({
      offset,
      receivedCount: result.data.items.length,
      total: result.data.total,
      pageSize,
      maxOffset: DISCOVER_MAX_OFFSET,
    });
    if (!hasMore) {
      return {
        ok: false,
        reason: 'exhausted',
        nextOffset: offset,
        randomSession,
        exhausted: true,
      };
    }
    offset = nextDiscoverPageOffset(offset, pageSize);
  }

  return {
    ok: false,
    reason: 'exhausted',
    nextOffset: offset,
    randomSession,
    exhausted: true,
  };
}
