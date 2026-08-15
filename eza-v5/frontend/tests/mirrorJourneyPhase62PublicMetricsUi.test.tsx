/**
 * Phase 6.2 — quiet public metrics row. Does not change replay semantics.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer')
  >('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer');
  return {
    ...actual,
    fetchPublicFrozenJourneyArtifact: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchPublishedChildren: vi.fn(),
    fetchAuthorPublishedYansilar: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/yansiPublicMetrics', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/yansiPublicMetrics')
  >('@/lib/eza/mirror-network/yansiPublicMetrics');
  return {
    ...actual,
    fetchYansiPublicMetrics: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchMirrorImpact', () => ({
  fetchMirrorImpact: vi.fn(),
  isMirrorImpactStats: () => false,
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  fetchPublishedChildren,
  fetchAuthorPublishedYansilar,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { fetchYansiPublicMetrics } from '@/lib/eza/mirror-network/yansiPublicMetrics';
import { fetchMirrorImpact } from '@/lib/eza/mirror-network/fetchMirrorImpact';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import { formatDiscoverYansiCount } from '@/lib/eza/mirror-network/discoverCopy';

type Observed = {
  cb: IntersectionObserverCallback;
  elements: Set<Element>;
};

const observers: Observed[] = [];

function dto(
  slug: string,
  started: number,
  children: number,
  version = 1
) {
  return {
    slug,
    journeyVersion: version,
    experienceStartedCount: started,
    experienceCompletedCount: 0,
    experienceSkippedSessionCount: 0,
    completionRate: started === 0 ? null : 0,
    skipRate: started === 0 ? null : 0,
    observedAverageDepth: started === 0 ? null : 0,
    directChildYansiCount: children,
  };
}

function makeArtifact(
  slug: string,
  overrides?: { journeyVersion?: number; parentSlug?: string; stepCount?: 6 | 8 }
) {
  const n = overrides?.stepCount ?? 8;
  const steps = Array.from({ length: n }, (_, i) => ({
    stepIndex: i + 1,
    publicQuestion: `${slug} Soru ${i + 1}?`,
    publicAnswer: `${slug} Cevap ${i + 1}.`,
    ezaSnapshot: { assistantScore: 80 + i, userScore: 70 + i, ezaFinal: 80 + i },
  }));
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: overrides?.journeyVersion ?? 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    selectedCount: n,
    steps,
    replayReady: true,
    parentSlug: overrides?.parentSlug,
  })!;
}

function landingSurface(slug = 'yansi-a') {
  return {
    slug,
    cardTitle: 'Demo',
    cardDate: '2026-08-12',
    dayLabel: '12 Ağustos',
    sceneImageUrl: null,
    curiosityContext: 'Özet',
  };
}

beforeEach(() => {
  observers.length = 0;
  clearAllFrozenReplayProgressForTests();
  clearEzaUserPreferencesForTests();
  clearPublicAuthorDisplayCacheForTests();
  localStorage.clear();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchPublishedChildren).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockReset();
  vi.mocked(fetchYansiPublicMetrics).mockReset();
  vi.mocked(fetchMirrorImpact).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
    ok: true,
    data: { userId: 'author-a', displayName: 'Name A', items: [], total: 0 },
  });
  vi.mocked(fetchPublishedChildren).mockResolvedValue({
    ok: true,
    data: { parentSlug: 'yansi-a', items: [], total: 0 },
  });
  class IO {
    elements = new Set<Element>();
    cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      observers.push(this);
    }
    observe(el: Element) {
      this.elements.add(el);
    }
    unobserve(el: Element) {
      this.elements.delete(el);
    }
    disconnect() {
      this.elements.clear();
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Phase 6.2 public metrics UI', () => {
  it('landing: 140 deneyim · 7 Yansı from /metrics, never legacy impact/discover', async () => {
    const artifact = makeArtifact('yansi-a');
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(artifact);
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('yansi-a', 140, 7),
    });
    vi.mocked(fetchMirrorImpact).mockResolvedValue({
      ok: true,
      data: {
        mirrorId: 'm',
        publicSlug: 'yansi-a',
        shareUrl: '/m/yansi-a',
        continuationStarts: 9999,
        continuationStartsVerified: true,
        yansiCount: 99,
        landingViews: 9999,
      },
    });

    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('mirror-experience-start')).toBeTruthy();
    expect(await screen.findByTestId('yansi-public-metrics')).toHaveTextContent(
      '140 deneyim · 7 Yansı'
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveAttribute(
      'aria-label',
      '140 deneyim, 7 Yansı'
    );
    expect(screen.queryByText('9999 deneyim')).toBeNull();
    expect(screen.queryByText('99 Yansı')).toBeNull();
    expect(screen.queryByText(formatDiscoverYansiCount(99))).toBeNull();
    expect(fetchMirrorImpact).not.toHaveBeenCalled();
    expect(fetchYansiPublicMetrics).toHaveBeenCalledWith('yansi-a', 1);
  });

  it('hides the row when started=0 and children=0', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('yansi-a', 0, 0),
    });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    await screen.findByTestId('mirror-experience-start');
    await waitFor(() => {
      expect(fetchYansiPublicMetrics).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText('0 deneyim')).toBeNull();
  });

  it('shows 140 deneyim without · 0 Yansı', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('yansi-a', 140, 0),
    });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('yansi-public-metrics')).toHaveTextContent('140 deneyim');
    expect(screen.getByTestId('yansi-public-metrics').textContent).not.toContain('Yansı');
  });

  it('shows 0 deneyim · 3 Yansı when only children exist', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('yansi-a', 0, 3),
    });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('yansi-public-metrics')).toHaveTextContent(
      '0 deneyim · 3 Yansı'
    );
  });

  it('version pin: v1 replay shows v1 started count, not v2', async () => {
    const v1 = makeArtifact('yansi-a', { journeyVersion: 1 });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(v1);
    vi.mocked(fetchYansiPublicMetrics).mockImplementation(async (_slug, version) => {
      if (version === 1) return { ok: true, data: dto('yansi-a', 140, 7, 1) };
      return { ok: true, data: dto('yansi-a', 20, 7, 2) };
    });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('yansi-public-metrics')).toHaveTextContent('140 deneyim');
    expect(screen.queryByText('20 deneyim')).toBeNull();
    expect(fetchYansiPublicMetrics).toHaveBeenCalledWith('yansi-a', 1);
  });

  it('fail-closed on wrong slug / negative / metrics error', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('other-slug', 140, 7),
    });
    const { unmount } = render(<MirrorLandingExperience surface={landingSurface()} />);
    await screen.findByTestId('mirror-experience-start');
    await waitFor(() => expect(fetchYansiPublicMetrics).toHaveBeenCalled());
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    unmount();

    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: { ...dto('yansi-a', 140, 7), experienceStartedCount: -4 },
    });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    await screen.findByTestId('mirror-experience-start');
    await waitFor(() => expect(fetchYansiPublicMetrics).toHaveBeenCalled());
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText('-4 deneyim')).toBeNull();
  });

  it('metrics pending or failed does not block replay CTA / first question', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    let resolveMetrics: (v: unknown) => void = () => undefined;
    vi.mocked(fetchYansiPublicMetrics).mockReturnValue(
      new Promise((resolve) => {
        resolveMetrics = resolve as (v: unknown) => void;
      }) as ReturnType<typeof fetchYansiPublicMetrics>
    );
    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('mirror-experience-start')).toBeTruthy();
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    fireEvent.click(screen.getByTestId('mirror-experience-start'));
    expect(await screen.findByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    resolveMetrics({ ok: false });
  });

  it('error hides metrics; replay remains usable', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-a'));
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({ ok: false });
    render(<MirrorLandingExperience surface={landingSurface()} />);
    expect(await screen.findByTestId('mirror-experience-start')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mirror-experience-start'));
    expect(await screen.findByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-a Soru 1?'
    );
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
  });
});

describe('Phase 6.2 chain isolation', () => {
  it('A and B keep separate metric identities; partial skip still renders B metrics', async () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a', stepCount: 6 });
    vi.mocked(fetchPublishedChildren).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') {
        return {
          ok: true,
          data: {
            parentSlug: 'yansi-a',
            items: [
              {
                slug: 'yansi-b',
                shareUrl: '/m/yansi-b',
                publicTitle: 'Title yansi-b',
                publicSummary: 'Summary yansi-b',
                sceneImageUrl: 'https://cdn.example/yansi-b.jpg',
                publishedAt: '2026-08-01T00:00:00Z',
                parentSlug: 'yansi-a',
              },
            ],
            total: 1,
          },
        };
      }
      return { ok: true, data: { parentSlug: slug, items: [], total: 0 } };
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-a') return a;
      if (slug === 'yansi-b') return b;
      return null;
    });
    vi.mocked(fetchYansiPublicMetrics).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return { ok: true, data: dto('yansi-a', 140, 7) };
      if (slug === 'yansi-b') return { ok: true, data: dto('yansi-b', 18, 2) };
      return { ok: false };
    });

    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });

    expect(
      within(screen.getByTestId('mirror-yansi-section-yansi-a')).getByTestId(
        'yansi-public-metrics'
      )
    ).toHaveTextContent('140 deneyim · 7 Yansı');
    expect(
      within(screen.getByTestId('mirror-yansi-section-yansi-b')).getByTestId(
        'yansi-public-metrics'
      )
    ).toHaveTextContent('18 deneyim · 2 Yansı');

    const sectionA = screen.getByTestId('mirror-yansi-section-yansi-a');
    fireEvent.click(within(sectionA).getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(within(sectionA).queryByText('Yanıt açılıyor…')).toBeNull();
    });
    const el = document.querySelector('[data-yansi-slug="yansi-b"]');
    act(() => {
      observers.forEach((obs) => {
        obs.cb(
          [
            {
              target: el as Element,
              isIntersecting: true,
              intersectionRatio: 0.7,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0,
            },
          ],
          obs as unknown as IntersectionObserver
        );
      });
    });
    expect(
      within(screen.getByTestId('mirror-yansi-section-yansi-b')).getByTestId(
        'yansi-public-metrics'
      )
    ).toHaveTextContent('18 deneyim · 2 Yansı');
    expect(fetchYansiPublicMetrics.mock.calls.filter((c) => c[0] === 'yansi-a').length).toBe(1);
  });

  it('answer progression does not refetch the same slug+version', async () => {
    const a = makeArtifact('demo-yansi', { stepCount: 6 });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(a);
    vi.mocked(fetchYansiPublicMetrics).mockResolvedValue({
      ok: true,
      data: dto('demo-yansi', 12, 1),
    });
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await screen.findByTestId('yansi-public-metrics');
    const before = fetchYansiPublicMetrics.mock.calls.length;
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
        'data-step-index',
        '2'
      );
    });
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
        'data-step-index',
        '3'
      );
    });
    expect(fetchYansiPublicMetrics.mock.calls.length).toBe(before);
  });
});
