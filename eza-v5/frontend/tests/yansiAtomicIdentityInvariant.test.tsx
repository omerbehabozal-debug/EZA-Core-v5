/**
 * Atomic Yansı identity — title/image/conversation/artifact cannot diverge.
 */
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { YANSI_WHEEL_COMMIT_PX } from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';
import {
  assertYansiAtomicIdentity,
  readYansiAtomicIdentity,
  yansiIdentityMismatch,
} from '@/lib/eza/mirror/journey/yansiAtomicIdentity';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
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
    resolvePublicAuthorIdentity: async (userId?: string | null) => ({
      displayName: userId === 'user-a' ? 'Author A' : 'Author B',
      publicHonorific: '',
      publicAvatarUrl: null,
      publicAvatarRevision: null,
    }),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async () => ({
    ok: true,
    data: { slug: 'yansi-a', journeyVersion: 2, previous: null, next: null },
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

const ASSET_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ASSET_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeArtifact(
  slug: 'yansi-a' | 'yansi-b',
  overrides?: Partial<PublicFrozenJourneyArtifact>
): PublicFrozenJourneyArtifact {
  const isA = slug === 'yansi-a';
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: isA ? 'Kişilik ve Değişim' : 'Beynin Gece Çalışması',
    publicSummary: isA ? 'Summary A' : 'Summary B',
    sceneImageUrl: isA
      ? `https://cdn.example/mirror-scene-assets/${ASSET_A}.png`
      : `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`,
    artifactId: isA ? 'pub-a' : 'pub-b',
    generationId: isA ? 'gen-a' : 'gen-b',
    sceneAssetId: isA ? ASSET_A : ASSET_B,
    sourceConversationId: isA ? 'conv-a' : 'conv-b',
    authorUserId: isA ? 'user-a' : 'user-b',
    selectedCount: 6,
    steps: Array.from({ length: 6 }, (_, index) => ({
      stepIndex: index + 1,
      publicQuestion: `${slug} Q${index + 1}?`,
      publicAnswer: `${slug} A${index + 1}`,
    })),
    publishedAt: '2026-09-01T12:00:00.000Z',
    replayReady: true,
    ...overrides,
  };
}

function renderChain(ui: ReactElement, slug: 'yansi-a' | 'yansi-b') {
  return render(
    <YansiExperienceSessionProvider slug={slug}>{ui}</YansiExperienceSessionProvider>
  );
}

describe('yansi atomic identity unit', () => {
  it('rejects a rendered scene from another Yansı', () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b');
    expect(
      yansiIdentityMismatch(a, { renderedSceneUrl: b.sceneImageUrl })
    ).toBe('scene_mismatch');
    expect(
      yansiIdentityMismatch(b, {
        expectedSlug: 'yansi-b',
        renderedTitle: b.publicTitle,
        renderedSceneUrl: b.sceneImageUrl,
      })
    ).toBeNull();
  });

  it('parses identity keys onto the public artifact', () => {
    const parsed = parsePublicFrozenJourneyArtifact(makeArtifact('yansi-b'));
    expect(parsed?.generationId).toBe('gen-b');
    expect(parsed?.sceneAssetId).toBe(ASSET_B);
    expect(parsed?.sourceConversationId).toBe('conv-b');
    const tuple = readYansiAtomicIdentity(parsed!);
    expect(tuple.imageAssetId).toBe(ASSET_B);
    expect(() =>
      assertYansiAtomicIdentity(parsed!, {
        expectedSlug: 'yansi-b',
        renderedTitle: 'Beynin Gece Çalışması',
        renderedSceneUrl: parsed!.sceneImageUrl,
      })
    ).not.toThrow();
  });
});

describe('A → B identity commit', () => {
  beforeEach(() => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug as 'yansi-a' | 'yansi-b')
    );
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            title: 'Beynin Gece Çalışması',
            sceneImageUrl: `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`,
            yansiCount: 0,
          },
        ],
        total: 8,
        mode: 'random',
        randomSession: 'session-identity',
        strongCuriosityReady: false,
      },
    });
  });

  it('keeps B title + image + conversation + artifact together after Discover DOWN, chat, and back', async () => {
    const { rerender } = renderChain(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} depth="reel" />,
      'yansi-a'
    );
    const chain = await screen.findByTestId('mirror-yansi-chain');
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await waitFor(() => {
      expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    });
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent(
      'Beynin Gece Çalışması'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`
    );
    expect(chain).toHaveAttribute('data-yansi-identity-slug', 'yansi-b');
    expect(chain).toHaveAttribute('data-yansi-identity-generation', 'gen-b');
    expect(chain).toHaveAttribute('data-yansi-identity-asset', ASSET_B);
    expect(chain).toHaveAttribute('data-yansi-identity-conversation', 'conv-b');
    expect(screen.queryByText('Kişilik ve Değişim')).toBeNull();
    expect(
      screen.getByTestId('mirror-yansi-scene-current').getAttribute('src')
    ).not.toContain(ASSET_A);

    rerender(
      <YansiExperienceSessionProvider slug="yansi-b">
        <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />
      </YansiExperienceSessionProvider>
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent(
      'Beynin Gece Çalışması'
    );

    rerender(
      <YansiExperienceSessionProvider slug="yansi-b">
        <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />
      </YansiExperienceSessionProvider>
    );
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-yansi-identity-slug',
      'yansi-b'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`
    );
  });

  it('cold-loads /m/B without selecting any A asset', async () => {
    renderChain(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />,
      'yansi-b'
    );
    await screen.findByTestId('mirror-yansi-chain');
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent(
      'Beynin Gece Çalışması'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      `https://cdn.example/mirror-scene-assets/${ASSET_B}.png`
    );
    expect(document.documentElement.innerHTML).not.toContain(ASSET_A);
    expect(screen.queryByText('Kişilik ve Değişim')).toBeNull();
  });
});

describe('scene crossfade identity bind', () => {
  it('does not keep A as the current plate after B commits with no scene', () => {
    const { rerender } = render(
      <MirrorYansiSceneCrossfade
        sceneImageUrl={`https://cdn.example/mirror-scene-assets/${ASSET_A}.png`}
        activeIdentity="yansi-a"
        presentation="desktop-immersive"
      />
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      `https://cdn.example/mirror-scene-assets/${ASSET_A}.png`
    );
    rerender(
      <MirrorYansiSceneCrossfade
        sceneImageUrl={null}
        activeIdentity="yansi-b"
        presentation="desktop-immersive"
      />
    );
    expect(screen.queryByTestId('mirror-yansi-scene-current')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute(
      'data-yansi-scene-slug',
      'yansi-b'
    );
  });
});
