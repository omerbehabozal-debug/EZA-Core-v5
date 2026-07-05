import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock('@/lib/eza/mirror-network/discoverExperiencedMirrors', () => ({
  fetchDiscoverMirrorsForViewer: vi.fn(async () => ({
    ok: true,
    items: [],
    allExperienced: false,
  })),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: () => ({
    isPlus: false,
    isLoading: false,
    source: 'anonymous',
    refreshPlan: vi.fn(),
  }),
}));

vi.mock('@/components/plan/UpgradeModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="upgrade-modal-stub">upgrade</div> : null,
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

  it('opens upgrade modal from discover when free user taps premium footer', async () => {
    useSainaChromeStore.getState().setChrome({
      planTier: 'free',
    });

    render(<SainaDiscoverPage />);

    useSainaChromeStore.getState().onUpgrade?.();
    expect(await screen.findByTestId('upgrade-modal-stub')).toBeInTheDocument();
  });
});
