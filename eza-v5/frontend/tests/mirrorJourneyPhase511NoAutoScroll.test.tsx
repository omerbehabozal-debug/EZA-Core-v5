/**
 * Phase 5.1.1 — no auto-scroll, preload≠activation, CTA stays current-bound.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
  YANSI_EXPERIENCE_STARTED_EVENT,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact>
) {
  const steps = Array.from({ length: 6 }, (_, i) => ({
    stepIndex: i + 1,
    publicQuestion: `${slug} Soru ${i + 1}?`,
    publicAnswer: `${slug} Cevap ${i + 1}.`,
    ezaSnapshot: { assistantScore: 80 + i },
  }));
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    selectedCount: 6,
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

beforeEach(() => {
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

describe('Phase 5.1.1 no auto-scroll / preload vs activation', () => {
  it('complete A: B prepared, no scrollIntoView, active=A, CTA=/m/A/sohbet', async () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a' });
    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        items: [childMeta('yansi-b', 'yansi-a'), childMeta('yansi-c', 'yansi-a')],
        total: 2,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-a') return a;
      if (slug === 'yansi-b') return b;
      if (slug === 'yansi-c') {
        return makeArtifact('yansi-c', { parentSlug: 'yansi-a' });
      }
      return null;
    });
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );

    const started: string[] = [];
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) started.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_STARTED_EVENT, onStarted);

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    render(<MirrorYansiChainExperience rootArtifact={a} />);

    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });

    expect(scrollSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );
    expect(
      within(screen.getByTestId('mirror-yansi-section-yansi-a')).getByTestId(
        'mirror-frozen-replay-continue'
      )
    ).toHaveAttribute('href', '/m/yansi-a/sohbet');

    expect(screen.getByTestId('mirror-continuation-cue')).toHaveTextContent(
      '2 Yansı buradan devam etti'
    );
    expect(screen.getByTestId('mirror-other-paths')).toHaveTextContent('Diğer 1 yol');

    // Preload must not start B experience / must not write progress
    expect(started.filter((s) => s === 'yansi-b')).toHaveLength(0);
    expect(loadFrozenReplayProgress('yansi-b', 1)).toBeNull();

    // Scene remains A
    expect(
      screen.getByTestId('mirror-yansi-scene-crossfade').querySelector('img')?.getAttribute('src')
    ).toBe('https://cdn.example/yansi-a.jpg');

    window.removeEventListener(YANSI_EXPERIENCE_STARTED_EVENT, onStarted);
  });

  it('manual alternate activate: B→C activates C CTA and may scroll', async () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a' });
    const c = makeArtifact('yansi-c', { parentSlug: 'yansi-a' });
    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        items: [childMeta('yansi-b', 'yansi-a'), childMeta('yansi-c', 'yansi-a')],
        total: 2,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-a') return a;
      if (slug === 'yansi-b') return b;
      if (slug === 'yansi-c') return c;
      return null;
    });
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-other-paths')).toBeTruthy();
    });
    scrollSpy.mockClear();

    fireEvent.click(screen.getByTestId('mirror-other-paths'));
    fireEvent.click(screen.getByTestId('mirror-alternate-child-yansi-c'));

    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-c')).toBeTruthy();
    });
    expect(scrollSpy).toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-c'
    );
    expect(
      screen.getByTestId('mirror-yansi-scene-crossfade').querySelector('img')?.getAttribute('src')
    ).toBe('https://cdn.example/yansi-c.jpg');
  });
});
