import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { fetchDiscoverPageForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import {
  SAINA_DISCOVER_MODE_RASTLANTISAL,
  SAINA_DISCOVER_STRONG_CURIOSITY_TITLE,
} from '@/lib/eza/mirror-network/discoverCopy';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
  usePathname: () => '/standalone/discover',
}));

vi.mock('@/lib/eza/mirror-network/discoverExperiencedMirrors', () => ({
  fetchDiscoverPageForViewer: vi.fn(),
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
  default: () => null,
}));

vi.mock('@/components/plan/IdentityModal', () => ({
  default: () => null,
}));

const fetchMock = vi.mocked(fetchDiscoverPageForViewer);

function pageResult(
  mode: 'random' | 'strong_curiosity' | 'newest',
  slugs: string[],
  extras?: Partial<{
    strongCuriosityReady: boolean;
    totalAvailable: number;
    hasMore: boolean;
    offset: number;
  }>
) {
  const offset = extras?.offset ?? 0;
  return {
    ok: true as const,
    items: slugs.map((slug) => ({
      slug,
      title: slug,
      sceneImageUrl: `https://cdn.example/${slug}.png`,
      yansiCount: 0,
      journeyVersion: 1,
      experienceStartedCount: 1,
      directChildYansiCount: 0,
    })),
    rawCount: slugs.length,
    totalAvailable: extras?.totalAvailable ?? slugs.length,
    allExperienced: false,
    mode,
    randomSession: mode === 'random' ? 'session-test-aa' : null,
    strongCuriosityReady: extras?.strongCuriosityReady ?? false,
    offset,
    nextOffset: offset + 24,
    hasMore: extras?.hasMore ?? false,
  };
}

describe('Phase 7.5 Güçlü Merak Discover UI', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockReplace.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/standalone/discover');
    fetchMock.mockResolvedValue(pageResult('random', ['random-one']));
  });

  it('defaults to Rastlantısal', async () => {
    render(<SainaDiscoverPage />);
    await waitFor(() => {
      expect(screen.getByTestId('saina-discover-mode-random')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
    expect(screen.getByTestId('saina-discover-mode-random')).toHaveTextContent(
      SAINA_DISCOVER_MODE_RASTLANTISAL
    );
  });

  it('renders ranked Güçlü Merak cards when ready', async () => {
    fetchMock.mockImplementation(async (options) => {
      if (options?.mode === 'strong_curiosity') {
        return pageResult('strong_curiosity', ['curious-one'], {
          strongCuriosityReady: true,
        });
      }
      return pageResult('random', []);
    });

    render(<SainaDiscoverPage />);
    fireEvent.click(screen.getByTestId('saina-discover-mode-strong_curiosity'));
    await waitFor(() => {
      expect(screen.getByText('curious-one')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('saina-discover-strong-curiosity-pending')).toBeNull();
    expect(screen.queryByText(SAINA_DISCOVER_STRONG_CURIOSITY_TITLE)).toBeNull();
    expect(screen.queryByText('BALANCED_FOUNDATION')).toBeNull();
    expect(screen.queryByText('curiosityScore')).toBeNull();
  });

  it('shows unavailable copy when Güçlü Merak is not ready', async () => {
    fetchMock.mockImplementation(async (options) => {
      if (options?.mode === 'strong_curiosity') {
        return pageResult('strong_curiosity', [], { strongCuriosityReady: false });
      }
      return pageResult('random', []);
    });

    render(<SainaDiscoverPage />);
    fireEvent.click(screen.getByTestId('saina-discover-mode-strong_curiosity'));
    await waitFor(() => {
      expect(screen.getByTestId('saina-discover-strong-curiosity-pending')).toBeInTheDocument();
    });
    expect(screen.getByText(SAINA_DISCOVER_STRONG_CURIOSITY_TITLE)).toBeInTheDocument();
  });
});
