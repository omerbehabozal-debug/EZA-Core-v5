/**
 * Phase 8.5B — profile experience & design.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AuthorPublishedYansiProfile from '@/components/mirror/ayna/AuthorPublishedYansiProfile';
import {
  resolvePublicAvatarGrapheme,
  PUBLIC_DISPLAY_NAME_FALLBACK,
} from '@/lib/eza/mirror/publicIdentity';

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
import { patchPublicIdentity } from '@/lib/eza/plan/fetchAuthMe';

const sampleItem = {
  slug: 'yansi-a',
  shareUrl: '/m/yansi-a',
  publicTitle: 'Şehir ışıkları',
  publicSummary: 'Akşam yürüyüşünde mimari detaylara takılan bir sohbetten doğdu.',
  sceneImageUrl: 'https://cdn.example/scene.png',
  journeyVersion: 1,
  experienceStartedCount: 12,
  directChildYansiCount: 3,
};

describe('Phase 8.5B profile experience', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAuthReady = true;
    authState.token = null;
    vi.mocked(fetchAuthorPublishedYansilar).mockReset();
    vi.mocked(fetchOwnerProfileYansilar).mockReset();
    vi.mocked(patchPublicIdentity).mockReset();
  });

  it('public profile: avatar, name, visual+title+summary; no bio/follow/metrics', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'user-1',
        displayName: 'Ömer Bozal',
        total: 1,
        items: [sampleItem],
      },
    });

    render(<AuthorPublishedYansiProfile userId="user-1" />);

    expect(await screen.findByTestId('bilign-profile-avatar')).toBeTruthy();
    expect(screen.getByTestId('bilign-profile-display-name')).toHaveTextContent(
      'Ömer Bozal'
    );
    expect(screen.getByTestId('bilign-profile-honorific')).toHaveTextContent('Meraklı');
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByText('Yansılar')).toBeTruthy();
    expect(screen.getByText('Şehir ışıkları')).toBeTruthy();
    expect(
      screen.getByText(/Akşam yürüyüşünde mimari detaylara/)
    ).toBeTruthy();
    expect(screen.getByTestId('saina-discover-card-image')).toBeTruthy();

    expect(screen.queryByTestId('bilign-profile-edit-trigger')).toBeNull();
    expect(screen.queryByText(/bio/i)).toBeNull();
    expect(screen.queryByText(/takip/i)).toBeNull();
    expect(screen.queryByText(/Follow/i)).toBeNull();
    expect(screen.queryByText(/follower/i)).toBeNull();
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText('12 deneyim')).toBeNull();
    expect(screen.queryByTestId('profile-visibility-chip-yansi-a')).toBeNull();

    const link = screen.getByTestId('profile-yansi-link-yansi-a');
    expect(link.getAttribute('href')).toBe('/m/yansi-a');
    expect(link.getAttribute('href')).not.toContain('sohbet');
  });

  it('public profile shows assigned Bilgin without an edit control', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'user-1',
        displayName: 'Ada Lovelace',
        publicHonorific: 'bilgin',
        total: 0,
        items: [],
      },
    });
    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(await screen.findByTestId('bilign-profile-honorific')).toHaveTextContent(
      'Bilgin'
    );
    expect(screen.queryByTestId('bilign-profile-edit-trigger')).toBeNull();
  });

  it('avatar grapheme never uses email local-part', () => {
    expect(resolvePublicAvatarGrapheme(PUBLIC_DISPLAY_NAME_FALLBACK)).toBe('b');
    expect(resolvePublicAvatarGrapheme('Ayşe')).toBe('A');
    expect(resolvePublicAvatarGrapheme('محمد')).toBe('م');
    const src = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/ProfileDefaultAvatar.tsx'),
      'utf8'
    );
    expect(src).toContain('Never email-derived');
    expect(src).toContain('resolvePublicAvatarGrapheme');
    expect(src).not.toContain('split');
    expect(src).not.toContain('user?.email');
    expect(src).not.toContain('split(\'@\')');
  });

  it('auth not ready shows skeleton, not owner controls', () => {
    authState.isAuthReady = false;
    authState.isAuthenticated = true;
    authState.user = { user_id: 'user-1', email: 'a@b.com' };
    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(screen.getByTestId('bilign-profile-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('bilign-profile-edit-trigger')).toBeNull();
    expect(fetchOwnerProfileYansilar).not.toHaveBeenCalled();
    expect(fetchAuthorPublishedYansilar).not.toHaveBeenCalled();
  });

  it('owner sees same cards + Profili düzenle + visibility + overflow', async () => {
    authState.isAuthReady = true;
    authState.isAuthenticated = true;
    authState.token = 'tok';
    authState.user = {
      user_id: 'user-1',
      email: 'secret@example.com',
      public_display_name: 'Ömer',
    };
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'user-1',
        displayName: 'Ömer',
        total: 1,
        items: [
          {
            ...sampleItem,
            visibility: 'unlisted',
            safetyStatus: 'open',
            isPublicListable: false,
          },
        ],
      },
    });

    render(<AuthorPublishedYansiProfile userId="user-1" />);

    expect(await screen.findByTestId('bilign-profile-edit-trigger')).toHaveTextContent(
      'Profili düzenle'
    );
    expect(screen.getByTestId('bilign-profile-honorific')).toHaveTextContent('Meraklı');
    expect(screen.queryByText('Free')).toBeNull();
    expect(screen.getByText('Şehir ışıkları')).toBeTruthy();
    expect(screen.getByText(/Akşam yürüyüşünde/)).toBeTruthy();
    expect(screen.getByTestId('profile-visibility-chip-yansi-a')).toHaveTextContent(
      'Bağlantıyla'
    );
    expect(screen.queryByText('secret@example.com')).toBeNull();

    fireEvent.click(screen.getByTestId('profile-overflow-yansi-a'));
    expect(screen.getByTestId('profile-overflow-menu-yansi-a')).toBeTruthy();
    expect(screen.getByText('Yayından kaldır')).toBeTruthy();
  });

  it('public empty state does not reveal private inventory', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: { userId: 'user-1', displayName: 'Ada', total: 0, items: [] },
    });
    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(await screen.findByTestId('bilign-profile-empty')).toHaveTextContent(
      /herkese açık Yansı yok/i
    );
    expect(screen.queryByText(/private/i)).toBeNull();
    expect(screen.queryByText(/gizli/i)).toBeNull();
  });

  it('owner empty state guides first Yansı', async () => {
    authState.isAuthenticated = true;
    authState.user = { user_id: 'user-1', email: 'a@b.com' };
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({
      ok: true,
      data: { userId: 'user-1', displayName: 'Ada', total: 0, items: [] },
    });
    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(await screen.findByTestId('bilign-profile-empty')).toHaveTextContent(
      /ilk Yansını/
    );
  });

  it('edit sheet only has display name and uses Phase 8.5A endpoint', async () => {
    authState.isAuthenticated = true;
    authState.token = 'tok';
    authState.user = { user_id: 'user-1', email: 'a@b.com', public_display_name: 'Ada' };
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({
      ok: true,
      data: { userId: 'user-1', displayName: 'Ada', total: 0, items: [] },
    });
    vi.mocked(patchPublicIdentity).mockResolvedValue({
      ok: true,
      public_display_name: 'Yeni Ad',
      resolved_public_display_name: 'Yeni Ad',
    });

    render(<AuthorPublishedYansiProfile userId="user-1" />);
    fireEvent.click(await screen.findByTestId('bilign-profile-edit-trigger'));
    expect(screen.getByTestId('bilign-profile-edit-sheet')).toBeTruthy();
    expect(screen.getByLabelText('Görünen ad')).toBeTruthy();
    expect(screen.queryByText(/bio/i)).toBeNull();
    expect(screen.queryByText(/ilgi/i)).toBeNull();
    expect(screen.queryByText(/avatar yükle/i)).toBeNull();

    fireEvent.change(screen.getByTestId('bilign-profile-edit-input'), {
      target: { value: 'Yeni Ad' },
    });
    fireEvent.click(screen.getByTestId('bilign-profile-edit-save'));
    await waitFor(() => {
      expect(patchPublicIdentity).toHaveBeenCalledWith('Yeni Ad');
    });
  });

  it('load-more when total > loaded', async () => {
    vi.mocked(fetchAuthorPublishedYansilar)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 30,
          items: [sampleItem],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          userId: 'user-1',
          displayName: 'Ada',
          total: 30,
          items: [{ ...sampleItem, slug: 'yansi-b', publicTitle: 'İkinci' }],
        },
      });

    render(<AuthorPublishedYansiProfile userId="user-1" />);
    expect(await screen.findByTestId('bilign-profile-load-more')).toBeTruthy();
    fireEvent.click(screen.getByTestId('bilign-profile-load-more'));
    await waitFor(() => {
      expect(fetchAuthorPublishedYansilar).toHaveBeenCalledTimes(2);
    });
    expect(fetchAuthorPublishedYansilar).toHaveBeenLastCalledWith('user-1', {
      limit: 24,
      offset: 1,
    });
  });

  it('mobile layout classes avoid image-only grid; profile CSS present', () => {
    const css = readFileSync(join(process.cwd(), 'styles/saina-mirror.css'), 'utf8');
    expect(css).toContain('.bilign-profile-grid');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('max-width: 52.5rem');
    const card = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/ProfileYansiCard.tsx'),
      'utf8'
    );
    expect(card).toContain('MirrorPublicCard');
    expect(card).toContain('summary');
    expect(card).not.toContain('yansi-public-metrics');
    expect(card).toContain('/m/');
    expect(card).not.toContain('/sohbet');
  });

  it('frozen phase contracts untouched in profile sources', () => {
    const profile = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AuthorPublishedYansiProfile.tsx'),
      'utf8'
    );
    expect(profile).toContain('isAuthReady');
    expect(profile).not.toContain('follower');
    expect(profile).not.toContain('curiosity');
    expect(profile).not.toContain('bio');
    expect(profile).toContain('Profili düzenle');
  });
});
