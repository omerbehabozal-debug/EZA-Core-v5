/**
 * Phase 6.0 — durable ingest wiring + start/complete/skip delivery.
 * Does not change replay UX; analytics POST is best-effort.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import {
  trackYansiExperienceStarted,
  YANSI_EXPERIENCE_COMPLETED_EVENT,
  YANSI_EXPERIENCE_STARTED_EVENT,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import {
  clearYansiExperienceSessionsForTests,
  getOrCreateYansiExperienceSession,
} from '@/lib/eza/mirror/journey/yansiExperienceSession';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

type Observed = {
  cb: IntersectionObserverCallback;
  elements: Set<Element>;
};

const observers: Observed[] = [];

function makeArtifact(
  slug: string,
  n: 6 | 7 | 8 = 6,
  overrides?: Partial<PublicFrozenJourneyArtifact>
) {
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

function ingestBodies(fetchSpy: ReturnType<typeof vi.fn>) {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).includes('/experience-events'))
    .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')));
}

beforeEach(() => {
  observers.length = 0;
  clearAllFrozenReplayProgressForTests();
  clearYansiExperienceSessionsForTests();
  clearEzaUserPreferencesForTests();
  clearPublicAuthorDisplayCacheForTests();
  localStorage.clear();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchPublishedChildren).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
    ok: true,
    data: { userId: 'author-a', displayName: 'Name A', items: [], total: 0 },
  });
  vi.mocked(fetchPublishedChildren).mockResolvedValue({
    ok: true,
    data: { parentSlug: 'root-a', items: [], total: 0 },
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

describe('Phase 6.0 session identity', () => {
  it('refresh/resume reuses the same experienceSessionId and started eventId', () => {
    const first = getOrCreateYansiExperienceSession('demo-yansi', 1);
    const again = getOrCreateYansiExperienceSession('demo-yansi', 1);
    expect(again.experienceSessionId).toBe(first.experienceSessionId);
    expect(again.startedEventId).toBe(first.startedEventId);
    expect(again.completedEventId).toBe(first.completedEventId);
  });

  it('a new slug+version identity is a new session (genuine later replay after clear)', () => {
    const a = getOrCreateYansiExperienceSession('demo-yansi', 1);
    clearYansiExperienceSessionsForTests();
    const b = getOrCreateYansiExperienceSession('demo-yansi', 1);
    expect(b.experienceSessionId).not.toBe(a.experienceSessionId);
  });
});

describe('Phase 6.0 start semantics', () => {
  it('X. landing CTA / page view does not fire STARTED', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('demo-yansi'));
    const started = vi.fn();
    window.addEventListener(YANSI_EXPERIENCE_STARTED_EVENT, started);
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'demo-yansi',
          cardTitle: 'Demo',
          cardDate: '2026-08-12',
          dayLabel: '12 Ağustos',
          sceneImageUrl: null,
          curiosityContext: 'Özet',
        }}
      />
    );
    fireEvent.click(await screen.findByTestId('mirror-experience-start'));
    expect(await screen.findByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
    expect(started).not.toHaveBeenCalled();
    window.removeEventListener(YANSI_EXPERIENCE_STARTED_EVENT, started);
  });

  it('Z. first frozen question engagement fires STARTED exactly once', async () => {
    const artifact = makeArtifact('demo-yansi');
    const started = vi.fn();
    window.addEventListener(YANSI_EXPERIENCE_STARTED_EVENT, started);
    render(<MirrorFrozenReplay artifact={artifact} />);
    expect(started).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    expect(started).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
        'data-step-index',
        '2'
      );
    });
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    expect(started).toHaveBeenCalledTimes(1);
    window.removeEventListener(YANSI_EXPERIENCE_STARTED_EVENT, started);
  });

  it('W/Y. child preload / IO visibility alone does not fire STARTED', async () => {
    const root = makeArtifact('yansi-a', 8);
    const child = makeArtifact('yansi-b', 6, { parentSlug: 'yansi-a' });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-a') return root;
      if (slug === 'yansi-b') return child;
      return null;
    });
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
    const startedSlugs: string[] = [];
    window.addEventListener(YANSI_EXPERIENCE_STARTED_EVENT, (ev) => {
      startedSlugs.push((ev as CustomEvent).detail.mirrorSlug);
    });
    render(<MirrorYansiChainExperience rootArtifact={root} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });
    const el = document.querySelector('[data-yansi-slug="yansi-b"]');
    expect(el).toBeTruthy();
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
    expect(startedSlugs).toEqual([]);
  });
});

describe('Phase 6.0 completion + failure UX', () => {
  it('completed fires once after final answer reveal, not on last question tap', async () => {
    const artifact = makeArtifact('demo-yansi', 6);
    const completed = vi.fn();
    window.addEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, completed);
    render(<MirrorFrozenReplay artifact={artifact} />);
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
      await waitFor(() => {
        expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
          'data-step-index',
          String(i + 2)
        );
      });
      expect(completed).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(completed).toHaveBeenCalledTimes(1);
    });
    expect(completed).toHaveBeenCalledTimes(1);
    window.removeEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, completed);
  });

  it('V. analytics POST failure does not block replay', async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch;
    try {
      const artifact = makeArtifact('demo-yansi', 6);
      render(<MirrorFrozenReplay artifact={artifact} />);
      fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
      await waitFor(() => {
        expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
          'data-step-index',
          '2'
        );
      });
      expect(screen.getByText('demo-yansi Cevap 1.')).toBeTruthy();
    } finally {
      globalThis.fetch = prev;
    }
  });

  it('durable POST reuses started eventId across track retries', () => {
    const prev = globalThis.fetch;
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 200 })
    );
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      trackYansiExperienceStarted({ slug: 'demo-yansi', journeyVersion: 1 });
      trackYansiExperienceStarted({ slug: 'demo-yansi', journeyVersion: 1 });
      const bodies = ingestBodies(fetchSpy);
      expect(bodies).toHaveLength(2);
      expect(bodies[0].eventId).toBe(bodies[1].eventId);
      expect(bodies[0].experienceSessionId).toBe(bodies[1].experienceSessionId);
      expect(bodies[0].eventType).toBe('yansi_experience_started');
      expect(JSON.stringify(bodies[0])).not.toMatch(/publicQuestion|ezaSnapshot|guestToken/i);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
