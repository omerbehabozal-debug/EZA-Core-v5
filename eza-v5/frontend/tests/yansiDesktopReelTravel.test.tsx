/**
 * Desktop Reel — vertical two-surface travel, identity lock, chat isolation.
 */
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { YANSI_WHEEL_COMMIT_PX } from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';
import {
  YANSI_REEL_TRAVEL_MS,
  yansiReelSurfaceTransform,
} from '@/lib/eza/mirror/journey/yansiDesktopReelTransition';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/m/yansi-b',
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => true,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, isAuthReady: true, user: null }),
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

vi.mock('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay')
  >();
  return {
    ...actual,
    resolvePublicAuthorIdentity: async (userId?: string | null) => ({
      displayName: userId === 'user-x' ? 'Author X' : 'Author B',
      publicHonorific: '',
      publicAvatarUrl: null,
      publicAvatarRevision: null,
    }),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async (slug: string) => ({
    ok: true,
    data: { slug, journeyVersion: 2, previous: null, next: null },
  })),
}));

vi.mock('@/lib/eza/mirror-network/fetchDiscoverMirrors', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchDiscoverMirrors')
  >('@/lib/eza/mirror-network/fetchDiscoverMirrors');
  return {
    ...actual,
    fetchDiscoverMirrors: vi.fn(),
  };
});

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact>
): PublicFrozenJourneyArtifact {
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: `Canonical ${slug}`,
    publicSummary: `Sealed summary ${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    authorUserId: slug === 'yansi-x' ? 'user-x' : 'user-b',
    selectedCount: 4,
    steps: [
      { stepIndex: 1, publicQuestion: 'Q1?', publicAnswer: 'A1' },
      { stepIndex: 2, publicQuestion: 'Q2?', publicAnswer: 'A2' },
    ],
    publishedAt: '2026-09-01T12:00:00.000Z',
    replayReady: true,
    ...overrides,
  };
}

function wheel(target: Element, deltaY: number) {
  fireEvent.wheel(target, { deltaY, bubbles: true, cancelable: true });
}

function renderChain(ui: ReactElement, slug = 'yansi-b') {
  return render(
    <YansiExperienceSessionProvider slug={slug}>{ui}</YansiExperienceSessionProvider>
  );
}

describe('desktop reel vertical travel', () => {
  it('maps down/up poses so both surfaces travel the full viewport', () => {
    expect(yansiReelSurfaceTransform('outgoing', 'down', false, false)).toBe('translateY(0)');
    expect(yansiReelSurfaceTransform('incoming', 'down', false, false)).toBe('translateY(100%)');
    expect(yansiReelSurfaceTransform('outgoing', 'down', true, false)).toBe('translateY(-100%)');
    expect(yansiReelSurfaceTransform('incoming', 'down', true, false)).toBe('translateY(0)');
    expect(yansiReelSurfaceTransform('outgoing', 'up', true, false)).toBe('translateY(100%)');
    expect(yansiReelSurfaceTransform('incoming', 'up', false, false)).toBe('translateY(-100%)');
    expect(yansiReelSurfaceTransform('incoming', 'up', true, false)).toBe('translateY(0)');
    expect(yansiReelSurfaceTransform('outgoing', 'down', true, true)).toBe('translateY(0)');
  });

  beforeEach(() => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug)
    );
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-x',
            title: 'Canonical yansi-x',
            sceneImageUrl: 'https://cdn.example/yansi-x.jpg',
            yansiCount: 0,
          },
        ],
        total: 8,
        mode: 'random',
        randomSession: 'session-reel-travel',
        strongCuriosityReady: false,
      },
    });
  });

  it('keeps A committed while B enters; never mixes title and scene', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-yansi-reel-transition', 'down');
    });
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(chain).toHaveAttribute('data-yansi-incoming-slug', 'yansi-x');
    expect(chain).toHaveAttribute('data-yansi-reel-nav', 'locked');
    const outgoing = screen.getByTestId('yansi-desktop-reel-surface-outgoing');
    const incoming = screen.getByTestId('yansi-desktop-reel-surface-incoming');
    expect(outgoing).toHaveAttribute('data-yansi-surface-slug', 'yansi-b');
    expect(incoming).toHaveAttribute('data-yansi-surface-slug', 'yansi-x');
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Canonical yansi-b');
    expect(screen.getByTestId('mirror-yansi-incoming-title')).toHaveTextContent(
      'Canonical yansi-x'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
    expect(screen.getByTestId('mirror-yansi-scene-incoming-image')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-x.jpg'
    );
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-slug',
      'yansi-b'
    );
    await waitFor(() => {
      expect(outgoing).toHaveAttribute('data-yansi-traveling', 'true');
    });
    wheel(chain, 400);
    wheel(chain, 400);
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(vi.mocked(fetchDiscoverMirrors)).toHaveBeenCalledTimes(1);

    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: YANSI_REEL_TRAVEL_MS + 800 }
    );
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    expect(screen.queryByTestId('yansi-desktop-reel-surface-outgoing')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Canonical yansi-x');
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-x.jpg'
    );
    expect(screen.queryByTestId('yansi-desktop-detail-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('reverse travel keeps B outgoing and A incoming', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: YANSI_REEL_TRAVEL_MS + 800 }
    );
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(20_000);
    wheel(chain, -(YANSI_WHEEL_COMMIT_PX + 40));
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-yansi-reel-transition', 'up');
    });
    expect(screen.getByTestId('yansi-desktop-reel-surface-outgoing')).toHaveAttribute(
      'data-yansi-surface-slug',
      'yansi-x'
    );
    expect(screen.getByTestId('yansi-desktop-reel-surface-incoming')).toHaveAttribute(
      'data-yansi-surface-slug',
      'yansi-b'
    );
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
      },
      { timeout: YANSI_REEL_TRAVEL_MS + 800 }
    );
    now.mockRestore();
  });

  it('resets Detay as travel begins so B arrives collapsed', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    fireEvent.click(screen.getByTestId('yansi-desktop-detail-toggle'));
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute('data-open', 'true');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-yansi-reel-transition', 'down');
    });
    expect(screen.queryByTestId('yansi-desktop-summary-slot')).toBeNull();
    expect(screen.queryByTestId('yansi-desktop-detail-toggle')).toBeNull();
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: YANSI_REEL_TRAVEL_MS + 800 }
    );
    expect(screen.getByTestId('yansi-desktop-detail-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute('data-open', 'false');
  });

  it('chat does not mount travel surfaces or consume reel wheel', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.queryByTestId('yansi-desktop-reel-viewport')).toBeNull();
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    expect(vi.mocked(fetchDiscoverMirrors)).not.toHaveBeenCalled();
  });
});
