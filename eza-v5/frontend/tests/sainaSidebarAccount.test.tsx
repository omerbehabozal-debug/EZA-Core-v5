import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SainaProfileMenu from '@/components/saina/SainaProfileMenu';
import SainaPageTopBar from '@/components/saina/SainaPageTopBar';
import SainaMobileYansiHeader from '@/components/saina/SainaMobileYansiHeader';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';

const account = vi.hoisted(() => ({ isAuthenticated: true, isAuthReady: true, token: 'token',
  user: { user_id: 'owner', email: 'owner@example.com', public_display_name: 'Ada', public_avatar_url: '/real-avatar.png', public_avatar_revision: 2 },
  logout: vi.fn(), setAuth: vi.fn(), patchAuthUser: vi.fn() }));
const plan = vi.hoisted(() => ({ isPlus: true, isLoading: false, source: 'server', tier: 'premium' }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => account }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/standalone/sayfam', useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/lib/eza/plan/usePlan', () => ({ usePlan: () => plan }));
vi.mock('@/lib/eza/plan/useAccountEntitlements', () => ({ useAccountEntitlements: () => ({ entitlements: { tier: plan.tier } }) }));
vi.mock('@/hooks/useSainaAuthReturnUrl', () => ({ useSainaAuthReturnUrl: () => '/standalone/sayfam' }));

const settings = { safeOnlyMode: false, analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
  onSafeOnlyModeChange: vi.fn(), onAnalysisModelChange: vi.fn() };

function AccountScene({ onDetailOpen, onReturnToMenu }: { onDetailOpen?: () => void; onReturnToMenu?: () => void }) {
  return <div className="saina-shell"><aside>
    <SainaProfileMenu {...settings} onDetailOpen={onDetailOpen} onReturnToMenu={onReturnToMenu} />
  </aside><main className="saina-main-col"><div data-testid="retained-screen"><textarea aria-label="Sohbet taslağı" defaultValue="Korunan soru" /></div></main></div>;
}

beforeEach(() => {
  vi.clearAllMocks(); account.isAuthenticated = true;
  Object.assign(plan, { isPlus: true, isLoading: false, source: 'server', tier: 'premium' });
  useSainaChromeStore.getState().setChrome({ notifications: [], ...settings });
});

describe('sidebar account entry and a single operation surface', () => {
  it.each(['free', 'mini', 'standard', 'premium'])('shows the real %s plan in the identity entry', (tier) => {
    plan.tier = tier; plan.isPlus = tier === 'premium';
    render(<AccountScene />);
    expect(screen.getByTestId('saina-profile-menu-trigger')).toHaveTextContent(`biligN ${tier[0].toUpperCase() + tier.slice(1)}`);
  });
  it('removes top account triggers and keeps mobile menu navigation', () => {
    const menu = vi.fn();
    const view = render(<><SainaPageTopBar /><SainaMobileYansiHeader displayName="Ada" onOpenMenu={menu} /></>);
    expect(screen.queryByTestId('saina-profile-menu-trigger')).toBeNull();
    expect(screen.queryByTestId('saina-mobile-profile-trigger')).toBeNull();
    fireEvent.click(screen.getByTestId('saina-mobile-menu-btn')); expect(menu).toHaveBeenCalledOnce();
    expect(view.container.querySelector('.saina-status-dot')).toBeNull();
  });

  it('puts the real identity and plan below EZA and outside the chat scroll', () => {
    render(<SainaConversationSidebar conversations={[]} accountSettings={settings} />);
    const trigger = screen.getByTestId('saina-profile-menu-trigger');
    expect(trigger.closest('.saina-sidebar-dock')).toHaveTextContent('EZA');
    expect(trigger.closest('.saina-conv-list')).toBeNull();
    expect(trigger).toHaveTextContent('Ada'); expect(trigger).toHaveTextContent('biligN Premium');
    expect(trigger.querySelector('img')?.src).toContain('real-avatar.png');
    expect(screen.queryByTestId('saina-plan-card')).toBeNull();
  });

  it('replaces menu with one modal inside the main content, then returns to menu', () => {
    const { container } = render(<AccountScene />);
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    expect(screen.getByTestId('saina-profile-menu')).toHaveAttribute('data-section', 'menu');
    const compactMenu = screen.getByTestId('saina-profile-menu');
    expect(within(compactMenu).queryByTestId('saina-profile-menu-identity')).toBeNull();
    expect(within(compactMenu).queryByTestId('saina-account-email')).toBeNull();
    expect(within(compactMenu).queryByTestId('saina-profile-plan-summary')).toBeNull();
    expect(within(compactMenu).getAllByRole('button')).toHaveLength(6);
    expect(screen.queryByTestId('saina-account-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('saina-profile-nav-settings'));
    expect(screen.getAllByTestId('saina-profile-menu')).toHaveLength(1);
    expect(screen.queryByTestId('saina-profile-nav-settings')).toBeNull();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(container.querySelector('.saina-main-col')).toContainElement(screen.getByTestId('saina-account-overlay'));
    fireEvent.click(screen.getByTestId('saina-profile-back'));
    expect(screen.queryByTestId('saina-account-overlay')).toBeNull();
    expect(screen.getByTestId('saina-profile-menu')).toHaveAttribute('data-section', 'menu');
  });

  it('retains the mounted screen, draft and scroll; restores inert and scroll lock', () => {
    const { unmount } = render(<AccountScene />);
    const scene = screen.getByTestId('retained-screen'); scene.scrollTop = 73;
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-profile'));
    expect(screen.getByTestId('retained-screen')).toBe(scene);
    expect(scene.scrollTop).toBe(73); expect(scene).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByTestId('saina-profile-close'));
    expect(scene).not.toHaveAttribute('inert'); expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.getByLabelText('Sohbet taslağı')).toHaveValue('Korunan soru');
    unmount(); expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('preserves unsaved profile edits across Back and protects outside dismissal', () => {
    render(<AccountScene />);
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-profile'));
    fireEvent.change(screen.getByTestId('saina-public-name-input'), { target: { value: 'Draft identity' } });
    fireEvent.click(screen.getByTestId('saina-profile-back'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-profile'));
    expect(screen.getByTestId('saina-public-name-input')).toHaveValue('Draft identity');
    fireEvent.mouseDown(document.querySelector('.saina-account-backdrop')!);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getAllByTestId('saina-profile-menu')).toHaveLength(1);
    fireEvent.click(screen.getByText('Düzenlemeye devam et'));
    expect(screen.getByTestId('saina-public-name-input')).toHaveValue('Draft identity');
    fireEvent.click(screen.getByTestId('saina-profile-close')); fireEvent.click(screen.getByTestId('saina-profile-discard'));
    expect(screen.queryByTestId('saina-profile-menu')).toBeNull();
  });

  it('keeps notifications, setting callbacks and logout with no extra panel', () => {
    useSainaChromeStore.getState().setChrome({ notifications: [{ id: 'actual', title: 'Gerçek bildirim', body: 'Mevcut veri' }] });
    render(<AccountScene />); fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-notifications')); expect(screen.getByText('Gerçek bildirim')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('saina-profile-back')); fireEvent.click(screen.getByTestId('saina-profile-nav-settings'));
    fireEvent.click(screen.getByTestId('saina-safe-mode-switch')); expect(settings.onSafeOnlyModeChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('saina-profile-back')); fireEvent.click(screen.getByTestId('saina-profile-logout'));
    expect(account.logout).toHaveBeenCalledOnce(); expect(screen.queryByTestId('saina-account-overlay')).toBeNull();
  });

  it('closes the mobile drawer on detail and reopens it on Back', () => {
    const closeDrawer = vi.fn(), openDrawer = vi.fn();
    render(<SainaConversationSidebar conversations={[]} accountSettings={settings} mobileOpen onMobileClose={closeDrawer} onMobileOpen={openDrawer} />);
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-settings')); expect(closeDrawer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId('saina-profile-back')); expect(openDrawer).toHaveBeenCalledOnce();
    expect(screen.getAllByTestId('saina-profile-menu')).toHaveLength(1);
  });

  it('never leaves the real mobile drawer open beside a detail surface', () => {
    function MobileScene() {
      const [mobileOpen, setMobileOpen] = useState(true);
      return <div className="saina-shell"><SainaConversationSidebar conversations={[]} accountSettings={settings}
        mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} onMobileOpen={() => setMobileOpen(true)} />
        <main className="saina-main-col"><div>Deneyim korunuyor</div></main></div>;
    }
    render(<MobileScene />);
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-profile'));
    expect(screen.queryByRole('button', { name: 'Menüyü kapat' })).toBeNull();
    fireEvent.change(screen.getByTestId('saina-public-name-input'), { target: { value: 'Korunan ad' } });
    fireEvent.click(screen.getByTestId('saina-profile-back'));
    const backdrop = screen.getByRole('button', { name: 'Menüyü kapat' });
    fireEvent.mouseDown(backdrop); fireEvent.click(backdrop);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menüyü kapat' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Düzenlemeye devam et'));
    fireEvent.click(screen.getByTestId('saina-profile-nav-profile'));
    expect(screen.getByTestId('saina-public-name-input')).toHaveValue('Korunan ad');
  });

  it('traps Tab and restores focus after Escape', async () => {
    render(<AccountScene />); const trigger = screen.getByTestId('saina-profile-menu-trigger'); trigger.focus(); fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('saina-profile-nav-settings'));
    const controls = within(screen.getByRole('dialog')).getAllByRole('button').filter((button) => !(button as HTMLButtonElement).disabled);
    const last = controls[controls.length - 1]; last.focus(); fireEvent.keyDown(last, { key: 'Tab' });
    expect(controls[0]).toHaveFocus();
    fireEvent.keyDown(controls[0], { key: 'Escape' });
    expect(screen.queryByTestId('saina-account-overlay')).toBeNull(); await waitFor(() => expect(trigger).toHaveFocus());
  });
});
