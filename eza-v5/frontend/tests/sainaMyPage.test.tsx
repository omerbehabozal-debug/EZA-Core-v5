import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SainaMyPageContent from '@/components/saina/SainaMyPageContent';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import { clearYansiSaveStore, isYansiSavedInStore } from '@/lib/eza/mirror-network/yansiSaveStore';
import { resolveSainaAppView, SAINA_MY_PAGE_ROUTE } from '@/lib/eza/sainaRoutes';
import { fetchOwnerProfileYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { fetchMySavedYansilar, fetchYansiSaveState, saveYansi, unsaveYansi } from '@/lib/eza/mirror-network/yansiSaveApi';

const state = vi.hoisted(() => ({ auth: { isAuthenticated: true, isAuthReady: true,
  user: { user_id: 'owner', public_display_name: 'Ada' } as { user_id: string; public_display_name: string } | null }, push: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), usePathname: () => SAINA_MY_PAGE_ROUTE }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/mirror-landing/YansiExposureRoot', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async (original) => ({
  ...await original<typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')>(), fetchOwnerProfileYansilar: vi.fn() }));
vi.mock('@/lib/eza/mirror-network/yansiSaveApi', () => ({ fetchMySavedYansilar: vi.fn(), fetchYansiSaveState: vi.fn(), saveYansi: vi.fn(), unsaveYansi: vi.fn() }));

const publication = { slug: 'mine', shareUrl: '/m/mine', publicTitle: 'My published Yansı',
  publishedAt: '2026-10-01', visibility: 'public', safetyStatus: 'open', journeyVersion: 2 };
const savedItem = { slug: 'other', savedAt: '2026-10-02', availability: 'available' as const,
  publicTitle: 'Other author Yansı', authorUserId: 'other-author', authorDisplayName: 'Original author', journeyVersion: 3 };

beforeEach(() => {
  vi.clearAllMocks(); clearYansiSaveStore();
  state.auth.isAuthenticated = true; state.auth.user = { user_id: 'owner', public_display_name: 'Ada' };
  vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({ ok: true, data: { userId: 'owner', displayName: 'Ada', total: 1, items: [publication] } });
  vi.mocked(fetchMySavedYansilar).mockResolvedValue({ ok: true, data: { items: [savedItem], total: 1, limit: 48, offset: 0 } });
  vi.mocked(fetchYansiSaveState).mockImplementation(async (slug) => ({ ok: true, slug, saved: slug === 'other' }));
  vi.mocked(saveYansi).mockImplementation(async (slug) => ({ ok: true, slug, saved: true, status: 'saved' }));
  vi.mocked(unsaveYansi).mockImplementation(async (slug) => ({ ok: true, slug, saved: false, status: 'removed' }));
});

describe('Sayfam and existing account collections', () => {
  it('keeps navigation order, mobile dismiss, active page and EZA below history', () => {
    const close = vi.fn();
    const { container } = render(<SainaConversationSidebar conversations={[]} activeSection="my-page" onNewChat={vi.fn()} onMobileClose={close} />);
    const nav = container.querySelector('.saina-sidebar-primary-nav')!;
    expect(within(nav as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual(['Keşfet', 'Sayfam', 'Yeni sohbet']);
    expect(screen.getByTestId('saina-my-page-nav')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByTestId('saina-my-page-nav'));
    expect(state.push).toHaveBeenCalledWith(SAINA_MY_PAGE_ROUTE); expect(close).toHaveBeenCalled();
    expect(container.querySelector('.saina-sidebar-dock')).toHaveTextContent('EZA');
    expect(screen.queryByTestId('saina-meraklarim-section')).toBeNull();
    expect(resolveSainaAppView(SAINA_MY_PAGE_ROUTE)).toBe('my-page');
  });

  it('shows only active published owner content and pins the existing Reel route', async () => {
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({ ok: true, data: { userId: 'owner', displayName: 'Ada', total: 4, items: [publication,
      { ...publication, slug: 'draft', publicTitle: 'Draft', publishedAt: null },
      { ...publication, slug: 'private', publicTitle: 'Private', visibility: 'private' },
      { ...publication, slug: 'restricted', publicTitle: 'Restricted', safetyStatus: 'restricted' }] } });
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    await screen.findByText('My published Yansı');
    expect(screen.queryByText('Draft')).toBeNull(); expect(screen.queryByText('Private')).toBeNull(); expect(screen.queryByText('Restricted')).toBeNull();
    fireEvent.click(screen.getByTestId('saina-discover-card-cta-mine'));
    expect(state.push.mock.calls[0][0]).toContain('/m/mine'); expect(state.push.mock.calls[0][0]).toContain('2');
    expect(screen.queryByTestId('saina-save-mine')).toBeNull();
  });

  it('keeps original saved author and hides unavailable content while allowing removal', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({ ok: true, data: { items: [savedItem,
      { slug: 'gone', savedAt: 'now', availability: 'unavailable', publicTitle: 'Must not leak', sceneImageUrl: '/private.jpg' }], total: 2, limit: 48, offset: 0 } });
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Kaydettiklerim' }));
    await screen.findByText('Other author Yansı');
    expect(screen.getByText('Original author')).toBeInTheDocument(); expect(screen.queryByText('Must not leak')).toBeNull();
    expect(screen.getByTestId('my-page-unavailable').querySelector('img')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('saina-save-gone')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('saina-save-gone'));
    await waitFor(() => expect(unsaveYansi).toHaveBeenCalledWith('gone'));
  });

  it('preserves collection save and remove through the existing APIs and shared flag', async () => {
    render(<SainaDiscoverCard showSave item={{ slug: 'new', title: 'New Yansı', sceneImageUrl: null, yansiCount: 0 }} />);
    const button = screen.getByTestId('saina-save-new'); await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button); await screen.findByText('Meraklarına kaydedildi.');
    expect(isYansiSavedInStore('new')).toBe(true); expect(state.push).not.toHaveBeenCalled();
    fireEvent.click(button); await screen.findByText('Meraklarından çıkarıldı.');
    expect(isYansiSavedInStore('new')).toBe(false); expect(saveYansi).toHaveBeenCalledTimes(1); expect(unsaveYansi).toHaveBeenCalledTimes(1);
  });

  it('keeps Discover open navigation version-pinned without save UI or save-state requests', async () => {
    vi.mocked(fetchYansiSaveState).mockResolvedValue({ ok: false, code: 'network_error' } as any);
    render(<SainaDiscoverCard item={{ slug: 'discover-only', title: 'Discover Yansı', sceneImageUrl: null, yansiCount: 0, journeyVersion: 3 }} />);
    expect(screen.queryByRole('button', { name: /Meraklarıma kaydet/ })).toBeNull();
    expect(screen.queryByText('Kayıt durumu alınamadı.')).toBeNull();
    expect(fetchYansiSaveState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('saina-discover-card-cta-discover-only'));
    expect(state.push).toHaveBeenCalledWith('/m/discover-only?journeyVersion=3');
  });

  it('uses the real profile name as the main heading without a repeated Sayfam title', async () => {
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ada' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sayfam' })).toBeNull();
    await screen.findByText('My published Yansı');
  });

  it('separates saved empty state from errors and keeps its existing Discover link', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({ ok: true, data: { items: [], total: 0, limit: 48, offset: 0 } });
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Kaydettiklerim' }));
    await screen.findByTestId('my-page-empty-saved');
    expect(screen.getByRole('link', { name: 'Keşfet’e git' })).toHaveAttribute('href', '/standalone/discover');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not invent empty content on API failure and rejects wrong owner inventory', async () => {
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({ ok: true, data: { userId: 'someone-else', displayName: 'Private owner', total: 1, items: [publication] } });
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    await screen.findByRole('alert'); expect(screen.queryByText('My published Yansı')).toBeNull();
    expect(screen.queryByText('Henüz yayımladığın bir Yansı yok.')).toBeNull();
  });

  it('hides previous account content immediately and drops late inventory responses', async () => {
    let resolve!: (value: any) => void;
    vi.mocked(fetchOwnerProfileYansilar).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    state.auth.user = { user_id: 'second', public_display_name: 'Second' };
    vi.mocked(fetchOwnerProfileYansilar).mockResolvedValue({ ok: true, data: { userId: 'second', displayName: 'Second', total: 0, items: [] } });
    view.rerender(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    await act(async () => resolve({ ok: true, data: { userId: 'owner', displayName: 'Ada', total: 1, items: [publication] } }));
    await screen.findByText('Henüz yayımladığın bir Yansı yok.'); expect(screen.queryByText('My published Yansı')).toBeNull();
  });

  it('offers existing login for guests and uses keyboard-accessible collection tabs', () => {
    state.auth.isAuthenticated = false; state.auth.user = null; const login = vi.fn();
    render(<SainaMyPageContent onRequireAuth={login} />);
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' })); expect(login).toHaveBeenCalled();
    const first = screen.getByRole('tab', { name: 'Yansılarım' }); first.focus(); fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Kaydettiklerim' })).toHaveFocus(); expect(fetchMySavedYansilar).not.toHaveBeenCalled();
  });

  it('loads beyond the first owner page before filtering unpublished entries', async () => {
    vi.mocked(fetchOwnerProfileYansilar).mockImplementation(async (options) => ({ ok: true,
      data: { userId: 'owner', displayName: 'Ada', total: 25, items: options?.offset === 0 ?
        Array.from({ length: 24 }, (_, index) => ({ ...publication, slug: `draft-${index}`, publicTitle: `Draft ${index}`, publishedAt: null })) : [publication] } }));
    render(<SainaMyPageContent onRequireAuth={vi.fn()} />);
    await screen.findByText('My published Yansı'); expect(screen.queryByText('Draft 0')).toBeNull();
    expect(fetchOwnerProfileYansilar).toHaveBeenCalledTimes(2);
    expect(fetchOwnerProfileYansilar).toHaveBeenLastCalledWith({ limit: 24, offset: 24 });
  });

  it('does not apply a late save response after account switch or unmount', async () => {
    let finish!: (value: any) => void;
    vi.mocked(saveYansi).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const view = render(<SainaDiscoverCard showSave item={{ slug: 'late', title: 'Late', sceneImageUrl: null, yansiCount: 0 }} />);
    await waitFor(() => expect(screen.getByTestId('saina-save-late')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('saina-save-late'));
    view.unmount();
    state.auth.user = { user_id: 'second', public_display_name: 'Second' };
    await act(async () => finish({ ok: true, slug: 'late', saved: true, status: 'saved' }));
    expect(isYansiSavedInStore('late')).toBe(false);
  });
});
