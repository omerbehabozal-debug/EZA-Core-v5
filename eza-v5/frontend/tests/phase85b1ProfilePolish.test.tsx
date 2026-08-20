/**
 * Phase 8.5B.1 — profile polish: load-more concurrency/dedupe + edit focus trap.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AuthorPublishedYansiProfile from '@/components/mirror/ayna/AuthorPublishedYansiProfile';
import ProfileEditSheet from '@/components/mirror/ayna/ProfileEditSheet';
import { mergeProfileItemsBySlug } from '@/lib/eza/mirror-network/fetchAuthorPublished';

const authState = vi.hoisted(() => ({
  user: null as null | { user_id: string; email: string; public_display_name?: string },
  isAuthenticated: false,
  isAuthReady: true,
  token: null as string | null,
  setAuth: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    ...authState,
    logout: vi.fn(),
    role: null,
  }),
}));

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchAuthorPublishedYansilar: vi.fn(),
    fetchOwnerProfileYansilar: vi.fn(),
  };
});

vi.mock('@/lib/eza/plan/fetchAuthMe', () => ({
  patchPublicIdentity: vi.fn(),
}));

vi.mock('@/lib/eza/mirror-network/yansiTrustActions', () => ({
  unpublishYansi: vi.fn(async () => ({ ok: true, status: 'unpublished' })),
  setYansiVisibility: vi.fn(async () => ({ ok: true, status: 'updated' })),
  reportYansi: vi.fn(),
  YANSI_REPORT_REASONS: [],
}));

vi.mock('@/components/mirror-landing/YansiExposureRoot', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import {
  fetchAuthorPublishedYansilar,
  fetchOwnerProfileYansilar,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';

const item = (slug: string, title = slug) => ({
  slug,
  shareUrl: `/m/${slug}`,
  publicTitle: title,
  publicSummary: `Summary for ${slug}`,
  sceneImageUrl: `https://cdn.example/${slug}.png`,
  journeyVersion: 1,
});

describe('Phase 8.5B.1 profile polish', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAuthReady = true;
    authState.token = null;
    vi.mocked(fetchAuthorPublishedYansilar).mockReset();
    vi.mocked(fetchOwnerProfileYansilar).mockReset();
  });

  it('mergeProfileItemsBySlug dedupes and preserves order', () => {
    const page1 = [item('a'), item('b'), item('c')];
    const page2 = [item('c'), item('d'), item('e')];
    expect(mergeProfileItemsBySlug(page1, page2).map((r) => r.slug)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('rapid load-more does not start concurrent requests', async () => {
    let resolveFirst: ((v: unknown) => void) | undefined;
    const pending = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    vi.mocked(fetchAuthorPublishedYansilar)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 30,
          items: [item('a')],
        },
      })
      .mockImplementationOnce(() => pending as never)
      .mockResolvedValue({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 30,
          items: [item('b')],
        },
      });

    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(await screen.findByTestId('bilign-profile-load-more')).toBeTruthy();

    const btn = screen.getByTestId('bilign-profile-load-more');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    // Initial + one in-flight append only (guard blocks extras).
    await waitFor(() => {
      expect(fetchAuthorPublishedYansilar).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveFirst?.({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 30,
          items: [item('b')],
        },
      });
    });
  });

  it('duplicate slugs across pages render once', async () => {
    vi.mocked(fetchAuthorPublishedYansilar)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 5,
          items: [item('a'), item('b'), item('c')],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 5,
          items: [item('c'), item('d'), item('e')],
        },
      });

    render(<AuthorPublishedYansiProfile userId="user-1" />);
    fireEvent.click(await screen.findByTestId('bilign-profile-load-more'));
    await waitFor(() => {
      expect(screen.getByText('d')).toBeTruthy();
    });
    expect(screen.getAllByTestId('author-published-item')).toHaveLength(5);
    expect(screen.getAllByText('c')).toHaveLength(1);
  });

  it('public load-more stays on public endpoint', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'user-1',
        displayName: 'Ada',
        total: 2,
        items: [item('a')],
      },
    });
    render(<AuthorPublishedYansiProfile userId="user-1" />);
    fireEvent.click(await screen.findByTestId('bilign-profile-load-more'));
    await waitFor(() => {
      expect(fetchAuthorPublishedYansilar).toHaveBeenCalledTimes(2);
    });
    expect(fetchOwnerProfileYansilar).not.toHaveBeenCalled();
    const appendCall = vi.mocked(fetchAuthorPublishedYansilar).mock.calls[1];
    expect(appendCall?.[0]).toBe('user-1');
  });

  it('owner load-more stays on authenticated owner endpoint', async () => {
    authState.isAuthenticated = true;
    authState.user = { user_id: 'owner-1', email: 'a@b.com' };
    vi.mocked(fetchOwnerProfileYansilar)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'owner-1',
          displayName: 'Ada',
          total: 2,
          items: [item('x')],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'owner-1',
          displayName: 'Ada',
          total: 2,
          items: [item('y')],
        },
      });
    render(<AuthorPublishedYansiProfile userId="owner-1" />);
    fireEvent.click(await screen.findByTestId('bilign-profile-load-more'));
    await waitFor(() => {
      expect(fetchOwnerProfileYansilar).toHaveBeenCalledTimes(2);
    });
    expect(fetchAuthorPublishedYansilar).not.toHaveBeenCalled();
  });

  it('edit sheet traps Tab / Shift+Tab and returns focus on close', async () => {
    authState.isAuthenticated = true;
    authState.token = 'tok';
    authState.user = { user_id: 'u1', email: 'a@b.com', public_display_name: 'Ada' };

    const trigger = document.createElement('button');
    trigger.textContent = 'Profili düzenle';
    document.body.appendChild(trigger);
    const returnFocusRef = { current: trigger };

    const onClose = vi.fn();
    const { rerender } = render(
      <ProfileEditSheet
        open
        onClose={onClose}
        initialName="Ada"
        onSaved={vi.fn()}
        returnFocusRef={returnFocusRef}
      />
    );

    const sheet = await screen.findByTestId('bilign-profile-edit-sheet');
    expect(sheet).toBeTruthy();

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('bilign-profile-edit-input')
      );
    });

    const input = screen.getByTestId('bilign-profile-edit-input');
    const cancel = screen.getByTestId('bilign-profile-edit-cancel');
    const save = screen.getByTestId('bilign-profile-edit-save');

    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(input);

    input.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ProfileEditSheet
        open={false}
        onClose={onClose}
        initialName="Ada"
        onSaved={vi.fn()}
        returnFocusRef={returnFocusRef}
      />
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    document.body.removeChild(trigger);
  });

  it('8.5B card contract and Discover isolation remain', () => {
    const card = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/ProfileYansiCard.tsx'),
      'utf8'
    );
    expect(card).toContain('MirrorPublicCard');
    expect(card).toContain('summary');
    expect(card).not.toContain('yansi-public-metrics');
    expect(card).toContain('/m/');
    expect(card).not.toContain('/sohbet');

    const discover = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(discover).toContain('YansiPublicMetricsView');

    const profile = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AuthorPublishedYansiProfile.tsx'),
      'utf8'
    );
    expect(profile).toContain('loadMoreInFlightRef');
    expect(profile).toContain('mergeProfileItemsBySlug');
    expect(profile).not.toContain('useModalFocusTrap');
  });

  it('ProfileEditSheet uses shared focus trap hook', () => {
    const sheet = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/ProfileEditSheet.tsx'),
      'utf8'
    );
    expect(sheet).toContain('useModalFocusTrap');
    expect(sheet).toContain('returnFocusRef');
  });

  it('Phase 8.5A privacy and 8.4 visibility contracts remain in profile surfaces', () => {
    const identity = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/publicIdentity.ts'),
      'utf8'
    );
    expect(identity).toContain('PUBLIC_DISPLAY_NAME_FALLBACK');
    expect(identity).not.toMatch(/split\(['"]@['"]\)/);

    const fetch = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchAuthorPublished.ts'),
      'utf8'
    );
    expect(fetch).toContain('fetchAuthorPublishedYansilar');
    expect(fetch).toContain('fetchOwnerProfileYansilar');
    expect(fetch).toContain('/authors/');
    expect(fetch).toContain('profile-yansilar');

    const card = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/ProfileYansiCard.tsx'),
      'utf8'
    );
    expect(card).toContain('setYansiVisibility');
    expect(card).toContain('unpublishYansi');
  });
});
