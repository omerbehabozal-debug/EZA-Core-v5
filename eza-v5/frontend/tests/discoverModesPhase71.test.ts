import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISCOVER_MODE,
  DISCOVER_MODE_LABELS,
  DISCOVER_MODES,
  DISCOVER_RANDOM_SESSION_STORAGE_KEY,
  discoverHrefForMode,
  getOrCreateDiscoverRandomSession,
  parseDiscoverMode,
  parseDiscoverModeFromSearch,
  shouldApplyDiscoverResponse,
  shouldHideExperiencedDiscoverItems,
} from '@/lib/eza/mirror-network/discoverModes';
import {
  filterDiscoverMirrorsForViewer,
  markDiscoverMirrorExperienced,
} from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { buildDiscoverListUrl } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  SAINA_DISCOVER_MODE_NEWEST,
  SAINA_DISCOVER_MODE_RASTLANTISAL,
  SAINA_DISCOVER_MODE_STRONG_CURIOSITY,
} from '@/lib/eza/mirror-network/discoverCopy';

vi.mock('@/lib/apiUrl', () => ({
  getApiUrl: () => 'https://api.example',
}));

const items: DiscoverMirror[] = [
  { slug: 'bmw-sport', title: 'BMW', sceneImageUrl: 'https://cdn/a.png', yansiCount: 3 },
  { slug: 'japan-kyoto', title: 'Japonya', sceneImageUrl: 'https://cdn/b.png', yansiCount: 1 },
];

describe('Phase 7.1 discover mode contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('defaults missing mode to Rastlantısal / random', () => {
    expect(parseDiscoverMode(null)).toEqual({ ok: true, mode: 'random', missing: true });
    expect(parseDiscoverMode('')).toEqual({ ok: true, mode: 'random', missing: true });
    expect(parseDiscoverModeFromSearch('')).toEqual({
      ok: true,
      mode: 'random',
      missing: true,
    });
    expect(DEFAULT_DISCOVER_MODE).toBe('random');
    expect(discoverHrefForMode('random')).toBe('/standalone/discover');
  });

  it('rejects invalid mode instead of remapping', () => {
    expect(parseDiscoverMode('popular')).toEqual({
      ok: false,
      reason: 'invalid_discover_mode',
      raw: 'popular',
    });
    expect(parseDiscoverModeFromSearch('?mode=yansiCount').ok).toBe(false);
  });

  it('selector copy is exactly Rastlantısal / Güçlü Merak / En Yeni', () => {
    expect(DISCOVER_MODES).toEqual(['random', 'strong_curiosity', 'newest']);
    expect(DISCOVER_MODE_LABELS.random).toBe('Rastlantısal');
    expect(DISCOVER_MODE_LABELS.strong_curiosity).toBe('Güçlü Merak');
    expect(DISCOVER_MODE_LABELS.newest).toBe('En Yeni');
    expect(SAINA_DISCOVER_MODE_RASTLANTISAL).toBe('Rastlantısal');
    expect(SAINA_DISCOVER_MODE_STRONG_CURIOSITY).toBe('Güçlü Merak');
    expect(SAINA_DISCOVER_MODE_NEWEST).toBe('En Yeni');
  });

  it('builds fetch URLs with explicit mode and random session only for Rastlantısal', () => {
    expect(buildDiscoverListUrl({ mode: 'newest', randomSession: 'session-aa' })).toBe(
      'https://api.example/api/mirror-network/discover?limit=24&offset=0&mode=newest'
    );
    expect(
      buildDiscoverListUrl({
        mode: 'random',
        randomSession: 'session-aa',
        limit: 24,
        offset: 24,
      })
    ).toBe(
      'https://api.example/api/mirror-network/discover?limit=24&offset=24&mode=random&randomSession=session-aa'
    );
    expect(buildDiscoverListUrl()).toContain('mode=random');
  });

  it('does not call per-card /metrics from Discover clients', () => {
    const files = [
      'lib/eza/mirror-network/fetchDiscoverMirrors.ts',
      'lib/eza/mirror-network/discoverExperiencedMirrors.ts',
      'lib/eza/mirror-network/discoverFeed.ts',
      'components/saina/SainaDiscoverPage.tsx',
      'components/saina/SainaDiscoverCard.tsx',
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src).not.toContain('fetchYansiPublicMetrics');
      expect(src).not.toContain('/metrics');
      expect(src).not.toContain('trackYansiExposure');
      expect(src).not.toContain('yansi_signal_semantics');
      expect(src).not.toContain('compositeScore');
    }
  });

  it('hides experienced slugs only in Rastlantısal', () => {
    markDiscoverMirrorExperienced('bmw-sport');
    expect(shouldHideExperiencedDiscoverItems('random')).toBe(true);
    expect(shouldHideExperiencedDiscoverItems('newest')).toBe(false);
    expect(shouldHideExperiencedDiscoverItems('strong_curiosity')).toBe(false);
    expect(filterDiscoverMirrorsForViewer(items, 'random').map((row) => row.slug)).toEqual([
      'japan-kyoto',
    ]);
    expect(filterDiscoverMirrorsForViewer(items, 'newest').map((row) => row.slug)).toEqual([
      'bmw-sport',
      'japan-kyoto',
    ]);
  });

  it('keeps an opaque random session in sessionStorage, not localStorage', () => {
    const a = getOrCreateDiscoverRandomSession();
    const b = getOrCreateDiscoverRandomSession();
    expect(a).toBe(b);
    expect(sessionStorage.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY)).toBe(a);
    expect(localStorage.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('drops stale responses when the request id moved on', () => {
    expect(shouldApplyDiscoverResponse(1, 2)).toBe(false);
    expect(shouldApplyDiscoverResponse(3, 3)).toBe(true);
  });
});
