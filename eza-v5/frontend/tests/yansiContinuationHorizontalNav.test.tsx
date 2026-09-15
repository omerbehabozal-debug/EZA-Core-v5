/**
 * Slice 4 — horizontal true continuation on /m (not /children, not parentSlug).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, prefetch: vi.fn() }),
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

vi.mock('@/lib/eza/mirror-network/fetchDiscoverMirrors', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchDiscoverMirrors')
  >('@/lib/eza/mirror-network/fetchDiscoverMirrors');
  return {
    ...actual,
    fetchDiscoverMirrors: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchContinuationNeighbors')
  >('@/lib/eza/mirror-network/fetchContinuationNeighbors');
  return {
    ...actual,
    fetchContinuationNeighbors: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchPublishedChildren: vi.fn(),
    fetchAuthorPublishedYansilar: vi.fn(async () => ({
      ok: true as const,
      data: {
        userId: 'author',
        displayName: 'Test Author',
        publicHonorific: 'Meraklı',
        publicAvatarUrl: null,
        publicAvatarRevision: 0,
        items: [],
        total: 0,
      },
    })),
  };
});

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { fetchContinuationNeighbors } from '@/lib/eza/mirror-network/fetchContinuationNeighbors';
import { fetchPublishedChildren } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  clearAllFrozenReplayProgressForTests,
  loadFrozenReplayProgress,
  saveFrozenReplayProgress,
  type FrozenReplaySession,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import {
  YANSI_EXPERIENCE_COMPLETED_EVENT,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

function makeArtifact(slug: string, parentSlug?: string | null): PublicFrozenJourneyArtifact {
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    parentSlug: parentSlug ?? null,
    selectedCount: 6,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    publishedAt: '2026-09-15T00:00:00.000Z',
    replayReady: true,
    steps: Array.from({ length: 6 }, (_, i) => ({
      stepIndex: i + 1,
      publicQuestion: `${slug} Q${i + 1}?`,
      publicAnswer: `${slug} A${i + 1}.`,
    })),
  })!;
}

function neighborsFor(
  slug: string,
  previous: string | null,
  next: string | null
) {
  return {
    ok: true as const,
    data: {
      slug,
      journeyVersion: 1,
      previous: previous
        ? { slug: previous, journeyVersion: 1 }
        : null,
      next: next ? { slug: next, journeyVersion: 1 } : null,
    },
  };
}

describe('MirrorYansiChainExperience horizontal continuation', () => {
  beforeEach(() => {
    clearAllFrozenReplayProgressForTests();
    clearPublicAuthorDisplayCacheForTests();
    replaceMock.mockReset();
    vi.mocked(fetchPublishedChildren).mockReset();
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchContinuationNeighbors).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug)
    );
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) =>
      neighborsFor(slug, null, null)
    );
  });

  it('shows RIGHT when next continuation exists and navigates A→B', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-b');
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', null);
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    expect(fetchPublishedChildren).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Title yansi-b');
    expect(replaceMock).toHaveBeenCalledWith('/m/yansi-b');
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
  });

  it('LEFT returns B→A with URL and identity', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', 'yansi-c');
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-b');
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-prev'));
    fireEvent.click(screen.getByTestId('mirror-continuation-prev'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a'
      )
    );
    expect(replaceMock).toHaveBeenCalledWith('/m/yansi-a');
  });

  it('B RIGHT → C', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', 'yansi-c');
      if (slug === 'yansi-c') return neighborsFor('yansi-c', 'yansi-b', null);
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-c'
      )
    );
  });

  it('no RIGHT when next is null (private gap)', async () => {
    vi.mocked(fetchContinuationNeighbors).mockResolvedValue(
      neighborsFor('yansi-a', null, null)
    );
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-yansi-chain'));
    await waitFor(() => expect(fetchContinuationNeighbors).toHaveBeenCalled());
    expect(screen.queryByTestId('mirror-continuation-next')).toBeNull();
  });

  it('inspiration parentSlug on D does not become B RIGHT', async () => {
    vi.mocked(fetchContinuationNeighbors).mockResolvedValue(
      neighborsFor('yansi-b', null, null)
    );
    render(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b', 'yansi-a')}
      />
    );
    await waitFor(() => expect(fetchContinuationNeighbors).toHaveBeenCalledWith('yansi-b'));
    expect(screen.queryByTestId('mirror-continuation-next')).toBeNull();
    expect(fetchPublishedChildren).not.toHaveBeenCalled();
  });

  it('direct C with public B shows LEFT', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-c') return neighborsFor('yansi-c', 'yansi-b', null);
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-c')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-prev'));
    fireEvent.click(screen.getByTestId('mirror-continuation-prev'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
  });

  it('restores A progress after RIGHT B then LEFT', async () => {
    const session: FrozenReplaySession = {
      slug: 'yansi-a',
      journeyVersion: 1,
      completedStepCount: 3,
      phase: 'awaiting_next',
      replayStarted: true,
      replayCompleted: false,
    };
    saveFrozenReplayProgress(session);
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-b');
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', null);
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    fireEvent.click(screen.getByTestId('mirror-continuation-prev'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a'
      )
    );
    expect(loadFrozenReplayProgress('yansi-a', 1)?.completedStepCount).toBe(3);
    expect(loadFrozenReplayProgress('yansi-a', 1)?.replayCompleted).toBe(false);
  });

  it('incomplete A is not completed on RIGHT', async () => {
    const completed: string[] = [];
    const onCompleted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mirrorSlug?: string };
      if (detail?.mirrorSlug) completed.push(detail.mirrorSlug);
    };
    window.addEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);
    const session: FrozenReplaySession = {
      slug: 'yansi-a',
      journeyVersion: 1,
      completedStepCount: 2,
      phase: 'awaiting_next',
      replayStarted: true,
      replayCompleted: false,
    };
    saveFrozenReplayProgress(session);
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-b');
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', null);
      return neighborsFor(slug, null, null);
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    await new Promise((r) => setTimeout(r, 400));
    expect(completed).not.toContain('yansi-a');
    window.removeEventListener(YANSI_EXPERIENCE_COMPLETED_EVENT, onCompleted);
  });

  it('horizontal replace truncates forward Discover history', async () => {
    let discoverCall = 0;
    vi.mocked(fetchDiscoverMirrors).mockImplementation(async () => {
      discoverCall += 1;
      const slug =
        discoverCall === 1 ? 'yansi-x' : discoverCall === 2 ? 'yansi-y' : `yansi-z-${discoverCall}`;
      return {
        ok: true,
        data: {
          items: [
            {
              slug,
              title: slug,
              sceneImageUrl: `https://cdn.example/${slug}.jpg`,
              yansiCount: 0,
            },
          ],
          total: 20,
          mode: 'random' as const,
          randomSession: 'sess-h1',
          strongCuriosityReady: false,
        },
      };
    });
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-x') return neighborsFor('yansi-x', null, 'yansi-x2');
      if (slug === 'yansi-x2') return neighborsFor('yansi-x2', 'yansi-x', null);
      return neighborsFor(slug, null, null);
    });

    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      )
    );
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-y'
      )
    );
    fireEvent.click(screen.getByTestId('mirror-discover-up'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      )
    );
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x2'
      )
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-length',
      '2'
    );
    // Forward Y truncated — DOWN should fetch, not revive Y without fetch.
    const callsBefore = vi.mocked(fetchDiscoverMirrors).mock.calls.length;
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(vi.mocked(fetchDiscoverMirrors).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it('neighbor fetch failure does not navigate', async () => {
    vi.mocked(fetchContinuationNeighbors).mockResolvedValue({ ok: false, status: 500 });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-yansi-chain'));
    await waitFor(() => expect(fetchContinuationNeighbors).toHaveBeenCalled());
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );
    expect(screen.queryByTestId('mirror-continuation-next')).toBeNull();
  });

  it('rapid double RIGHT does not race duplicate append', async () => {
    let resolveLoad: ((value: PublicFrozenJourneyArtifact | null) => void) | null = null;
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-b');
      if (slug === 'yansi-b') return neighborsFor('yansi-b', 'yansi-a', null);
      return neighborsFor(slug, null, null);
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(
      ({ slug }) =>
        new Promise((resolve) => {
          if (slug === 'yansi-b') {
            resolveLoad = resolve;
            return;
          }
          resolve(makeArtifact(slug));
        })
    );
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />);
    await waitFor(() => screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    fireEvent.click(screen.getByTestId('mirror-continuation-next'));
    resolveLoad?.(makeArtifact('yansi-b'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-length',
      '1'
    );
  });
});
