/**
 * Phase 5.1.2 — leave a Yansı before all frozen steps; resume; active parent CTA.
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

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  fetchPublishedChildren,
  fetchAuthorPublishedYansilar,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
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

type Observed = {
  cb: IntersectionObserverCallback;
  elements: Set<Element>;
};

const observers: Observed[] = [];

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

function childMeta(slug: string, parentSlug: string) {
  return {
    slug,
    shareUrl: `/m/${slug}`,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    publishedAt: '2026-08-01T00:00:00Z',
    parentSlug,
  };
}

function mockAbChain() {
  const a = makeArtifact('yansi-a', { stepCount: 8 });
  const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a', stepCount: 6 });
  vi.mocked(fetchPublishedChildren).mockImplementation(async (slug) => {
    if (slug === 'yansi-a') {
      return {
        ok: true,
        data: {
          parentSlug: 'yansi-a',
          items: [childMeta('yansi-b', 'yansi-a')],
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
  return { a, b };
}

function activateYansiSection(slug: string) {
  const el = document.querySelector(`[data-yansi-slug="${slug}"]`);
  if (!el) throw new Error(`missing section ${slug}`);
  act(() => {
    for (const obs of observers) {
      obs.cb(
        [
          {
            target: el,
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
    }
  });
}

async function askNextInSection(slug: string) {
  const section = screen.getByTestId(`mirror-yansi-section-${slug}`);
  fireEvent.click(within(section).getByTestId('mirror-frozen-replay-next-question'));
  await waitFor(() => {
    expect(within(section).queryByText('Yanıt açılıyor…')).toBeNull();
  });
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
  vi.mocked(fetchAuthorPublishedYansilar).mockImplementation(async (userId) => ({
    ok: true,
    data: {
      userId,
      displayName: userId.replace('author-', 'Name '),
      items: [],
      total: 0,
    },
  }));
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

describe('Phase 5.1.2 partial skip + resume', () => {
  it('Q1–Q3 then enter B: A stays 3/8 incomplete, B starts at Q1', async () => {
    const { a } = mockAbChain();
    const fetchSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;

    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });

    const sectionA = screen.getByTestId('mirror-yansi-section-yansi-a');
    expect(within(sectionA).getByTestId('mirror-skip-to-next')).toHaveTextContent(
      YANSI_SKIP_TO_NEXT_MERAK
    );
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

    activateYansiSection('yansi-b');
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      );
    });

    expect(loadFrozenReplayProgress('yansi-a', 1)).toEqual({
      slug: 'yansi-a',
      journeyVersion: 1,
      completedStepCount: 3,
      replayCompleted: false,
    });
    expect(loadFrozenReplayProgress('yansi-b', 1)).toBeNull();
    const sectionB = screen.getByTestId('mirror-yansi-section-yansi-b');
    expect(within(sectionB).getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-b Soru 1?'
    );
    expect(within(sectionB).getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-b/sohbet'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('return to A resumes at Q4 — does not restart or complete', async () => {
    const { a } = mockAbChain();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    activateYansiSection('yansi-b');
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      );
    });
    activateYansiSection('yansi-a');
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

  it('partial A → B fires skip, not completed; complete A → B is not skip', async () => {
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

    const { a } = mockAbChain();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    await askNextInSection('yansi-a');
    activateYansiSection('yansi-b');
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

  it('completed A → B does not fire skip; completed event already happened', async () => {
    const skipped: string[] = [];
    const onSkip = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) skipped.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);

    const { a } = mockAbChain();
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
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });
    expect(screen.queryByTestId('mirror-skip-to-next')).toBeNull();
    activateYansiSection('yansi-b');
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      );
    });
    await new Promise((r) => setTimeout(r, 450));
    expect(skipped).toEqual([]);
    window.removeEventListener(YANSI_EXPERIENCE_SKIPPED_EVENT, onSkip);
  });

  it('preload of B does not start or complete B', async () => {
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

    const { a } = mockAbChain();
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });
    expect(started.filter((s) => s === 'yansi-b')).toHaveLength(0);
    expect(completed.filter((s) => s === 'yansi-b')).toHaveLength(0);
    expect(loadFrozenReplayProgress('yansi-b', 1)).toBeNull();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );

    window.removeEventListener(YANSI_EXPERIENCE_STARTED_EVENT, onStarted);
    window.removeEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);
  });

  it('skip affordance scrolls toward B but is not required; no auto-scroll on preload', async () => {
    const { a } = mockAbChain();
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-skip-to-next')).toBeTruthy();
    });
    expect(scrollSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    expect(scrollSpy).toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );
  });

  it('no eligible child: no skip affordance; replay and own continuation remain', async () => {
    const a = makeArtifact('yansi-solo', { stepCount: 8 });
    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: { parentSlug: 'yansi-solo', items: [], total: 0 },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(a);
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    });
    expect(screen.queryByTestId('mirror-skip-to-next')).toBeNull();
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

  it('child load failure keeps A usable with no fake skip', async () => {
    const a = makeArtifact('yansi-a', { stepCount: 8 });
    vi.mocked(fetchPublishedChildren).mockResolvedValue({ ok: false });
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    });
    expect(screen.queryByTestId('mirror-skip-to-next')).toBeNull();
    expect(screen.queryByTestId('mirror-yansi-section-yansi-b')).toBeNull();
    expect(screen.getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-a/sohbet'
    );
  });
});
