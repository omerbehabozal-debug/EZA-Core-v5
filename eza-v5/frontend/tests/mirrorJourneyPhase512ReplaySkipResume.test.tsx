/**
 * Phase 5.1.2 — leave a Yansı before all frozen steps; resume via Discover ↑/↓.
 * Slice 3: vertical nav is Discover session (not /children IO activation).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
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

vi.mock('@/lib/eza/mirror-network/fetchDiscoverMirrors', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchDiscoverMirrors')
  >('@/lib/eza/mirror-network/fetchDiscoverMirrors');
  return {
    ...actual,
    fetchDiscoverMirrors: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async (slug: string) => ({
    ok: true as const,
    data: { slug, journeyVersion: 1, previous: null, next: null },
  })),
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  fetchPublishedChildren,
  fetchAuthorPublishedYansilar,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  clearAllFrozenReplayProgressForTests,
  loadFrozenReplayProgress,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';
import {
  shouldRecordYansiSkip,
  YANSI_EXPERIENCE_COMPLETED_EVENT,
  YANSI_EXPERIENCE_SKIPPED_EVENT,
  YANSI_EXPERIENCE_STARTED_EVENT,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import { YANSI_SKIP_TO_NEXT_MERAK } from '@/lib/eza/mirror/copy';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact> & { stepCount?: 6 | 7 | 8 }
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
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    selectedCount: n,
    steps,
    replayReady: true,
    ...overrides,
  })!;
}

function discoverItem(slug: string) {
  return {
    slug,
    title: `Title ${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    yansiCount: 0,
  };
}

function mockDiscoverNext(slug: string) {
  vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
    ok: true,
    data: {
      items: [discoverItem(slug)],
      total: 10,
      mode: 'random',
      randomSession: 'session-phase512',
      strongCuriosityReady: false,
    },
  });
}

function mockAxDiscover() {
  const a = makeArtifact('yansi-a', { stepCount: 8 });
  const x = makeArtifact('yansi-x', { stepCount: 6 });
  mockDiscoverNext('yansi-x');
  vi.mocked(fetchPublishedChildren).mockResolvedValue({
    ok: true,
    data: { parentSlug: 'yansi-a', items: [], total: 0 },
  });
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
    if (slug === 'yansi-a') return a;
    if (slug === 'yansi-x') return x;
    return null;
  });
  return { a, x };
}

async function askNextInSection(slug: string) {
  const section = screen.getByTestId(`mirror-yansi-section-${slug}`);
  fireEvent.click(within(section).getByTestId('mirror-frozen-replay-next-question'));
  await waitFor(() => {
    expect(within(section).queryByText('Yanıt açılıyor…')).toBeNull();
  });
}

async function goDiscoverDownTo(slug: string) {
  fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
  await waitFor(() => {
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      slug
    );
  });
}

beforeEach(() => {
  clearAllFrozenReplayProgressForTests();
  clearEzaUserPreferencesForTests();
  clearPublicAuthorDisplayCacheForTests();
  localStorage.clear();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchPublishedChildren).mockReset();
  vi.mocked(fetchDiscoverMirrors).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockImplementation(async (userId) => ({
    ok: true,
    data: {
      userId,
      displayName: userId.replace('author-', 'Name '),
      publicHonorific: 'Meraklı',
      publicAvatarUrl: null,
      publicAvatarRevision: 0,
      items: [],
      total: 0,
    },
  }));
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Phase 5.1.2 skip semantics (pure)', () => {
  it('does not treat preload, unstarted, or completed as skip', () => {
    expect(
      shouldRecordYansiSkip({
        fromSlug: 'yansi-a',
        toSlug: 'yansi-b',
        fromProgress: null,
      })
    ).toBe(false);
    expect(
      shouldRecordYansiSkip({
        fromSlug: 'yansi-a',
        toSlug: 'yansi-b',
        fromProgress: { completedStepCount: 0, replayCompleted: false },
      })
    ).toBe(false);
    expect(
      shouldRecordYansiSkip({
        fromSlug: 'yansi-a',
        toSlug: 'yansi-b',
        fromProgress: { completedStepCount: 8, replayCompleted: true },
      })
    ).toBe(false);
    expect(
      shouldRecordYansiSkip({
        fromSlug: 'yansi-a',
        toSlug: 'yansi-a',
        fromProgress: { completedStepCount: 3, replayCompleted: false },
      })
    ).toBe(false);
  });

  it('records skip only for started incomplete → another Yansı', () => {
    expect(
      shouldRecordYansiSkip({
        fromSlug: 'yansi-a',
        toSlug: 'yansi-b',
        fromProgress: { completedStepCount: 3, replayCompleted: false },
      })
    ).toBe(true);
  });
});

describe('Phase 5.1.2 partial skip + resume (Discover vertical)', () => {
  it('Q1–Q3 then Discover DOWN: A stays 3/8 incomplete, X starts at Q1', async () => {
    const { a } = mockAxDiscover();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-skip-to-next')).toHaveTextContent(
        YANSI_SKIP_TO_NEXT_MERAK
      );
    });

    const sectionA = screen.getByTestId('mirror-yansi-section-yansi-a');
    expect(within(sectionA).getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-a/sohbet'
    );

    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    expect(within(sectionA).getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
      'data-step-index',
      '4'
    );

    await goDiscoverDownTo('yansi-x');
    expect(fetchPublishedChildren).not.toHaveBeenCalled();

    expect(loadFrozenReplayProgress('yansi-a', 1)).toEqual({
      slug: 'yansi-a',
      journeyVersion: 1,
      completedStepCount: 3,
      replayCompleted: false,
    });
    expect(loadFrozenReplayProgress('yansi-x', 1)).toBeNull();
    const sectionX = screen.getByTestId('mirror-yansi-section-yansi-x');
    expect(within(sectionX).getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-x Soru 1?'
    );
    expect(within(sectionX).getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-x/sohbet'
    );
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
        'src',
        'https://cdn.example/yansi-x.jpg'
      );
    });
  });

  it('return to A via ↑ resumes at Q4 — does not restart or complete', async () => {
    const { a } = mockAxDiscover();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await goDiscoverDownTo('yansi-x');
    fireEvent.click(screen.getByTestId('mirror-discover-up'));
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a'
      );
    });
    const sectionA = screen.getByTestId('mirror-yansi-section-yansi-a');
    expect(within(sectionA).getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
      'data-step-index',
      '4'
    );
    expect(within(sectionA).getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-a Soru 4?'
    );
    expect(loadFrozenReplayProgress('yansi-a', 1)?.replayCompleted).toBe(false);
    expect(loadFrozenReplayProgress('yansi-a', 1)?.completedStepCount).toBe(3);
  });

  it('partial A → X fires skip, not completed; complete A → X is not skip', async () => {
    const skipped: string[] = [];
    const completed: string[] = [];
    const onSkip = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) skipped.push(detail.mirrorSlug);
    };
    const onCompleted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) completed.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);
    window.addEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);

    const { a } = mockAxDiscover();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await goDiscoverDownTo('yansi-x');
    await waitFor(
      () => {
        expect(skipped).toContain('yansi-a');
      },
      { timeout: 1500 }
    );
    expect(completed).not.toContain('yansi-a');
    window.removeEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);
    window.removeEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);
  });

  it('completed A → X does not fire skip', async () => {
    const skipped: string[] = [];
    const onSkip = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) skipped.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);

    const { a } = mockAxDiscover();
    localStorage.setItem(
      'eza_frozen_replay_progress_v1:yansi-a:v1',
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 8,
        replayCompleted: true,
      })
    );
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    await goDiscoverDownTo('yansi-x');
    await new Promise((r) => setTimeout(r, 450));
    expect(skipped).toEqual([]);
    window.removeEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);
  });

  it('mount alone does not start or complete next Discover candidate', async () => {
    const started: string[] = [];
    const completed: string[] = [];
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) started.push(detail.mirrorSlug);
    };
    const onCompleted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) completed.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_STARTED_EVENT, onStarted);
    window.addEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);

    const { a } = mockAxDiscover();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => screen.getByTestId('mirror-yansi-section-yansi-a'));
    expect(screen.queryByTestId('mirror-yansi-section-yansi-x')).toBeNull();
    expect(started.filter((s) => s === 'yansi-x')).toHaveLength(0);
    expect(completed.filter((s) => s === 'yansi-x')).toHaveLength(0);
    expect(loadFrozenReplayProgress('yansi-x', 1)).toBeNull();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );
    expect(fetchDiscoverMirrors).not.toHaveBeenCalled();

    window.removeEventListener(YANSI_EXPERIENCE_STARTED_EVENT, onStarted);
    window.removeEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);
  });

  it('Discover DOWN activates next without requiring scrollIntoView', async () => {
    const { a } = mockAxDiscover();
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-skip-to-next')).toBeTruthy();
    });
    expect(scrollSpy).not.toHaveBeenCalled();
    await goDiscoverDownTo('yansi-x');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-x'
    );
  });

  it('Discover DOWN remains available; replay and own continuation remain', async () => {
    const a = makeArtifact('yansi-solo', { stepCount: 8 });
    mockDiscoverNext('yansi-x');
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-solo') return a;
      if (slug === 'yansi-x') return makeArtifact('yansi-x', { stepCount: 6 });
      return null;
    });
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    });
    expect(screen.getByTestId('mirror-skip-to-next')).toBeTruthy();
    expect(screen.getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-solo/sohbet'
    );
    await askNextInSection('yansi-solo');
    expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
      'data-step-index',
      '2'
    );
  });

  it('Discover fetch failure keeps A usable with no fake next Yansı', async () => {
    const a = makeArtifact('yansi-a', { stepCount: 8 });
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({ ok: false, status: 500 });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(a);
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() => expect(fetchDiscoverMirrors).toHaveBeenCalled());
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );
    expect(screen.queryByTestId('mirror-yansi-section-yansi-x')).toBeNull();
    expect(screen.getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-a/sohbet'
    );
  });
});
