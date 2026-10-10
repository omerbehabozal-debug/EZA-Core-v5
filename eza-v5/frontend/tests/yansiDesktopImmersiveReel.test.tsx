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

const { compactShellMock } = vi.hoisted(() => ({
  compactShellMock: vi.fn(() => true),
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => compactShellMock(),
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
    compactShellMock.mockReset();
    compactShellMock.mockReturnValue(true);
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
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-crop',
      'shared-cover'
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
    expect(identity).toHaveAttribute('data-yansi-avatar-authority', 'canonical-profile');
    expect(identity).toHaveAttribute('data-yansi-author-id', 'user-1');
    expect(block).toHaveAttribute('data-yansi-copy-overlay', 'true');
    expect(block).toHaveClass('yansi-desktop-visual-stack');
    expect(title).toHaveClass('yansi-desktop-editorial-title');
    expect(title).toHaveClass('font-medium');
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
    expect(screen.getByRole('heading', { name: 'Canonical yansi-b' })).toHaveClass('saina-hero-title');
    expect(screen.getByTestId('yansi-chat-composer-lane')).toBeInTheDocument();
    expect(screen.getByTestId('yansi-chat-replay-layer')).toHaveAttribute(
      'data-yansi-conversation-lane',
      'true'
    );
    expect(screen.getByTestId('yansi-chat-replay-layer')).toHaveClass(
      'yansi-desktop-conversation-lane'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
    expect(screen.getByTestId('yansi-chat-scene-veil')).toHaveClass(
      'yansi-chat-scene-veil--active'
    );
  });

  it('Detay reveals the sealed canonical summary in place; title click still enters chat', async () => {
    const onDepthChange = vi.fn();
    const summary = 'Canonical sealed Ayna summary for this exact Yansı.';
    renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b', { publicSummary: summary })}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    const title = await screen.findByTestId('mirror-yansi-active-title');
    const toggle = screen.getByTestId('yansi-desktop-detail-toggle');
    expect(toggle).toHaveTextContent('Detay');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-detail-open',
      'false'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(screen.queryByText(/Sessizce/i)).toBeNull();

    fireEvent.click(toggle);
    const revealed = screen.getByTestId('yansi-desktop-canonical-summary');
    expect(revealed.tagName).toBe('P');
    expect(revealed).toHaveTextContent(summary);
    expect(toggle).toHaveTextContent('Gizle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-detail-open',
      'true'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).not.toHaveAttribute(
      'aria-hidden'
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(title).toHaveTextContent('Canonical yansi-b');
    expect(onDepthChange).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId('yansi-desktop-summary-slot')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(toggle).toHaveTextContent('Detay');
    expect(onDepthChange).not.toHaveBeenCalled();

    fireEvent.click(title);
    expect(onDepthChange).toHaveBeenCalledWith('chat');
  });

  it('keeps Detay off the mobile reel path', async () => {
    compactShellMock.mockReturnValue(false);
    renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b', {
          publicSummary: 'Canonical sealed Ayna summary for this exact Yansı.',
        })}
        depth="reel"
      />
    );
    await screen.findByTestId('mirror-yansi-active-title');
    expect(screen.queryByTestId('yansi-desktop-detail-toggle')).toBeNull();
    expect(screen.queryByTestId('yansi-desktop-canonical-summary')).toBeNull();
    expect(screen.queryByText(/Sessizce/i)).toBeNull();
  });

  it('hides Detay and the sealed summary in chat depth', async () => {
    renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b', {
          publicSummary: 'Canonical sealed Ayna summary for this exact Yansı.',
        })}
        depth="chat"
      />
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.queryByTestId('yansi-desktop-detail-toggle')).toBeNull();
    expect(screen.queryByTestId('yansi-desktop-canonical-summary')).toBeNull();
    expect(screen.queryByText(/Sessizce/i)).toBeNull();
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
    compactShellMock.mockReset();
    compactShellMock.mockReturnValue(true);
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
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: 2000 }
    );
    expect(vi.mocked(fetchDiscoverMirrors)).toHaveBeenCalledTimes(1);
  });

  it('reel wheel up commits exactly one goUp after a prior down', async () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(10_000);
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const chain = await screen.findByTestId('mirror-yansi-chain');
    wheel(chain, YANSI_WHEEL_COMMIT_PX);
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: 2000 }
    );
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
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: 2000 }
    );
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
    await waitFor(
      () => {
        expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
      },
      { timeout: 2000 }
    );
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
    expect(screen.queryByTestId('yansi-experience-controls')).toBeNull();
    expect(screen.getByTestId('yansi-reel-action-cluster')).toBeTruthy();
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
    expect(css).toContain('--yansi-scene-fit: cover');
    expect(css).toContain('--yansi-scene-pos-x: 63%');
    expect(css).toContain('--yansi-scene-pos-y: 46%');
    expect(css).toContain('--yansi-lane-max: 40.625rem');
    expect(css).toMatch(/\.yansi-desktop-scene-bleed[\s\S]*object-fit:\s*var\(--yansi-scene-fit\)/);
    expect(css).toMatch(/\.yansi-desktop-scene-image[\s\S]*object-fit:\s*var\(--yansi-scene-fit\)/);
    expect(css).toMatch(/\.yansi-desktop-scene-bleed[\s\S]*object-position:\s*var\(--yansi-scene-pos\)/);
    expect(css).toMatch(/\.yansi-desktop-scene-image[\s\S]*object-position:\s*var\(--yansi-scene-pos\)/);
    expect(css).toMatch(/\.yansi-desktop-scene-bleed[\s\S]*blur\(10px\)/);
    expect(css).toMatch(/\.yansi-desktop-scene-image[\s\S]*radial-gradient/);
    expect(css).toMatch(
      /\[data-yansi-public-depth='reel'\][\s\S]*\.yansi-desktop-scene-image[\s\S]*mask-image:\s*none/
    );
    expect(css).toMatch(
      /\[data-yansi-public-depth='reel'\][\s\S]*\.yansi-desktop-scene-blend[\s\S]*opacity:\s*0/
    );
    expect(css).toContain("data-saina-view='yansi'] .saina-canvas");
    expect(css).toContain('position: absolute');
    expect(css).toContain('inset: 0');
    expect(css).toMatch(/\.yansi-desktop-reel-root[\s\S]*inset:\s*0/);
    expect(css).toContain('saina-canvas::after');
    expect(css).toContain('--saina-sidebar-fade-width: clamp(260px, 22vw, 360px)');
    expect(css).toContain('yansi-desktop-atmosphere');
    expect(css).toContain('rgba(7, 8, 8, 0.96)');
    expect(css).toContain('rgba(7, 8, 8, 0.78)');
    expect(css).toContain('rgba(7, 8, 8, 0.52)');
    expect(css).toContain('rgba(7, 8, 8, 0.30)');
    expect(css).toContain('border-right-color: transparent');
    expect(css).not.toContain('content: none !important');
    expect(css).not.toContain('rgba(12, 14, 14, 0.88)');
    expect(css).not.toContain('width: 160px');
    expect(css).toContain('--bilign-yansi-reel-title-size: 35px');
    expect(css).toContain('font-size: var(--bilign-yansi-reel-title-size)');
    expect(css).toContain('--bilign-yansi-reel-title-line-height: 1.1');
    expect(css).toContain('--bilign-yansi-conversation-title-size: 24px');
    expect(css).not.toContain('clamp(2.5rem, 2.85vw, 2.625rem)');
    expect(css).toContain('clamp(3.5rem, 4.15vw, 4rem)');
    expect(css).toContain('clamp(4.75rem, 9.2vh, 5.5rem)');
    expect(css).toContain('--yansi-editorial-top-safe: 4.25rem');
    expect(css).toMatch(
      /\.yansi-desktop-identity__avatar\.bilign-profile-avatar--sm[\s\S]*width:\s*var\(--bilign-avatar-publisher\)/
    );
    const reelSurface = readFileSync(
      join(process.cwd(), 'components/mirror-landing/YansiDesktopReelSurface.tsx'),
      'utf8'
    );
    const chain = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorYansiChainExperience.tsx'),
      'utf8'
    );
    expect(reelSurface).toContain('data-bilign-identity-role="publisher"');
    expect(reelSurface).toContain('variant="publisher"');
    expect(reelSurface).toContain('BilignAvatarIdentityFrame');
    expect(chain).toContain('data-bilign-identity-role="primary"');
    expect(chain).toContain('size="hero"');
    expect(chain).toContain('BilignAvatarIdentityFrame');
    expect(css).toContain('calc(4.2rem + var(--bilign-avatar-primary) + 5.5rem)');
    expect(css).not.toContain('font-size: 0.84rem');
    expect(css).not.toContain('clamp(4.5rem, 8vh, 6.25rem)');
    expect(css).not.toMatch(
      /\[data-yansi-detail-open='true'\][\s\S]{0,120}overflow-y:\s*auto/
    );
    expect(css).toContain('yansi-desktop-detail-toggle');
    expect(css).toContain('yansi-desktop-canonical-summary');
    expect(css).toContain('yansi-desktop-summary-slot');
    expect(css).toContain('yansi-desktop-reel-viewport');
    expect(css).toContain('yansi-desktop-reel-surface');
    expect(css).toContain('translateY(-100%)');
    expect(css).toContain('translateY(100%)');
    expect(css).toContain('560ms cubic-bezier(0.22, 1, 0.36, 1)');
    expect(css).toMatch(
      /\[data-yansi-public-depth='reel'\][\s\S]*mirror-yansi-chain-scroll[\s\S]*pointer-events:\s*none/
    );
    expect(css).toContain('max-width: 35.375rem');
    expect(css).toContain('grid-template-rows: 0fr');
    expect(css).toContain('grid-template-rows: 1fr');
    expect(css).toMatch(
      /\.yansi-desktop-visual-stack\[data-yansi-title-position='lower'\][\s\S]*background:\s*none/
    );
    expect(css).toMatch(
      /\.yansi-desktop-atmosphere[\s\S]*radial-gradient/
    );
    expect(css).toContain('--yansi-editorial-field-width: clamp(47.5rem, 58vw, 56.25rem)');
    expect(css).toContain('--yansi-editorial-field-height: clamp(26.875rem, 52vh, 32.5rem)');
    expect(css).toContain('rgba(4, 5, 5, 0.70)');
    expect(css).toContain('--yansi-reel-ink-title: rgba(247, 240, 228, 0.98)');
    expect(css).toContain('--yansi-reel-ink-primary: rgba(247, 240, 228, 0.95)');
    expect(css).toContain('--yansi-reel-ink-honorific: rgba(236, 226, 210, 0.84)');
    expect(css).toContain('--yansi-reel-ink-meta: rgba(236, 226, 210, 0.82)');
    expect(css).toContain('--yansi-reel-ink-tertiary: rgba(232, 220, 202, 0.78)');
    expect(css).toContain('--yansi-reel-ink-action: rgba(214, 176, 118, 0.92)');
    expect(css).toContain('--yansi-reel-ink-summary: rgba(245, 234, 216, 0.90)');
    expect(css).toContain("content: ' \u2304'");
    expect(css).toContain("content: ' \u2303'");
    expect(css).toContain('0 1px 1px rgba(0, 0, 0, 0.42)');
    expect(css).toContain('0 1px 3px rgba(0, 0, 0, 0.18)');
    expect(css).toContain('--yansi-reel-meta-shadow');
    expect(css).not.toContain('0 1px 12px rgba(9, 11, 11, 0.45)');
    expect(css).not.toContain('Sessizce');
    expect(css).toMatch(/\.yansi-desktop-visual-stack[\s\S]*position:\s*absolute/);
    expect(css).toContain('yansi-desktop-editorial-title');
    expect(css).toContain('.yansi-chat-composer-lane');
    expect(css).toMatch(
      /\[data-yansi-public-depth='chat'\][\s\S]*\.yansi-desktop-scene-image[\s\S]*opacity:\s*0\.64/
    );
    expect(css).toMatch(
      /\[data-yansi-public-depth='chat'\][\s\S]*\.yansi-desktop-scene-image[\s\S]*blur\(2\.5px\)/
    );
    expect(css).not.toContain('html:has([data-mirror-landing-layout])');
    expect(css).not.toContain('max-width: min(920px, 100%)');
    expect(css).not.toContain('max-width: min(720px, 92vw)');
    expect(css).not.toContain('34rem');
    expect(css).not.toContain('68vh');
    expect(css).not.toContain('blur(26px)');
    expect(css).not.toContain('blur(18px)');
    expect(css).not.toContain('scale(1.1)');
    expect(css).not.toContain('mask-composite: intersect');
    expect(css).not.toContain('height: 74%');
    expect(railCss).toMatch(/\.yansi-exp-rail[\s\S]*position:\s*absolute/);
    expect(railCss).toMatch(/\.yansi-exp-rail[\s\S]*right:\s*1\.25rem/);
    expect(railCss).not.toContain('position: fixed');
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(mobileBlock).toContain('.yansi-mobile-fullscreen');
    expect(mobileBlock).toContain('.yansi-mobile-title-block');
    expect(mobileBlock).not.toContain('yansi-desktop-scene-bleed');
    expect(mobileBlock).not.toContain('yansi-desktop-editorial-title');
    expect(mobileBlock).not.toContain('yansi-chat-composer-lane');
    expect(mobileBlock).not.toContain('--yansi-scene-pos-x');
    expect(mobileBlock).not.toContain('40.625rem');
    expect(mobileBlock).not.toContain('blur(10px)');
    expect(mobileBlock).not.toContain('yansi-desktop-detail-toggle');
    expect(mobileBlock).not.toContain('yansi-desktop-canonical-summary');
    expect(mobileBlock).not.toContain('yansi-desktop-proof-row');
    expect(mobileBlock).not.toContain('yansi-desktop-summary-slot');
    expect(mobileBlock).not.toContain("mask-image: none");
    expect(mobileBlock).not.toContain('yansi-desktop-reel-viewport');
    expect(mobileBlock).not.toContain('yansi-desktop-reel-surface');
    expect(mobileBlock).not.toContain('translateY(-100%)');
    expect(mobileBlock).not.toContain('2.875rem');
    expect(mobileBlock).not.toContain('19.375rem');
    expect(mobileBlock).not.toContain('21.875rem');
    expect(mobileBlock).not.toContain('clamp(3.5rem, 4.15vw, 4rem)');
    expect(mobileBlock).not.toContain('yansi-desktop-identity__copy');
    expect(mobileBlock).not.toContain('--saina-sidebar-fade-width: clamp(260px, 22vw, 360px)');
    expect(mobileBlock).not.toContain('rgba(7, 8, 8, 0.96)');
    expect(mobileBlock).not.toContain('rgba(4, 5, 5, 0.70)');
    expect(mobileBlock).not.toContain('yansi-desktop-atmosphere');
    expect(mobileBlock).not.toContain('clamp(47.5rem, 58vw, 56.25rem)');
    expect(mobileBlock).not.toContain('border-right-color: transparent');
    expect(mobileBlock).not.toContain('--yansi-reel-ink-primary');
    expect(mobileBlock).not.toContain('--yansi-reel-ink-title');
    expect(mobileBlock).not.toContain('--yansi-reel-meta-shadow');
    expect(mobileBlock).not.toContain('35.375rem');
    expect(mobileBlock).not.toContain('clamp(2.75rem, 3.2vw, 3.125rem)');
    expect(mobileBlock).not.toContain('clamp(2.5rem, 2.85vw, 2.625rem)');
  });
});
