/**
 * Slice 3 — /m vertical Discover navigation (not /children lineage).
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

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchPublishedChildren: vi.fn(),
    fetchAuthorPublishedYansilar: vi.fn(async () => ({
      ok: true,
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
import { MAX_DISCOVER_CANDIDATE_PAGES } from '@/lib/eza/mirror/journey/fetchNextDiscoverCandidate';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

function makeArtifact(slug: string): PublicFrozenJourneyArtifact {
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    parentSlug: slug === 'yansi-b' ? 'yansi-a' : null,
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

describe('MirrorYansiChainExperience Discover vertical', () => {
  beforeEach(() => {
    clearAllFrozenReplayProgressForTests();
    clearPublicAuthorDisplayCacheForTests();
    replaceMock.mockReset();
    vi.mocked(fetchPublishedChildren).mockReset();
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug)
    );
  });

  it('direct entry activates B and does not call /children', async () => {
    const b = makeArtifact('yansi-b');
    render(<MirrorYansiChainExperience rootArtifact={b} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      );
    });
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Title yansi-b');
    expect(fetchPublishedChildren).not.toHaveBeenCalled();
  });

  it('DOWN fetches Discover X, updates active identity and URL replace', async () => {
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            title: 'B',
            sceneImageUrl: 'https://cdn.example/b.jpg',
            yansiCount: 0,
          },
          {
            slug: 'yansi-x',
            title: 'X',
            sceneImageUrl: 'https://cdn.example/x.jpg',
            yansiCount: 0,
          },
        ],
        total: 2,
        mode: 'random',
        randomSession: 'session-test-01',
        strongCuriosityReady: false,
      },
    });

    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));

    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      );
    });
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Title yansi-x');
    expect(replaceMock).toHaveBeenCalledWith('/m/yansi-x');
    expect(fetchPublishedChildren).not.toHaveBeenCalled();
  });

  it('B↓X↓Y then ↑ then ↓ returns Y without a new fetch', async () => {
    const queue = [
      {
        ok: true as const,
        data: {
          items: [
            {
              slug: 'yansi-x',
              title: 'X',
              sceneImageUrl: 'https://cdn.example/x.jpg',
              yansiCount: 0,
            },
          ],
          total: 10,
          mode: 'random' as const,
          randomSession: 'session-test-02',
          strongCuriosityReady: false,
        },
      },
      {
        ok: true as const,
        data: {
          items: [
            {
              slug: 'yansi-y',
              title: 'Y',
              sceneImageUrl: 'https://cdn.example/y.jpg',
              yansiCount: 0,
            },
          ],
          total: 10,
          mode: 'random' as const,
          randomSession: 'session-test-02',
          strongCuriosityReady: false,
        },
      },
    ];
    let i = 0;
    vi.mocked(fetchDiscoverMirrors).mockImplementation(async () => queue[i++]!);

    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
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

    const fetchesAfterDown = vi.mocked(fetchDiscoverMirrors).mock.calls.length;
    fireEvent.click(screen.getByTestId('mirror-discover-up'));
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
    expect(vi.mocked(fetchDiscoverMirrors).mock.calls.length).toBe(fetchesAfterDown);
  });

  it('UP at entry stays on B', async () => {
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-yansi-chain'));
    expect(screen.queryByTestId('mirror-discover-up')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
  });

  it('fetch failure leaves active slug unchanged', async () => {
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({ ok: false, status: 500 });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() => expect(fetchDiscoverMirrors).toHaveBeenCalled());
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
  });

  it('restores B progress after visiting X', async () => {
    const session: FrozenReplaySession = {
      slug: 'yansi-b',
      journeyVersion: 1,
      completedStepCount: 3,
      phase: 'awaiting_next',
      replayStarted: true,
      replayCompleted: false,
    };
    saveFrozenReplayProgress(session);
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-x',
            title: 'X',
            sceneImageUrl: 'https://cdn.example/x.jpg',
            yansiCount: 0,
          },
        ],
        total: 2,
        mode: 'random',
        randomSession: 'session-test-03',
        strongCuriosityReady: false,
      },
    });

    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      )
    );
    fireEvent.click(screen.getByTestId('mirror-discover-up'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    const progress = loadFrozenReplayProgress('yansi-b', 1);
    expect(progress?.completedStepCount).toBe(3);
    expect(progress?.replayCompleted).toBe(false);
  });

  it('share button binds to active slug X', async () => {
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-x',
            title: 'X',
            sceneImageUrl: 'https://cdn.example/x.jpg',
            yansiCount: 0,
          },
        ],
        total: 1,
        mode: 'random',
        randomSession: 'session-test-04',
        strongCuriosityReady: false,
      },
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      )
    );
    // Share control is rendered with the active section identity.
    expect(screen.getByTestId('mirror-yansi-section-yansi-x')).toBeTruthy();
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveAttribute(
      'data-slug',
      'yansi-x'
    );
  });

  it('pool exhausted shows end state and does not loop', async () => {
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            title: 'B',
            sceneImageUrl: 'https://cdn.example/b.jpg',
            yansiCount: 0,
          },
        ],
        total: 1,
        mode: 'random',
        randomSession: 'session-test-05',
        strongCuriosityReady: false,
      },
    });
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() => expect(screen.getByTestId('mirror-discover-pool-end')).toBeTruthy());
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    const calls = vi.mocked(fetchDiscoverMirrors).mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(MAX_DISCOVER_CANDIDATE_PAGES);
    // After exhaustion, DOWN affordance is withdrawn (no further fetch loop).
    expect(screen.queryByTestId('mirror-skip-to-next')).toBeNull();
  });

  it('rapid double DOWN does not append duplicates', async () => {
    let resolvePage: ((value: unknown) => void) | null = null;
    vi.mocked(fetchDiscoverMirrors).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }) as never
    );
    render(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} />);
    await waitFor(() => screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    expect(vi.mocked(fetchDiscoverMirrors).mock.calls.length).toBe(1);
    resolvePage?.({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-x',
            title: 'X',
            sceneImageUrl: 'https://cdn.example/x.jpg',
            yansiCount: 0,
          },
        ],
        total: 5,
        mode: 'random',
        randomSession: 'session-test-06',
        strongCuriosityReady: false,
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-x'
      )
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-length',
      '2'
    );
  });
});
