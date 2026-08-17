import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { fetchDiscoverMirrorsForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import { DISCOVER_MODE_LABELS } from '@/lib/eza/mirror-network/discoverModes';
import {
  SAINA_DISCOVER_MODE_NEWEST,
  SAINA_DISCOVER_MODE_RASTLANTISAL,
  SAINA_DISCOVER_MODE_STRONG_CURIOSITY,
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
  fetchDiscoverMirrorsForViewer: vi.fn(),
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

const fetchMock = vi.mocked(fetchDiscoverMirrorsForViewer);

function okResult(
  mode: 'random' | 'strong_curiosity' | 'newest',
  slugs: string[]
) {
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
    totalAvailable: slugs.length,
    allExperienced: false,
    mode,
    randomSession: mode === 'random' ? 'session-test-aa' : null,
    strongCuriosityReady: false,
  };
}

describe('Phase 7.1 Discover mode UI', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockReplace.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/standalone/discover');
    fetchMock.mockResolvedValue(okResult('random', ['random-one']));
  });

  it('defaults the selector to Rastlantısal and uses that copy', async () => {
    render(<SainaDiscoverPage />);
    expect(screen.getByTestId('saina-discover-mode-selector')).toBeInTheDocument();
    expect(screen.getByTestId('saina-discover-mode-random')).toHaveTextContent(
      SAINA_DISCOVER_MODE_RASTLANTISAL
    );
    expect(screen.getByTestId('saina-discover-mode-strong_curiosity')).toHaveTextContent(
      SAINA_DISCOVER_MODE_STRONG_CURIOSITY
    );
    expect(screen.getByTestId('saina-discover-mode-newest')).toHaveTextContent(
      SAINA_DISCOVER_MODE_NEWEST
    );
    expect(DISCOVER_MODE_LABELS.random).toBe('Rastlantısal');
    await waitFor(() => {
      expect(screen.getByTestId('saina-discover-mode-random')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({ mode: 'random' });
  });

  it('refetches the selected mode and does not alias Güçlü Merak', async () => {
    fetchMock.mockImplementation(async (options) => {
      if (options?.mode === 'strong_curiosity') {
        return {
          ok: true as const,
          items: [],
          totalAvailable: 0,
          allExperienced: false,
          mode: 'strong_curiosity',
          randomSession: null,
          strongCuriosityReady: false,
        };
      }
      if (options?.mode === 'newest') {
        return okResult('newest', ['newest-one']);
      }
      return okResult('random', ['random-one']);
    });

    render(<SainaDiscoverPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('saina-discover-mode-strong_curiosity'));
    await waitFor(() => {
      expect(screen.getByTestId('saina-discover-strong-curiosity-pending')).toBeInTheDocument();
    });
    expect(screen.getByText(SAINA_DISCOVER_STRONG_CURIOSITY_TITLE)).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith(
      '/standalone/discover?mode=strong_curiosity',
      { scroll: false }
    );
    const gmCall = fetchMock.mock.calls.find((call) => call[0]?.mode === 'strong_curiosity');
    expect(gmCall).toBeTruthy();
  });

  it('ignores a stale Rastlantısal response after En Yeni is selected', async () => {
    let resolveRandom: ((value: ReturnType<typeof okResult>) => void) | undefined;
    const randomDeferred = new Promise<ReturnType<typeof okResult>>((resolve) => {
      resolveRandom = resolve;
    });

    fetchMock.mockImplementation(async (options) => {
      if (options?.mode === 'newest') {
        return okResult('newest', ['newest-card']);
      }
      return randomDeferred;
    });

    render(<SainaDiscoverPage />);
    fireEvent.click(screen.getByTestId('saina-discover-mode-newest'));

    await waitFor(() => {
      expect(screen.getByText('newest-card')).toBeInTheDocument();
    });

    resolveRandom?.(okResult('random', ['stale-random-card']));
    await Promise.resolve();
    expect(screen.queryByText('stale-random-card')).toBeNull();
    expect(screen.getByText('newest-card')).toBeInTheDocument();
  });
});
