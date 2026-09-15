/**
 * Slice 3 — vertical Discover session pure helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  activeDiscoverSlug,
  canDiscoverGoDownInHistory,
  canDiscoverGoUp,
  createYansiDiscoverySession,
  discoverAppendAndActivate,
  discoverExcludeSet,
  discoverGoDownInHistory,
  discoverGoUp,
  discoverMarkPoolExhausted,
  needsDiscoverFetchForDown,
} from '@/lib/eza/mirror/journey/yansiDiscoverySession';
import { fetchNextDiscoverCandidate } from '@/lib/eza/mirror/journey/fetchNextDiscoverCandidate';
import type { FetchDiscoverMirrorsResult } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

describe('yansiDiscoverySession', () => {
  it('starts at direct-entry slug', () => {
    const session = createYansiDiscoverySession('Yansi-B')!;
    expect(session.history).toEqual(['yansi-b']);
    expect(session.activeIndex).toBe(0);
    expect(activeDiscoverSlug(session)).toBe('yansi-b');
    expect(canDiscoverGoUp(session)).toBe(false);
    expect(needsDiscoverFetchForDown(session)).toBe(true);
  });

  it('DOWN history then UP then DOWN reuses forward history', () => {
    let session = createYansiDiscoverySession('b')!;
    session = discoverAppendAndActivate(session, 'x')!;
    session = discoverAppendAndActivate(session, 'y')!;
    expect(session.history).toEqual(['b', 'x', 'y']);
    expect(activeDiscoverSlug(session)).toBe('y');

    session = discoverGoUp(session)!;
    expect(activeDiscoverSlug(session)).toBe('x');
    expect(canDiscoverGoDownInHistory(session)).toBe(true);
    expect(needsDiscoverFetchForDown(session)).toBe(false);

    session = discoverGoDownInHistory(session)!;
    expect(activeDiscoverSlug(session)).toBe('y');
    expect(needsDiscoverFetchForDown(session)).toBe(true);
  });

  it('UP at first item is a no-op', () => {
    const session = createYansiDiscoverySession('b')!;
    expect(discoverGoUp(session)).toBeNull();
  });

  it('does not append when not at newest end', () => {
    let session = createYansiDiscoverySession('b')!;
    session = discoverAppendAndActivate(session, 'x')!;
    session = discoverGoUp(session)!;
    expect(discoverAppendAndActivate(session, 'z')).toBeNull();
  });

  it('exclude set includes history', () => {
    let session = createYansiDiscoverySession('b')!;
    session = discoverAppendAndActivate(session, 'x')!;
    expect([...discoverExcludeSet(session)].sort()).toEqual(['b', 'x']);
  });

  it('pool exhausted blocks further fetch need', () => {
    let session = createYansiDiscoverySession('b')!;
    session = discoverMarkPoolExhausted(session);
    expect(needsDiscoverFetchForDown(session)).toBe(false);
  });
});

describe('fetchNextDiscoverCandidate', () => {
  it('skips current and visited slugs', async () => {
    const pages: FetchDiscoverMirrorsResult[] = [
      {
        ok: true,
        data: {
          items: [
            {
              slug: 'b',
              title: 'B',
              sceneImageUrl: 'https://cdn.example/b.jpg',
              yansiCount: 0,
            },
            {
              slug: 'x',
              title: 'X',
              sceneImageUrl: 'https://cdn.example/x.jpg',
              yansiCount: 0,
            },
          ],
          total: 2,
          mode: 'random',
          randomSession: 'session-fair-01',
          strongCuriosityReady: false,
        },
      },
    ];
    let calls = 0;
    const result = await fetchNextDiscoverCandidate({
      excludeSlugs: ['b'],
      randomSession: 'session-fair-01',
      offset: 0,
      fetchPage: async () => pages[calls++]!,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe('x');
    }
  });

  it('advances pages when whole page is excluded', async () => {
    const result = await fetchNextDiscoverCandidate({
      excludeSlugs: ['a', 'b'],
      randomSession: 'session-fair-02',
      offset: 0,
      pageSize: 2,
      fetchPage: async ({ offset }) => {
        if (offset === 0) {
          return {
            ok: true,
            data: {
              items: [
                {
                  slug: 'a',
                  title: 'A',
                  sceneImageUrl: 'https://cdn.example/a.jpg',
                  yansiCount: 0,
                },
                {
                  slug: 'b',
                  title: 'B',
                  sceneImageUrl: 'https://cdn.example/b.jpg',
                  yansiCount: 0,
                },
              ],
              total: 4,
              mode: 'random',
              randomSession: 'session-fair-02',
              strongCuriosityReady: false,
            },
          };
        }
        return {
          ok: true,
          data: {
            items: [
              {
                slug: 'c',
                title: 'C',
                sceneImageUrl: 'https://cdn.example/c.jpg',
                yansiCount: 0,
              },
              {
                slug: 'd',
                title: 'D',
                sceneImageUrl: 'https://cdn.example/d.jpg',
                yansiCount: 0,
              },
            ],
            total: 4,
            mode: 'random',
            randomSession: 'session-fair-02',
            strongCuriosityReady: false,
          },
        };
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slug).toBe('c');
  });

  it('returns exhausted when pool empty of unseen', async () => {
    const result = await fetchNextDiscoverCandidate({
      excludeSlugs: ['only'],
      randomSession: 'session-fair-03',
      offset: 0,
      fetchPage: async () => ({
        ok: true,
        data: {
          items: [
            {
              slug: 'only',
              title: 'Only',
              sceneImageUrl: 'https://cdn.example/o.jpg',
              yansiCount: 0,
            },
          ],
          total: 1,
          mode: 'random',
          randomSession: 'session-fair-03',
          strongCuriosityReady: false,
        },
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('exhausted');
      expect(result.exhausted).toBe(true);
    }
  });

  it('returns error without mutating exhausted on fetch failure', async () => {
    const result = await fetchNextDiscoverCandidate({
      excludeSlugs: ['b'],
      randomSession: 'session-fair-04',
      offset: 0,
      fetchPage: async () => ({ ok: false, status: 500 }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('error');
      expect(result.exhausted).toBe(false);
    }
  });
});
