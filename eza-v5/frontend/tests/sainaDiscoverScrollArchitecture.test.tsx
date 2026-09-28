import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverPage from '@/components/saina/SainaDiscoverPage';
import { fetchDiscoverPageForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import { discoverPrefetchObserverOptions } from '@/lib/eza/mirror-network/discoverFeed';

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

function pageResult(slugs: string[]) {
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
    totalAvailable: 72,
    allExperienced: false,
    mode: 'random' as const,
    randomSession: 'session-stable-aa',
    strongCuriosityReady: false,
    offset: 0,
    nextOffset: 24,
    hasMore: true,
  };
}

function readFrontend(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const brace = css.indexOf('{', start);
  const end = css.indexOf('\n}', brace);
  expect(end).toBeGreaterThan(brace);
  return css.slice(brace + 1, end);
}

describe('Discover fixed header + list scroll owner', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockReplace.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/standalone/discover');
  });

  it('keeps Discover page as a column with a stationary control region', () => {
    const css = readFrontend('styles/saina-mirror.css');
    const page = cssRule(css, '.saina-discover-page');
    const controls = cssRule(css, '.saina-discover-controls');
    const listScroll = cssRule(css, '.saina-discover-list-scroll');
    const contentScroll = cssRule(css, '.saina-discover-content-scroll');
    const list = cssRule(css, '.saina-discover-list');

    expect(page).toContain('display: flex');
    expect(page).toContain('flex-direction: column');
    expect(page).toContain('min-height: 0');
    expect(controls).toContain('flex: 0 0 auto');
    expect(listScroll).toContain('flex: 1 1 auto');
    expect(listScroll).toContain('min-height: 0');
    expect(listScroll).toContain('overflow-y: auto');
    expect(listScroll).toContain('overflow-x: hidden');
    expect(contentScroll).toContain('overflow: hidden');
    expect(contentScroll).not.toContain('overflow-y: auto');
    expect(list).not.toContain('overflow-y: auto');
    expect(css).not.toMatch(/\.saina-discover-controls[\s\S]{0,180}position:\s*fixed/);
    expect(css).not.toMatch(/\.saina-discover-hero[\s\S]{0,180}position:\s*fixed/);
  });

  it('places the header and filters outside the scrolling list', async () => {
    fetchMock.mockResolvedValue(pageResult(['scroll-one', 'scroll-two']));
    render(<SainaDiscoverPage />);
    await waitFor(() => {
      expect(screen.getByText('scroll-one')).toBeInTheDocument();
    });

    const controls = screen.getByTestId('saina-discover-controls');
    const listScroll = screen.getByTestId('saina-discover-list-scroll');
    const list = screen.getByTestId('saina-discover-list');
    const sentinel = screen.getByTestId('saina-discover-prefetch-sentinel');
    const filters = screen.getByTestId('saina-discover-mode-selector');
    const hero = screen.getByTestId('saina-discover-hero');

    expect(controls).toContainElement(hero);
    expect(controls).toContainElement(filters);
    expect(listScroll).toContainElement(list);
    expect(list).toContainElement(sentinel);
    expect(listScroll).not.toContainElement(controls);
    expect(listScroll).not.toContainElement(hero);
    expect(listScroll).not.toContainElement(filters);
    expect(controls).not.toContainElement(list);
    expect(controls).not.toContainElement(sentinel);
  });

  it('keeps IntersectionObserver rooted on the list scroller, not the document', () => {
    const page = readFrontend('components/saina/SainaDiscoverPage.tsx');
    expect(page).toContain('className="saina-discover-list-scroll"');
    expect(page).toContain('ref={scrollRootRef}');
    expect(page).toContain('discoverPrefetchObserverOptions(root)');
    expect(page).not.toMatch(
      /saina-discover-content-scroll"[^>]*ref=\{scrollRootRef\}/
    );

    const root = { nodeName: 'DIV' } as unknown as Element;
    const options = discoverPrefetchObserverOptions(root);
    expect(options.root).toBe(root);
    expect(options.rootMargin).toBe('0px 0px 8000px 0px');
  });

  it('does not change Ayna reel/card scroll ownership', () => {
    const aynaSlide = readFrontend('components/mirror/ayna/AynaJourneySlide.tsx');
    const aynaReel = readFrontend('components/mirror/ayna/AynaJourneyReel.tsx');
    expect(aynaSlide).not.toContain('saina-discover-list-scroll');
    expect(aynaSlide).not.toContain('saina-discover-controls');
    expect(aynaReel).not.toContain('saina-discover-list-scroll');
    expect(aynaReel).not.toContain('saina-discover-card--editorial');
  });
});
