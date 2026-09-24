/**
 * Phase C — Reel title → Chat replay depth (mobile + desktop contracts).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import {
  buildYansiPublicHref,
  parseYansiPublicDepth,
  pushYansiChatDepth,
  returnToYansiReelDepth,
} from '@/lib/eza/mirror-network/yansiPublicDepth';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back, prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/m/yansi-b',
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
  fetchContinuationNeighbors: vi.fn(async () => ({
    ok: true,
    data: {
      slug: 'yansi-b',
      journeyVersion: 2,
      previous: null,
      next: { slug: 'yansi-c', journeyVersion: 1 },
    },
  })),
}));

vi.mock('@/lib/eza/mirror-network/landingAnalytics', () => ({
  trackLandingViewed: vi.fn(),
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact>
): PublicFrozenJourneyArtifact {
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: `Canonical ${slug}`,
    publicSummary: 'Trailer must stay out of Reel/Chat path.',
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    authorUserId: 'user-1',
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

describe('Phase C depth helpers', () => {
  it('invalid mode fails safely to reel', () => {
    expect(parseYansiPublicDepth('mode=weird')).toBe('reel');
    expect(parseYansiPublicDepth('mode=CHAT')).toBe('chat');
  });

  it('pushYansiChatDepth uses history.pushState', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    pushYansiChatDepth('/m/yansi-b?journeyVersion=2&mode=chat');
    expect(spy).toHaveBeenCalled();
    const state = spy.mock.calls[0]?.[0] as { yansiPublicDepth?: string };
    expect(state?.yansiPublicDepth).toBe('chat');
    expect(String(spy.mock.calls[0]?.[2])).toContain('mode=chat');
    spy.mockRestore();
  });

  it('returnToYansiReelDepth prefers history.back when chat was pushed', () => {
    const backSpy = vi.spyOn(window.history, 'back');
    window.history.pushState({ yansiPublicDepth: 'chat' }, '', '/m/yansi-b?mode=chat');
    const onDepthChange = vi.fn();
    returnToYansiReelDepth({
      reelHref: '/m/yansi-b?journeyVersion=2',
      onDepthChange,
    });
    expect(backSpy).toHaveBeenCalled();
    expect(onDepthChange).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });
});

describe('Phase C Reel → Chat → Reel', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    back.mockReset();
    searchParams = new URLSearchParams();
    window.history.replaceState({}, '', '/m/yansi-b?journeyVersion=2');
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact('yansi-b'));
  });

  it('A–I: title enters chat with PUSH; identity/scene unchanged', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const onDepthChange = vi.fn();
    const artifact = makeArtifact('yansi-b');
    const { rerender } = render(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    const title = await screen.findByTestId('mirror-yansi-active-title');
    expect(title.tagName).toBe('BUTTON');
    expect(title).toHaveAttribute('data-yansi-depth-trigger', 'chat');

    const sceneBefore = screen.getByTestId('mirror-yansi-scene-current').getAttribute('src');
    fireEvent.click(title);

    expect(onDepthChange).toHaveBeenCalledWith('chat');
    expect(pushState.mock.calls.some((c) => String(c[2] || '').includes('mode=chat'))).toBe(
      true
    );
    expect(buildYansiPublicHref('yansi-b', { journeyVersion: 2, mode: 'chat' })).toBe(
      '/m/yansi-b?journeyVersion=2&mode=chat'
    );
    pushState.mockRestore();

    rerender(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="chat"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-reel-nav',
      'locked'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      sceneBefore
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent(
      'Canonical yansi-b'
    );
    expect(screen.queryByText(/Trailer must stay out/i)).toBeNull();
    expect(screen.queryByTestId('mirror-experience-start')).toBeNull();
    expect(screen.queryByTestId('mirror-discover-nav')).toBeNull();
    expect(screen.getByTestId('mirror-frozen-replay')).toBeTruthy();
  });

  it('J–L: Chat → Back depth returns Reel with same slug/session', async () => {
    const artifact = makeArtifact('yansi-b');
    const onDepthChange = vi.fn();
    const { rerender } = render(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="chat"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-index',
      '0'
    );

    rerender(
      <MirrorYansiChainExperience
        rootArtifact={artifact}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('yansi-reel-preview-body');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-reel-nav',
      'open'
    );
    expect(screen.getByTestId('mirror-discover-nav')).toBeTruthy();
    expect(screen.queryByTestId('yansi-chat-replay-layer')).toBeNull();
  });

  it('P: direct mode=chat deep link opens chat over exact scene', async () => {
    searchParams = new URLSearchParams('journeyVersion=2&mode=chat');
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'yansi-b',
          cardTitle: 'Surface',
          cardDate: '2026-09-01',
          dayLabel: '1 Eylül',
          sceneImageUrl: 'https://cdn.example/surface.jpg',
          curiosityContext: 'Trailer must stay out of Reel/Chat path.',
        }}
      />
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-public-depth',
      'chat'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
    expect(screen.getByTestId('yansi-chat-scene-veil')).toHaveClass(
      'yansi-chat-scene-veil--active'
    );
  });

  it('T/U: Reel gestures locked during chat; Escape exits chat', async () => {
    const onDepthChange = vi.fn();
    // Ensure no leftover chat push-state so Escape uses replace + callback path.
    window.history.replaceState({}, '', '/m/yansi-b?journeyVersion=2&mode=chat');
    render(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b')}
        depth="chat"
        onDepthChange={onDepthChange}
      />
    );
    const chain = await screen.findByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-yansi-reel-nav', 'locked');

    fireEvent.keyDown(chain, { key: 'Escape' });
    await waitFor(() => {
      expect(onDepthChange).toHaveBeenCalledWith('reel');
    });
  });

  it('Y: no duplicate start gate in chat', async () => {
    render(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />
    );
    await screen.findByTestId('mirror-frozen-replay');
    expect(screen.queryByTestId('mirror-experience-start')).toBeNull();
    expect(screen.queryByText('Bu merakı deneyimle')).toBeNull();
    expect(screen.getByTestId('mirror-frozen-replay-next-question')).toBeTruthy();
  });
});

describe('Phase C desktop / CSS contracts', () => {
  it('Z/AA: chat reading width + stage CSS present; no brightness filter', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/yansi-reel-responsive.css'),
      'utf8'
    );
    expect(css).toContain('yansi-chat-replay-layer');
    expect(css).toContain('max-width: 42rem');
    expect(css).toContain('yansi-chat-scene-veil');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('yansi-desktop-cinematic-stage');
    expect(css).not.toContain('filter: brightness');
  });
});
