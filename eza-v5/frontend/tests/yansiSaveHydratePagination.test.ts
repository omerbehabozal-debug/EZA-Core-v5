/**
 * Meraklarım hydrate pagination — beyond the first 48-item page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/eza/mirror-network/yansiSaveApi', () => ({
  fetchMySavedYansilar: vi.fn(),
}));

import { fetchMySavedYansilar } from '@/lib/eza/mirror-network/yansiSaveApi';
import {
  clearYansiSaveStore,
  getYansiSaveSnapshot,
  hydrateYansiSaveStore,
  YANSI_SAVE_HYDRATE_MAX_PAGES,
  YANSI_SAVE_HYDRATE_PAGE_SIZE,
} from '@/lib/eza/mirror-network/yansiSaveStore';

function item(slug: string, availability: 'available' | 'unavailable' = 'available') {
  return {
    slug,
    savedAt: new Date().toISOString(),
    availability,
    publicTitle: `Title ${slug}`,
    authorDisplayName: 'Ada',
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
  };
}

function page(slugs: string[], total: number, offset: number) {
  return {
    ok: true as const,
    data: {
      items: slugs.map((s) => item(s)),
      total,
      limit: YANSI_SAVE_HYDRATE_PAGE_SIZE,
      offset,
    },
  };
}

describe('hydrateYansiSaveStore pagination', () => {
  beforeEach(() => {
    clearYansiSaveStore();
    vi.mocked(fetchMySavedYansilar).mockReset();
  });

  it('0 saves → empty inventory', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue(page([], 0, 0));
    await expect(hydrateYansiSaveStore()).resolves.toBe(true);
    expect(getYansiSaveSnapshot().items).toEqual([]);
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(1);
  });

  it('1 save → one row', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue(page(['a'], 1, 0));
    await hydrateYansiSaveStore();
    expect(getYansiSaveSnapshot().items.map((r) => r.slug)).toEqual(['a']);
  });

  it('48 saves → single page, all kept', async () => {
    const slugs = Array.from({ length: 48 }, (_, i) => `s${i}`);
    vi.mocked(fetchMySavedYansilar).mockResolvedValue(page(slugs, 48, 0));
    await hydrateYansiSaveStore();
    expect(getYansiSaveSnapshot().items).toHaveLength(48);
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(1);
  });

  it('49 saves → fetches second page and keeps all 49', async () => {
    const first = Array.from({ length: 48 }, (_, i) => `s${i}`);
    vi.mocked(fetchMySavedYansilar)
      .mockResolvedValueOnce(page(first, 49, 0))
      .mockResolvedValueOnce(page(['s48'], 49, 48));
    await hydrateYansiSaveStore();
    const items = getYansiSaveSnapshot().items;
    expect(items).toHaveLength(49);
    expect(items[48]?.slug).toBe('s48');
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(2);
    expect(fetchMySavedYansilar).toHaveBeenNthCalledWith(2, {
      limit: 48,
      offset: 48,
    });
  });

  it('96 saves → two full pages', async () => {
    const p0 = Array.from({ length: 48 }, (_, i) => `a${i}`);
    const p1 = Array.from({ length: 48 }, (_, i) => `b${i}`);
    vi.mocked(fetchMySavedYansilar)
      .mockResolvedValueOnce(page(p0, 96, 0))
      .mockResolvedValueOnce(page(p1, 96, 48));
    await hydrateYansiSaveStore();
    expect(getYansiSaveSnapshot().items).toHaveLength(96);
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(2);
  });

  it('97 saves → three pages including short final page', async () => {
    const p0 = Array.from({ length: 48 }, (_, i) => `a${i}`);
    const p1 = Array.from({ length: 48 }, (_, i) => `b${i}`);
    vi.mocked(fetchMySavedYansilar)
      .mockResolvedValueOnce(page(p0, 97, 0))
      .mockResolvedValueOnce(page(p1, 97, 48))
      .mockResolvedValueOnce(page(['c96'], 97, 96));
    await hydrateYansiSaveStore();
    expect(getYansiSaveSnapshot().items).toHaveLength(97);
    expect(getYansiSaveSnapshot().items[96]?.slug).toBe('c96');
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(3);
  });

  it('duplicate slug across page boundary → one entry, server order kept', async () => {
    const first = Array.from({ length: 48 }, (_, i) => `s${i}`);
    vi.mocked(fetchMySavedYansilar)
      .mockResolvedValueOnce(page(first, 49, 0))
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [item('s0'), item('s48')],
          total: 49,
          limit: 48,
          offset: 48,
        },
      });
    await hydrateYansiSaveStore();
    const slugs = getYansiSaveSnapshot().items.map((r) => r.slug);
    expect(slugs.filter((s) => s === 's0')).toHaveLength(1);
    expect(slugs).toContain('s48');
    expect(slugs[0]).toBe('s0');
  });

  it('later page failure keeps already hydrated pages and stops', async () => {
    const first = Array.from({ length: 48 }, (_, i) => `s${i}`);
    vi.mocked(fetchMySavedYansilar)
      .mockResolvedValueOnce(page(first, 96, 0))
      .mockResolvedValueOnce({ ok: false, code: 'saved_list_failed' });
    const ok = await hydrateYansiSaveStore();
    expect(ok).toBe(false);
    expect(getYansiSaveSnapshot().items).toHaveLength(48);
    expect(getYansiSaveSnapshot().ready).toBe(true);
    expect(fetchMySavedYansilar).toHaveBeenCalledTimes(2);
  });

  it('preserves unavailable availability from server pages', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({
      ok: true,
      data: {
        items: [item('gone', 'unavailable')],
        total: 1,
        limit: 48,
        offset: 0,
      },
    });
    await hydrateYansiSaveStore();
    expect(getYansiSaveSnapshot().items[0]?.availability).toBe('unavailable');
  });

  it('exposes defensive bounds above 48', () => {
    expect(YANSI_SAVE_HYDRATE_PAGE_SIZE).toBe(48);
    expect(YANSI_SAVE_HYDRATE_MAX_PAGES).toBeGreaterThan(1);
    expect(YANSI_SAVE_HYDRATE_PAGE_SIZE * YANSI_SAVE_HYDRATE_MAX_PAGES).toBeGreaterThan(
      48
    );
  });
});
