/**
 * Phase D — Chat replay end decision:
 * PRIMARY "Kendi merakımla devam et" → own /sohbet
 * SECONDARY "Başka bir merak keşfet" → SAME Reel (canonical Chat→Reel exit)
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import {
  YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA,
  YANSI_OWN_CONTINUATION_CTA,
  YANSI_SKIP_TO_NEXT_MERAK,
} from '@/lib/eza/mirror/copy';
import {
  clearAllFrozenReplayProgressForTests,
  loadFrozenReplayProgress,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { buildYansiPublicHref } from '@/lib/eza/mirror-network/yansiPublicDepth';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back, prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/m/yansi-d2',
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => false,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, isAuthReady: true, user: null }),
}));

vi.mock('@/lib/eza/mirror/journey', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/mirror/journey')>(
    '@/lib/eza/mirror/journey'
  );
  return {
    ...actual,
    fetchPublicFrozenJourneyArtifact: vi.fn(),
  };
});

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
    resolvePublicAuthorIdentity: async () => ({
      displayName: 'Author',
      publicHonorific: '',
      publicAvatarUrl: null,
      publicAvatarRevision: null,
    }),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async (slug: string) => ({
    ok: true,
    data: {
      slug,
      journeyVersion: 2,
      previous: null,
      next: { slug: 'yansi-c', journeyVersion: 1 },
    },
  })),
}));

vi.mock('@/lib/eza/mirror/journey/fetchNextDiscoverCandidate', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/eza/mirror/journey/fetchNextDiscoverCandidate')
  >();
  return {
    ...actual,
    fetchNextDiscoverCandidate: vi.fn(async () => ({
      ok: false as const,
      exhausted: true,
      nextOffset: 0,
    })),
  };
});

vi.mock('@/lib/eza/mirror-network/landingAnalytics', () => ({
  trackLandingViewed: vi.fn(),
  trackLandingCtaClicked: vi.fn(),
}));

vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({
  trackSeedStart: vi.fn(),
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey';
import { fetchNextDiscoverCandidate } from '@/lib/eza/mirror/journey/fetchNextDiscoverCandidate';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact>
): PublicFrozenJourneyArtifact {
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: `Canonical ${slug}`,
    publicSummary: 'Trailer stays on Discover only.',
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    authorUserId: 'user-1',
    selectedCount: 2,
    steps: [
      { stepIndex: 1, publicQuestion: 'Q1?', publicAnswer: 'A1' },
      { stepIndex: 2, publicQuestion: 'Q2?', publicAnswer: 'A2' },
    ],
    publishedAt: '2026-09-01T12:00:00.000Z',
    replayReady: true,
    ...overrides,
  };
}

function seedCompleted(slug: string, journeyVersion = 2) {
  localStorage.setItem(
    `eza_frozen_replay_progress_v1:${slug}:v${journeyVersion}`,
    JSON.stringify({
      slug,
      journeyVersion,
      completedStepCount: 2,
      replayCompleted: true,
    })
  );
}

beforeEach(() => {
  clearAllFrozenReplayProgressForTests();
  localStorage.clear();
  push.mockReset();
  replace.mockReset();
  back.mockReset();
  searchParams = new URLSearchParams();
  window.history.replaceState({}, '', '/m/yansi-d2?journeyVersion=2');
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchNextDiscoverCandidate).mockClear();
});

describe('Phase D end decision surface', () => {
  it('A–E: completion shows primary + secondary; no auto-nav / old next copy', async () => {
    const artifact = makeArtifact('yansi-d2');
    seedCompleted('yansi-d2');
    const onExplore = vi.fn();
    render(
      <MirrorFrozenReplay artifact={artifact} onExploreAnotherCuriosity={onExplore} />
    );
    const end = await screen.findByTestId('mirror-frozen-replay-complete');
    expect(within(end).getByTestId('mirror-frozen-replay-continue')).toHaveTextContent(
      YANSI_OWN_CONTINUATION_CTA
    );
    expect(within(end).getByTestId('mirror-frozen-replay-explore-another')).toHaveTextContent(
      YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA
    );
    expect(within(end).queryByText(YANSI_SKIP_TO_NEXT_MERAK)).toBeNull();
    expect(within(end).queryByText(/Başka sohbete geç/i)).toBeNull();
    expect(within(end).queryByText(/Aşağı kaydırarak/i)).toBeNull();
    expect(onExplore).not.toHaveBeenCalled();
    expect(fetchNextDiscoverCandidate).not.toHaveBeenCalled();
  });

  it('Q–U: CTA A routes to exact-slug /sohbet origin', async () => {
    const artifact = makeArtifact('yansi-d2');
    seedCompleted('yansi-d2');
    render(<MirrorFrozenReplay artifact={artifact} />);
    const link = await screen.findByTestId('mirror-frozen-replay-continue');
    expect(link).toHaveAttribute('href', '/m/yansi-d2/sohbet');
    expect(link).toHaveTextContent(YANSI_OWN_CONTINUATION_CTA);
    expect(screen.getByTestId('mirror-frozen-replay')).toHaveAttribute(
      'data-journey-version',
      '2'
    );
  });
});

describe('Phase D CTA B → same Reel', () => {
  it('F–N: CTA B exits chat via helper; identity/session intact; no goDown/fetch', async () => {
    const artifact = makeArtifact('yansi-d2');
    seedCompleted('yansi-d2');
    const onDepthChange = vi.fn();
    // Deep-link style: no push state → replace + callback path (no new Reel entry).
    window.history.replaceState({}, '', '/m/yansi-d2?journeyVersion=2&mode=chat');
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    const { rerender } = render(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="chat"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('mirror-frozen-replay-complete');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-d2'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-d2.jpg'
    );
    const discoveryBefore = screen
      .getByTestId('mirror-yansi-chain')
      .getAttribute('data-discovery-index');

    fireEvent.click(screen.getByTestId('mirror-frozen-replay-explore-another'));
    await waitFor(() => {
      expect(onDepthChange).toHaveBeenCalledWith('reel');
    });

    // No PUSH of a new Reel entry on top of Chat.
    expect(
      pushState.mock.calls.some((c) => {
        const url = String(c[2] || '');
        return url.includes('/m/yansi-d2') && !url.includes('mode=chat');
      })
    ).toBe(false);
    expect(
      replaceState.mock.calls.some((c) =>
        String(c[2] || '').includes(buildYansiPublicHref('yansi-d2', { journeyVersion: 2 }))
      )
    ).toBe(true);

    expect(fetchNextDiscoverCandidate).not.toHaveBeenCalled();

    rerender(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('yansi-reel-preview-body');
    const chain = screen.getByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-d2');
    expect(chain).toHaveAttribute('data-yansi-public-depth', 'reel');
    expect(chain).toHaveAttribute('data-yansi-reel-nav', 'open');
    expect(chain).toHaveAttribute('data-discovery-index', discoveryBefore);
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-d2.jpg'
    );
    expect(screen.getByTestId('mirror-discover-nav')).toBeTruthy();
    expect(screen.queryByTestId('yansi-chat-replay-layer')).toBeNull();
    expect(screen.getByTestId('yansi-chat-scene-veil')).toHaveClass(
      'yansi-chat-scene-veil--idle'
    );
    // Progress preserved for Chat round-trip.
    expect(loadFrozenReplayProgress('yansi-d2', 2)?.replayCompleted).toBe(true);

    pushState.mockRestore();
    replaceState.mockRestore();
  });

  it('P: direct mode=chat deep link → CTA B replace-exits to Reel', async () => {
    searchParams = new URLSearchParams('journeyVersion=2&mode=chat');
    seedCompleted('yansi-d2');
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-d2'));
    window.history.replaceState({}, '', '/m/yansi-d2?journeyVersion=2&mode=chat');

    render(
      <MirrorLandingExperience
        surface={{
          slug: 'yansi-d2',
          cardTitle: 'Surface',
          cardDate: '2026-09-01',
          dayLabel: '1 Eylül',
          sceneImageUrl: 'https://cdn.example/surface.jpg',
          curiosityContext: 'Trailer stays on Discover only.',
        }}
      />
    );
    await screen.findByTestId('mirror-frozen-replay-explore-another');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-public-depth',
      'chat'
    );

    fireEvent.click(screen.getByTestId('mirror-frozen-replay-explore-another'));
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-yansi-public-depth',
        'reel'
      );
    });
    expect(window.location.pathname + window.location.search).toBe(
      '/m/yansi-d2?journeyVersion=2'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-d2.jpg'
    );
  });

  it('O: PUSH chat → CTA B prefers history.back (no stacked Reel)', async () => {
    const artifact = makeArtifact('yansi-d2');
    seedCompleted('yansi-d2');
    const onDepthChange = vi.fn();
    window.history.replaceState({}, '', '/m/yansi-d2?journeyVersion=2');
    window.history.pushState(
      { yansiPublicDepth: 'chat' },
      '',
      '/m/yansi-d2?journeyVersion=2&mode=chat'
    );
    const backSpy = vi.spyOn(window.history, 'back');
    const pushState = vi.spyOn(window.history, 'pushState');

    render(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="chat"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('mirror-frozen-replay-explore-another');
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-explore-another'));
    expect(backSpy).toHaveBeenCalled();
    // When push-state unwind is used, depth change comes from popstate — not callback.
    expect(onDepthChange).not.toHaveBeenCalled();
    expect(
      pushState.mock.calls.filter((c) => !String(c[2] || '').includes('mode=chat')).length
    ).toBe(0);

    backSpy.mockRestore();
    pushState.mockRestore();
  });
});

describe('Phase D mobile/desktop contracts', () => {
  it('V–Z / AA–AB: end decision CSS + scene continuity hooks', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/yansi-reel-responsive.css'),
      'utf8'
    );
    const replay = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorFrozenReplay.tsx'),
      'utf8'
    );
    const chain = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorYansiChainExperience.tsx'),
      'utf8'
    );
    expect(css).toContain('yansi-chat-end-decision');
    expect(css).toContain('max-width: 42rem');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('yansi-desktop-cinematic-stage');
    expect(replay).toContain('onExploreAnotherCuriosity');
    expect(replay).toContain('YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA');
    expect(replay).not.toContain('Aşağı kaydırarak diğer yolları keşfedebilirsin');
    expect(replay).not.toContain('Başka sohbete geç');
    expect(chain).toContain('onExploreAnotherCuriosity={exitChatDepth}');
    expect(chain).toContain('returnToYansiReelDepth');
    expect(chain).toContain('preventScroll: true');
  });

  it('X–Y / AC–AD: after CTA B, Reel nav is open (gestures/keys resume)', async () => {
    const artifact = makeArtifact('yansi-d2');
    seedCompleted('yansi-d2');
    const { rerender } = render(
      <MirrorYansiChainExperience rootArtifact={artifact} depth="chat" />
    );
    await screen.findByTestId('mirror-frozen-replay-complete');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-reel-nav',
      'locked'
    );
    rerender(<MirrorYansiChainExperience rootArtifact={artifact} depth="reel" />);
    await screen.findByTestId('mirror-discover-nav');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-reel-nav',
      'open'
    );
    expect(screen.getByTestId('mirror-skip-to-next')).toBeTruthy();
    expect(screen.getByTestId('mirror-continuation-next')).toBeTruthy();
  });
});
