import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DISCOVER_FIRST_EMPTY_FILL_PAGES,
  DISCOVER_MAX_OFFSET,
  DISCOVER_PAGE_SIZE,
  DISCOVER_PREFETCH_ROOT_MARGIN_PX,
  appendDiscoverItems,
  canRequestDiscoverOffset,
  createDiscoverNextPageGate,
  discoverPageHasMore,
  discoverPrefetchObserverOptions,
  nextDiscoverPageOffset,
  pageSlugSetsDisjoint,
  shouldAcceptDiscoverPage,
} from '@/lib/eza/mirror-network/discoverFeed';
import {
  DISCOVER_RANDOM_SESSION_STORAGE_KEY,
  getOrCreateDiscoverRandomSession,
} from '@/lib/eza/mirror-network/discoverModes';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  evaluateYansiExposureWindow,
  YANSI_EXPOSURE_MIN_DWELL_MS,
  YANSI_EXPOSURE_MIN_RATIO,
} from '@/lib/eza/mirror-network/yansiExposure';
import {
  SAINA_DISCOVER_MORE_ERROR,
  SAINA_DISCOVER_MORE_RETRY,
} from '@/lib/eza/mirror-network/discoverCopy';

function card(slug: string): DiscoverMirror {
  return {
    slug,
    title: slug,
    sceneImageUrl: `https://cdn.example/${slug}.png`,
    yansiCount: 0,
  };
}

describe('Phase 7.5.1 Discover delivery helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  it('keeps page size 24 and refuses offsets past the backend cap', () => {
    expect(DISCOVER_PAGE_SIZE).toBe(24);
    expect(DISCOVER_MAX_OFFSET).toBe(500);
    expect(DISCOVER_FIRST_EMPTY_FILL_PAGES).toBe(6);
    expect(DISCOVER_PREFETCH_ROOT_MARGIN_PX).toBe(8000);
    expect(canRequestDiscoverOffset(0)).toBe(true);
    expect(canRequestDiscoverOffset(500)).toBe(true);
    expect(canRequestDiscoverOffset(504)).toBe(false);
    expect(nextDiscoverPageOffset(480)).toBe(504);
    expect(
      discoverPageHasMore({ offset: 480, receivedCount: 24, total: 10_000 })
    ).toBe(false);
    expect(
      discoverPageHasMore({ offset: 0, receivedCount: 24, total: 100 })
    ).toBe(true);
  });

  it('appends without duplicates and proves page sets disjoint', () => {
    const page1 = [card('a'), card('b'), card('c')];
    const page2 = [card('c'), card('d'), card('e')];
    const merged = appendDiscoverItems(page1, page2);
    expect(merged.items.map((item) => item.slug)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(merged.skipped).toBe(1);
    expect(
      pageSlugSetsDisjoint([
        [card('a'), card('b')],
        [card('c'), card('d')],
        [card('e')],
      ])
    ).toBe(true);
    expect(pageSlugSetsDisjoint([[card('a')], [card('a')]])).toBe(false);
  });

  it('fast-scroll gate allows only one in-flight next page', () => {
    const gate = createDiscoverNextPageGate();
    expect(gate.tryBegin()).toBe(true);
    expect(gate.tryBegin()).toBe(false);
    expect(gate.tryBegin()).toBe(false);
    gate.end();
    expect(gate.tryBegin()).toBe(true);
  });

  it('rejects out-of-order and stale-generation pages', () => {
    expect(
      shouldAcceptDiscoverPage({
        requestId: 2,
        currentId: 2,
        expectedOffset: 24,
        receivedOffset: 24,
      })
    ).toBe(true);
    expect(
      shouldAcceptDiscoverPage({
        requestId: 1,
        currentId: 2,
        expectedOffset: 24,
        receivedOffset: 24,
      })
    ).toBe(false);
    expect(
      shouldAcceptDiscoverPage({
        requestId: 2,
        currentId: 2,
        expectedOffset: 24,
        receivedOffset: 48,
      })
    ).toBe(false);
  });

  it('prefetch observer uses a multi-card buffer, not scroll-event spam', () => {
    const options = discoverPrefetchObserverOptions(null);
    expect(options.rootMargin).toBe('0px 0px 8000px 0px');
    expect(options.threshold).toBe(0);
  });

  it('prefetch/network is not exposure', () => {
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: 0,
        documentHidden: false,
        dwellMs: 5_000,
      })
    ).toBe('ignore');
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: 0.2,
        documentHidden: false,
        dwellMs: 5_000,
      })
    ).toBe('ignore');
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: YANSI_EXPOSURE_MIN_RATIO,
        documentHidden: false,
        dwellMs: YANSI_EXPOSURE_MIN_DWELL_MS,
      })
    ).toBe('count');
  });

  it('fast pagination does not mint a new randomSession', () => {
    const a = getOrCreateDiscoverRandomSession();
    const b = getOrCreateDiscoverRandomSession();
    const c = getOrCreateDiscoverRandomSession();
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(sessionStorage.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY)).toBe(a);
  });

  it('Discover delivery modules do not track exposure or ranking internals', () => {
    const files = [
      'lib/eza/mirror-network/discoverFeed.ts',
      'lib/eza/mirror-network/discoverExperiencedMirrors.ts',
      'components/saina/SainaDiscoverPage.tsx',
      'components/saina/SainaDiscoverList.tsx',
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src).not.toContain('trackYansiExposure');
      expect(src).not.toContain('curiosityScore');
      expect(src).not.toContain('order_final_shadow_candidates');
      expect(src).not.toContain('yansi_strong_curiosity_staging_seed');
    }
    expect(SAINA_DISCOVER_MORE_ERROR).toBe('Daha fazla Yansı şu an yüklenemedi.');
    expect(SAINA_DISCOVER_MORE_RETRY).toBe('Tekrar dene');
  });
});
