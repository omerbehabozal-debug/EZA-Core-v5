import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { usePlan } from '@/lib/eza/plan/usePlan';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/standalone/discover',
}));

vi.mock('@/lib/eza/mirror-network/discoverExperiencedMirrors', () => ({
  fetchDiscoverMirrorsForViewer: vi.fn(async () => ({
    ok: true,
    items: [],
    allExperienced: false,
  })),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
    isAuthReady: true,
    setAuth: vi.fn(),
  })),
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: vi.fn(() => true),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: vi.fn(() => ({
    isPlus: false,
    isLoading: false,
    source: 'anonymous',
    refreshPlan: vi.fn(),
  })),
}));

vi.mock('@/components/plan/UpgradeModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="upgrade-modal-stub">upgrade</div> : null,
}));

vi.mock('@/components/plan/IdentityModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="identity-modal-stub">identity</div> : null,
}));

describe('SainaDiscoverPage chrome actions', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    localStorage.clear();
    useSainaChromeStore.getState().setChrome({
      onOpenPattern: undefined,
      onUpgrade: undefined,
      onRequestLogin: undefined,
      conversations: [],
    });
  });

  it('registers discover-local sidebar handlers in chrome store', async () => {
    render(<SainaDiscoverPage />);

    const chrome = useSainaChromeStore.getState();
    expect(chrome.activeSection).toBe('discover');
    expect(chrome.onOpenPattern).toBeTypeOf('function');
    expect(chrome.onUpgrade).toBeTypeOf('function');

    chrome.onOpenPattern?.();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('gates pattern navigation for non-premium users on discover', async () => {
    render(<SainaDiscoverPage />);
    useSainaChromeStore.getState().onOpenPattern?.();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens identity modal from discover when guest taps login footer', async () => {
    render(<SainaDiscoverPage />);

    useSainaChromeStore.getState().onRequestLogin?.();
    expect(await screen.findByTestId('identity-modal-stub')).toBeInTheDocument();
  });

  it('opens upgrade modal from discover when free user taps premium footer', async () => {
    vi.mocked(usePlan).mockReturnValue({
      isPlus: false,
      isLoading: false,
      source: 'server',
      refreshPlan: vi.fn(),
    } as ReturnType<typeof usePlan>);

    render(<SainaDiscoverPage />);

    useSainaChromeStore.getState().onUpgrade?.();
    expect(await screen.findByTestId('upgrade-modal-stub')).toBeInTheDocument();
  });

  it('renders unified top bar with search and profile on discover', async () => {
    render(<SainaDiscoverPage />);

    expect(screen.getByTestId('saina-top-search-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('saina-profile-menu-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('saina-notifications-trigger')).toBeInTheDocument();
  });
});
