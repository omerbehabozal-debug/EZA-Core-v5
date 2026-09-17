/**
 * P2 — Audio belongs to exact active Yansı.
 * Provider slug is entry root; active slug can change without remounting the provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
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

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async (slug: string) => ({
    ok: true as const,
    data: {
      slug,
      journeyVersion: 1,
      previous: null,
      next: null,
    },
  })),
}));

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
import { fetchContinuationNeighbors } from '@/lib/eza/mirror-network/fetchContinuationNeighbors';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  speakYansiAnswer,
} from '@/lib/eza/mirror/yansiSpeech';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import {
  YansiExperienceSessionProvider,
  useYansiExperienceSession,
} from '@/components/mirror-landing/YansiExperienceSession';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';

const root = join(process.cwd());
function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

function makeArtifact(slug: string): PublicFrozenJourneyArtifact {
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    parentSlug: null,
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
      previous: previous ? { slug: previous, journeyVersion: 1 } : null,
      next: next ? { slug: next, journeyVersion: 1 } : null,
    },
  };
}

function installSpeech() {
  const speak = vi.fn();
  const cancel = vi.fn();
  class Utterance {
    text: string;
    lang = '';
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    writable: true,
    value: { speak, cancel, getVoices: () => [] },
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: Utterance,
  });
  return { speak, cancel };
}

function AudioProbe() {
  const session = useYansiExperienceSession();
  if (!session) return null;
  return (
    <div>
      <button
        type="button"
        data-testid="audio-probe-on"
        onClick={() => session.setAudioOn(true)}
      >
        on
      </button>
      <span data-testid="audio-probe-state">{session.audioOn ? 'on' : 'off'}</span>
    </div>
  );
}

function mockDiscoverNext(slug: string) {
  vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
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
      total: 10,
      mode: 'random',
      randomSession: 'session-audio-01',
      strongCuriosityReady: false,
    },
  });
}

async function armSpeakingSession(entrySlug: string) {
  const { speak, cancel } = installSpeech();
  render(
    <YansiExperienceSessionProvider slug={entrySlug}>
      <AudioProbe />
      <YansiExperienceControls />
      <MirrorYansiChainExperience rootArtifact={makeArtifact(entrySlug)} />
    </YansiExperienceSessionProvider>
  );
  await waitFor(() => screen.getByTestId('mirror-yansi-chain'));
  fireEvent.click(screen.getByTestId('audio-probe-on'));
  await waitFor(() => expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('on'));
  speakYansiAnswer(`${entrySlug} speaking`);
  expect(speak).toHaveBeenCalled();
  cancel.mockClear();
  speak.mockClear();
  return { speak, cancel };
}

describe('active-slug audio authority', () => {
  beforeEach(() => {
    clearAllFrozenReplayProgressForTests();
    clearPublicAuthorDisplayCacheForTests();
    replaceMock.mockReset();
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchContinuationNeighbors).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) =>
      makeArtifact(slug)
    );
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) =>
      neighborsFor(slug, null, null)
    );
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('min-width: 900'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('A speaking → vertical DOWN to B cancels A, idle UI, no autoplay', async () => {
    mockDiscoverNext('yansi-b');
    const { speak, cancel } = await armSpeakingSession('yansi-a');

    fireEvent.click(await screen.findByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );

    expect(cancel).toHaveBeenCalled();
    expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('off');
    expect(speak).not.toHaveBeenCalled();
  });

  it('A speaking → vertical UP cancels A', async () => {
    mockDiscoverNext('yansi-b');
    const { cancel } = await armSpeakingSession('yansi-a');
    fireEvent.click(await screen.findByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    cancel.mockClear();
    fireEvent.click(screen.getByTestId('audio-probe-on'));
    speakYansiAnswer('B speaking');
    cancel.mockClear();

    fireEvent.click(screen.getByTestId('mirror-discover-up'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a'
      )
    );
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('off');
  });

  it('A speaking → horizontal RIGHT cancels A, no autoplay', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-a2');
      if (slug === 'yansi-a2') return neighborsFor('yansi-a2', 'yansi-a', null);
      return neighborsFor(slug, null, null);
    });
    const { speak, cancel } = await armSpeakingSession('yansi-a');

    fireEvent.click(await screen.findByTestId('mirror-continuation-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a2'
      )
    );
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('off');
    expect(speak).not.toHaveBeenCalled();
  });

  it('A speaking → horizontal LEFT cancels A', async () => {
    vi.mocked(fetchContinuationNeighbors).mockImplementation(async (slug) => {
      if (slug === 'yansi-a2') return neighborsFor('yansi-a2', 'yansi-a', null);
      if (slug === 'yansi-a') return neighborsFor('yansi-a', null, 'yansi-a2');
      return neighborsFor(slug, null, null);
    });
    const { cancel } = await armSpeakingSession('yansi-a2');

    fireEvent.click(await screen.findByTestId('mirror-continuation-prev'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-a'
      )
    );
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('off');
  });

  it('route/unmount cancels speech', async () => {
    const { cancel } = installSpeech();
    speakYansiAnswer('leaving');
    const { unmount } = render(
      <YansiExperienceSessionProvider slug="yansi-a">
        <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-a')} />
      </YansiExperienceSessionProvider>
    );
    cancel.mockClear();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it('rapid navigation does not leave audioOn stuck on', async () => {
    const queue = ['yansi-b', 'yansi-c', 'yansi-d'];
    let i = 0;
    vi.mocked(fetchDiscoverMirrors).mockImplementation(async () => {
      const slug = queue[i++] ?? 'yansi-z';
      return {
        ok: true as const,
        data: {
          items: [
            {
              slug,
              title: slug,
              sceneImageUrl: `https://cdn.example/${slug}.jpg`,
              yansiCount: 0,
            },
          ],
          total: 10,
          mode: 'random' as const,
          randomSession: 'session-audio-rapid',
          strongCuriosityReady: false,
        },
      };
    });
    const { speak } = await armSpeakingSession('yansi-a');

    fireEvent.click(await screen.findByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-b'
      )
    );
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await waitFor(() =>
      expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
        'data-active-slug',
        'yansi-c'
      )
    );
    expect(screen.getByTestId('audio-probe-state')).toHaveTextContent('off');
    expect(speak).not.toHaveBeenCalled();
  });

  it('wires resetAudioForActiveChange from activeSlug authority', () => {
    const chain = read('components/mirror-landing/MirrorYansiChainExperience.tsx');
    const session = read('components/mirror-landing/YansiExperienceSession.tsx');
    expect(session).toContain('resetAudioForActiveChange');
    expect(chain).toContain('resetAudioForActiveChange');
    expect(chain).toContain('audioActiveSlugRef');
    expect(session).toContain('latestAnswerRef.current = null');
  });
});
