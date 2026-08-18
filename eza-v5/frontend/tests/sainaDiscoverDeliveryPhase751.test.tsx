import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { fetchDiscoverPageForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import {
  DISCOVER_RANDOM_SESSION_STORAGE_KEY,
  getOrCreateDiscoverRandomSession,
} from '@/lib/eza/mirror-network/discoverModes';
import {
  SAINA_DISCOVER_MORE_ERROR,
  SAINA_DISCOVER_MODE_RASTLANTISAL,
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
  extras?: {
    offset?: number;
    totalAvailable?: number;
    hasMore?: boolean;
    strongCuriosityReady?: boolean;
  }
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
    totalAvailable: extras?.totalAvailable ?? 72,
    allExperienced: false,
    mode,
    randomSession: mode === 'random' ? 'session-stable-aa' : null,
    strongCuriosityReady: extras?.strongCuriosityReady ?? mode === 'strong_curiosity',
    offset,
    nextOffset: offset + 24,
    hasMore: extras?.hasMore ?? true,
  };
}

describe('Phase 7.5.1 Discover scroll delivery UI', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockReplace.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/standalone/discover');
  });

  it('defaults to Rastlantısal and prefetches the next page quietly', async () => {
    fetchMock.mockImplementation(async (options) => {
      const offset = options?.offset ?? 0;
      if (offset === 0) {
        return pageResult('random', ['r-one', 'r-two'], { offset: 0, hasMore: true });
      }
      return pageResult('random', ['r-three'], { offset: 24, hasMore: false });
    });

    render(<SainaDiscoverPage />);
    await waitFor(() => {
      expect(screen.getByText('r-one')).toBeInTheDocument();
    });
    expect(screen.getByTestId('saina-discover-mode-random')).toHaveTextContent(
      SAINA_DISCOVER_MODE_RASTLANTISAL
    );
    await waitFor(() => {
      expect(screen.getByText('r-three')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('saina-discover-list-loading')).toBeNull();
    expect(fetchMock.mock.calls.some((call) => call[0]?.offset === 24)).toBe(true);
    expect(fetchMock.mock.calls.every((call) => call[0]?.mode === 'random')).toBe(true);
    expect(sessionStorage.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY)).toBe(
      getOrCreateDiscoverRandomSession()
    );
  });

  it('keeps loaded cards when the next page fails and allows retry', async () => {
    window.history.replaceState({}, '', '/standalone/discover?mode=newest');
    fetchMock.mockImplementation(async (options) => {
      const offset = options?.offset ?? 0;
      if (offset === 0) {
        return pageResult('newest', ['n-one'], {
          offset: 0,
          hasMore: true,
          totalAvailable: 48,
        });
      }
      return { ok: false as const, status: 500 };
    });

    render(<SainaDiscoverPage />);
    await waitFor(() => {
      expect(screen.getByText('n-one')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('saina-discover-more-error')).toBeInTheDocument();
    });
    expect(screen.getByText(SAINA_DISCOVER_MORE_ERROR)).toBeInTheDocument();
    expect(screen.getByText('n-one')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-discover-list-loading')).toBeNull();
  });

  it('dedupes fast next-page requests until the in-flight page resolves', async () => {
    let resolveSecond: ((value: ReturnType<typeof pageResult>) => void) | undefined;
    const secondPage = new Promise<ReturnType<typeof pageResult>>((resolve) => {
      resolveSecond = resolve;
    });
    fetchMock.mockImplementation(async (options) => {
      const offset = options?.offset ?? 0;
      if ((options?.mode ?? 'random') !== 'random') {
        return pageResult('newest', ['n-one'], { hasMore: false, totalAvailable: 1 });
      }
      if (offset === 0) {
        return pageResult('random', ['fast-one'], { offset: 0, hasMore: true });
      }
      return secondPage;
    });

    render(<SainaDiscoverPage />);
    await waitFor(() => expect(screen.getByText('fast-one')).toBeInTheDocument());
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter((call) => call[0]?.offset === 24)).toHaveLength(1);
    });
    fireEvent.click(screen.getByTestId('saina-discover-prefetch-sentinel'));
    fireEvent.click(screen.getByTestId('saina-discover-prefetch-sentinel'));
    expect(fetchMock.mock.calls.filter((call) => call[0]?.offset === 24)).toHaveLength(1);
    await act(async () => {
      resolveSecond?.(
        pageResult('random', ['fast-two'], { offset: 24, hasMore: false, totalAvailable: 48 })
      );
      await secondPage;
    });
    await waitFor(() => expect(screen.getByText('fast-two')).toBeInTheDocument());
  });

  it('ignores a late pagination response after a mode switch', async () => {
    let resolveRandomMore: ((value: ReturnType<typeof pageResult>) => void) | undefined;
    const randomMore = new Promise<ReturnType<typeof pageResult>>((resolve) => {
      resolveRandomMore = resolve;
    });
    fetchMock.mockImplementation(async (options) => {
      if (options?.mode === 'newest') {
        return pageResult('newest', ['newest-live'], {
          hasMore: false,
          totalAvailable: 1,
          strongCuriosityReady: false,
        });
      }
      if ((options?.offset ?? 0) === 0) {
        return pageResult('random', ['random-live'], { offset: 0, hasMore: true });
      }
      return randomMore;
    });

    render(<SainaDiscoverPage />);
    await waitFor(() => expect(screen.getByText('random-live')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('saina-discover-mode-newest'));
    await waitFor(() => expect(screen.getByText('newest-live')).toBeInTheDocument());
    await act(async () => {
      resolveRandomMore?.(
        pageResult('random', ['stale-page-two'], { offset: 24, hasMore: false })
      );
      await randomMore;
    });
    expect(screen.queryByText('stale-page-two')).toBeNull();
    expect(screen.getByText('newest-live')).toBeInTheDocument();
  });
});
