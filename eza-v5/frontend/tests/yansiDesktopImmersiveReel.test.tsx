/**
 * Desktop ≥900 public Yansı — immersive scene, wheel ownership, reel→chat.
 */
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { YANSI_WHEEL_COMMIT_PX } from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back, prefetch: vi.fn() }),
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
      next: null,
    },
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

function wheel(target: Element, deltaY: number) {
  fireEvent.wheel(target, { deltaY, bubbles: true, cancelable: true });
}

function renderChain(ui: ReactElement, slug = 'yansi-b') {
  return render(
    <YansiExperienceSessionProvider slug={slug}>{ui}</YansiExperienceSessionProvider>
  );
}

describe('desktop immersive presentation', () => {
  beforeEach(() => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug)
    );
    vi.mocked(fetchDiscoverMirrors).mockReset();
  });

  it('uses immersive bleed + sharp plate, not the old contained-card stage', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-yansi-reel-presentation', 'desktop-immersive');
    expect(chain).not.toHaveAttribute('data-yansi-reel-presentation', 'desktop-stage');
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-presentation',
      'desktop-immersive'
    );
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-slug',
      'yansi-b'
    );
    const bleed = document.querySelector('.yansi-desktop-scene-bleed');
    expect(bleed).toBeTruthy();
    expect(bleed).toHaveAttribute('data-yansi-layer', 'atmosphere');
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveClass(
      'yansi-desktop-scene-image'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'data-yansi-plate',
      'sharp'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).not.toHaveClass('object-cover');
  });

  it('places identity/title as a canvas overlay, not document-flow metadata', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await screen.findByTestId('yansi-desktop-identity');
    const identity = screen.getByTestId('yansi-desktop-identity');
    const title = screen.getByTestId('mirror-yansi-active-title');
    const block = screen.getByTestId('yansi-title-block');
    expect(identity.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block).toHaveAttribute('data-yansi-copy-overlay', 'true');
    expect(block).toHaveClass('yansi-desktop-visual-stack');
    expect(title).toHaveClass('yansi-desktop-editorial-title');
    expect(screen.getByTestId('mirror-yansi-chain-scroll').contains(block)).toBe(false);
    expect(screen.getByTestId('mirror-yansi-chain').contains(block)).toBe(true);
    expect(screen.queryByText(/Merakıma ekle|Meraklarımda/)).toBeNull();
  });

  it('title activation stays on shared reel → chat depth without changing Yansı', async () => {
    const onDepthChange = vi.fn();
    const { rerender } = renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b')}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    await screen.findByTestId('mirror-yansi-active-title');
    fireEvent.click(screen.getByTestId('mirror-yansi-active-title'));
    expect(onDepthChange).toHaveBeenCalledWith('chat');
    rerender(
      <YansiExperienceSessionProvider slug="yansi-b">
        <MirrorYansiChainExperience
          rootArtifact={makeArtifact('yansi-b')}
          depth="chat"
          onDepthChange={onDepthChange}
        />
      </YansiExperienceSessionProvider>
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-title-position',
      'elevated'
    );
    expect(screen.getByTestId('yansi-chat-replay-layer')).toHaveAttribute(
      'data-yansi-chat-scroll',
      'true'
    );
  });

  it('returning from chat restores the same Yansı/index', async () => {
    const { rerender } = renderChain(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />
    );
    await screen.findByTestId('mirror-yansi-chain');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-index',
      '0'
    );
    rerender(
      <YansiExperienceSessionProvider slug="yansi-b">
        <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />
      </YansiExperienceSessionProvider>
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-discovery-index',
      '0'
    );
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-title-position',
      'lower'
    );
  });
});

describe('desktop reel wheel ownership', () => {
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
            title: 'X',
            sceneImageUrl: 'https://cdn.example/x.jpg',
            yansiCount: 0,
          },
        ],
        total: 8,
        mode: 'random',
        randomSession: 'session-desktop-wheel',
        strongCuriosityReady: false,
      },
    });
  });

  it('reel wheel down commits exactly one goDown', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    });
    expect(vi.mocked(fetchDiscoverMirrors)).toHaveBeenCalledTimes(1);
  });

  it('reel wheel up commits exactly one goUp after a prior down', async () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(10_000);
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    });
    now.mockReturnValue(10_000 + 800);
    wheel(chain, -(YANSI_WHEEL_COMMIT_PX + 40));
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    });
    now.mockRestore();
  });

  it('trackpad momentum cannot skip multiple Yansıs', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    wheel(chain, 400);
    wheel(chain, 400);
    wheel(chain, 400);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    });
    expect(vi.mocked(fetchDiscoverMirrors)).toHaveBeenCalledTimes(1);
  });

  it('chat disables Yansı wheel navigation and keeps conversation scroll marked', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    await screen.findByTestId('yansi-chat-replay-layer');
    wheel(chain, 900);
    wheel(chain, 900);
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(vi.mocked(fetchDiscoverMirrors)).not.toHaveBeenCalled();
    expect(screen.getByTestId('yansi-chat-replay-layer')).toHaveAttribute(
      'data-yansi-chat-scroll',
      'true'
    );
  });

  it('after A → B commit, image + title + author + meta + rail all belong to B', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    });
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-slug',
      'yansi-x'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-x.jpg'
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveAttribute(
      'data-slug',
      'yansi-x'
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent(
      'Canonical yansi-x'
    );
    expect(screen.getByTestId('yansi-desktop-identity')).toHaveAttribute(
      'data-yansi-active-identity',
      'yansi-x'
    );
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-active-identity',
      'yansi-x'
    );
    expect(screen.getByTestId('yansi-experience-controls')).toHaveAttribute(
      'data-yansi-active-identity',
      'yansi-x'
    );
    expect(screen.getByTestId('yansi-experience-controls')).toHaveAttribute(
      'data-yansi-rail-scope',
      'canvas'
    );
  });
});

describe('desktop CSS + mobile freeze contracts', () => {
  it('desktop CSS is immersive and mobile 899 block stays cover/fullscreen', () => {
    const css = readFileSync(join(process.cwd(), 'styles/yansi-reel-responsive.css'), 'utf8');
    const railCss = readFileSync(join(process.cwd(), 'styles/yansi-experience-controls.css'), 'utf8');
    expect(css).toContain('yansi-desktop-scene-bleed');
    expect(css).toContain('yansi-desktop-visual-stack');
    expect(css).toContain('.yansi-desktop-reel-root');
    expect(css).toMatch(/\.yansi-desktop-reel-root[\s\S]*overflow:\s*hidden/);
    expect(css).toContain("[data-saina-view='yansi'] .saina-yansi-canvas-wrap");
    expect(css).toMatch(/\.yansi-desktop-scene-bleed[\s\S]*inset:\s*0/);
    expect(css).toMatch(/\.yansi-desktop-scene-bleed[\s\S]*object-fit:\s*cover/);
    expect(css).toMatch(/\.yansi-desktop-scene-image[\s\S]*object-fit:\s*contain/);
    expect(css).toMatch(/\.yansi-desktop-scene-image[\s\S]*height:\s*74%/);
    expect(css).toContain("data-saina-view='yansi'] .saina-canvas");
    expect(css).toContain('position: absolute');
    expect(css).toContain('inset: 0');
    expect(css).toMatch(/\.yansi-desktop-reel-root[\s\S]*inset:\s*0/);
    expect(css).toContain('saina-canvas::after');
    expect(css).toContain("content: none !important");
    expect(css).toContain('clamp(2rem, 2.4vw, 3.25rem)');
    expect(css).toMatch(/\.yansi-desktop-visual-stack[\s\S]*position:\s*absolute/);
    expect(css).toContain('yansi-desktop-editorial-title');
    expect(css).not.toContain('html:has([data-mirror-landing-layout])');
    expect(css).not.toContain('max-width: min(920px, 100%)');
    expect(css).not.toContain('max-width: min(720px, 92vw)');
    expect(css).not.toContain('34rem');
    expect(css).not.toContain('68vh');
    expect(railCss).toMatch(/\.yansi-exp-rail[\s\S]*position:\s*absolute/);
    expect(railCss).not.toContain('position: fixed');
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(mobileBlock).toContain('.yansi-mobile-fullscreen');
    expect(mobileBlock).toContain('.yansi-mobile-title-block');
    expect(mobileBlock).not.toContain('yansi-desktop-scene-bleed');
    expect(mobileBlock).not.toContain('yansi-desktop-editorial-title');
  });
});
