/**
 * Final UX polish — Reel title↑ / Chat↑ choreography + Ayna-slot → Audio-slot.
 */
import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import SainaComposer from '@/components/saina/SainaComposer';
import { SAINA_HERO_DEFAULT_TITLE, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let searchParams = new URLSearchParams();
let mockCompact = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back, prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/m/yansi-b',
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => mockCompact,
  useSainaMinWidth: () => mockCompact,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isAuthReady: true,
    user: { user_id: 'u1', email: 'a@b.c', full_name: 'Test' },
    token: 't',
    setAuth: vi.fn(),
  }),
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
    data: { slug: 'yansi-b', journeyVersion: 2, previous: null, next: null },
  })),
}));

vi.mock('@/lib/eza/mirror-network/landingAnalytics', () => ({
  trackLandingViewed: vi.fn(),
  trackLandingCtaClicked: vi.fn(),
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey';

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function makeArtifact(
  slug = 'yansi-b',
  overrides?: Partial<PublicFrozenJourneyArtifact>
): PublicFrozenJourneyArtifact {
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: `Canonical ${slug}`,
    publicSummary: 'Summary',
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

function withSession(ui: ReactElement, slug = 'yansi-b') {
  return <YansiExperienceSessionProvider slug={slug}>{ui}</YansiExperienceSessionProvider>;
}

function installSpeech() {
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel, speaking: false, pending: false, paused: false });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    vi.fn(function SpeechSynthesisUtterance(this: { text: string }, text?: string) {
      this.text = text || '';
    })
  );
  return { speak, cancel };
}

beforeEach(() => {
  cleanup();
  clearAllFrozenReplayProgressForTests();
  localStorage.clear();
  push.mockReset();
  replace.mockReset();
  back.mockReset();
  searchParams = new URLSearchParams();
  mockCompact = false;
  window.history.replaceState({}, '', '/m/yansi-b?journeyVersion=2');
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact());
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UX polish — title / chat choreography', () => {
  it('A–I: title positions, single authority, scene continuity, reduced-motion', async () => {
    const css = read('styles/yansi-reel-responsive.css');
    expect(css).toContain("data-yansi-title-position='lower'");
    expect(css).toContain("data-yansi-title-position='elevated'");
    expect(css).toContain('yansi-chat-rise');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).not.toContain('filter: brightness');

    mockCompact = false;
    const { rerender } = render(
      <MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="reel" />
    );
    const block = await screen.findByTestId('yansi-title-block');
    expect(block).toHaveAttribute('data-yansi-title-position', 'lower');
    const title = screen.getByTestId('mirror-yansi-active-title');
    expect(title).toHaveAttribute('data-yansi-title-authority', 'canonical');
    expect(title.tagName).toBe('BUTTON');
    expect(screen.queryByTestId('yansi-chat-replay-layer')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toBeTruthy();

    rerender(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="chat" />);
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-title-position',
      'elevated'
    );
    expect(screen.getAllByTestId('mirror-yansi-active-title')).toHaveLength(1);
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveAttribute(
      'data-yansi-title-authority',
      'canonical'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );

    mockCompact = true;
    rerender(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="reel" />);
    expect(await screen.findByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-title-position',
      'lower'
    );
  });

  it('E: title activation enters Chat', async () => {
    const onDepthChange = vi.fn();
    render(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact()}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    fireEvent.click(await screen.findByTestId('mirror-yansi-active-title'));
    expect(onDepthChange).toHaveBeenCalledWith('chat');
  });
});

describe('UX polish — frozen question', () => {
  it('J–O: actionable question requires interaction; no auto-answer', async () => {
    render(<MirrorFrozenReplay artifact={makeArtifact()} />);
    const q = await screen.findByTestId('mirror-frozen-replay-next-question');
    expect(q).toHaveAttribute('data-yansi-actionable-question', 'true');
    expect(q).toHaveClass('yansi-actionable-question');
    expect(screen.queryByText('A1')).toBeNull();
    fireEvent.click(q);
    await waitFor(() => {
      expect(screen.getByText('A1')).toBeTruthy();
    });
    expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute(
      'data-step-index',
      '2'
    );
  });
});

describe('UX polish — mobile contextual Ayna → Audio', () => {
  it('P: private mobile chat still shows ✦ Ayna pill', async () => {
    mockCompact = false;
    render(
      <SainaStandaloneShell
        heroTitle={SAINA_HERO_DEFAULT_TITLE}
        isEmpty={false}
        messages={<div>messages</div>}
        composer={<SainaComposer onSend={() => undefined} isLoading={false} />}
        conversations={[]}
        activeChatId="c1"
        safeOnlyMode={false}
        onSafeOnlyModeChange={vi.fn()}
        analysisModelId={DEFAULT_ANALYSIS_MODEL_ID}
        onAnalysisModelChange={vi.fn()}
      />
    );
    const pill = await screen.findByTestId('saina-mobile-ayna-pill');
    expect(pill.textContent).toContain(SAINA_MIRROR_EXPAND_TAB);
    expect(pill.textContent).toMatch(/✦/);
  });

  it('Q–U: public mobile Reel empty slot; Chat shows Audio not Ayna', async () => {
    installSpeech();
    mockCompact = false;
    const { rerender } = render(
      withSession(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="reel" />)
    );
    await screen.findByTestId('mirror-yansi-chain');
    expect(screen.queryByTestId('yansi-public-audio-ayna-slot')).toBeNull();
    expect(screen.queryByTestId('yansi-mobile-listen-entry')).toBeNull();
    expect(screen.queryByTestId('saina-mobile-ayna-pill')).toBeNull();
    expect(screen.queryByText(/✦\s*Ayna/)).toBeNull();

    rerender(
      withSession(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="chat" />)
    );
    const slot = await screen.findByTestId('yansi-public-audio-ayna-slot');
    expect(slot).toHaveAttribute('data-yansi-contextual-slot', 'audio');
    expect(screen.getByTestId('yansi-public-audio-slot-trigger')).toHaveAttribute(
      'aria-label',
      'Sesli okuma'
    );
    expect(within(slot).queryByText(/Ayna/i)).toBeNull();
    expect(screen.queryByTestId('saina-mobile-ayna-sheet')).toBeNull();
    expect(screen.queryByTestId('saina-mobile-ayna-pill')).toBeNull();

    fireEvent.click(screen.getByTestId('yansi-public-audio-slot-trigger'));
    await screen.findByTestId('yansi-mobile-audio-sheet');
    expect(screen.queryByTestId('saina-mobile-ayna-sheet')).toBeNull();

    rerender(
      withSession(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="reel" />)
    );
    await screen.findByTestId('yansi-reel-preview-body');
    expect(screen.queryByTestId('yansi-public-audio-ayna-slot')).toBeNull();
  });
});

describe('UX polish — desktop contextual Ayna → Audio', () => {
  it('W: private desktop keeps Ayna rail owner (structural)', () => {
    const shell = read('components/saina/SainaStandaloneShell.tsx');
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('saina-mirror-col');
    expect(shell).toContain('saina-mobile-ayna-pill');
  });

  it('X–AB: public desktop Reel empty; Chat shows Audio rail not Ayna', async () => {
    installSpeech();
    mockCompact = true;
    const { unmount } = render(
      <MirrorLandingExperience
        surface={{
          slug: 'yansi-b',
          cardTitle: 'B',
          cardDate: '2026-09-01',
          dayLabel: '1 Eylül',
          sceneImageUrl: 'https://cdn.example/yansi-b.jpg',
          curiosityContext: 'x',
        }}
      />
    );
    await screen.findByTestId('mirror-yansi-chain');
    expect(screen.queryByTestId('yansi-experience-controls')).toBeNull();

    fireEvent.click(screen.getByTestId('mirror-yansi-active-title'));
    const rail = await screen.findByTestId('yansi-experience-controls');
    expect(rail).toHaveAttribute('data-yansi-contextual-slot', 'audio');
    expect(rail).toHaveAttribute('data-yansi-public-audio-rail', 'true');
    expect(rail.textContent).not.toMatch(/Ayna/i);
    expect(screen.queryByTestId('saina-mobile-ayna-pill')).toBeNull();

    unmount();
    render(
      withSession(<MirrorYansiChainExperience rootArtifact={makeArtifact()} depth="reel" />)
    );
    await screen.findByTestId('yansi-reel-preview-body');
    expect(screen.queryByTestId('yansi-experience-controls')).toBeNull();
  });
});

describe('UX polish — audio reuse contracts', () => {
  it('AD–AL: existing speech helpers reused; no second TTS; no Ayna coupling', () => {
    const speech = read('lib/eza/mirror/yansiSpeech.ts');
    const controls = read('components/mirror-landing/YansiExperienceControls.tsx');
    const sheet = read('components/mirror-landing/YansiMobileAudioSheet.tsx');
    const chain = read('components/mirror-landing/MirrorYansiChainExperience.tsx');
    const session = read('components/mirror-landing/YansiExperienceSession.tsx');

    expect(speech).toContain('speechSynthesis');
    expect(speech).toContain("utterance.lang = 'tr-TR'");
    expect(speech).toContain('speakYansiAnswer');
    expect(speech).not.toContain('fetch(');
    expect(speech).not.toContain('openai');
    expect(controls).toContain('useYansiExperienceSession');
    expect(controls).toContain('setAudioOn');
    expect(controls).toContain('setRhythm');
    expect(sheet).toContain('useYansiExperienceSession');
    expect(sheet).toContain('YANSI_RHYTHM');
    expect(sheet).not.toContain('Ayna');
    expect(chain).toContain('yansi-public-audio-ayna-slot');
    expect(chain).not.toContain('SainaMobileAynaSheet');
    expect(chain).not.toContain('onOpenAyna');
    expect(session).toContain('speakYansiAnswer');
    expect(session).toContain('registerRevealedAnswer');
  });

  it('direct mode=chat settles elevated with Audio slot', async () => {
    installSpeech();
    mockCompact = false;
    searchParams = new URLSearchParams('journeyVersion=2&mode=chat');
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'yansi-b',
          cardTitle: 'B',
          cardDate: '2026-09-01',
          dayLabel: '1 Eylül',
          sceneImageUrl: 'https://cdn.example/surface.jpg',
          curiosityContext: 'x',
        }}
      />
    );
    await screen.findByTestId('yansi-chat-replay-layer');
    expect(screen.getByTestId('yansi-title-block')).toHaveAttribute(
      'data-yansi-title-position',
      'elevated'
    );
    expect(screen.getByTestId('yansi-chat-replay-layer')).toHaveAttribute(
      'data-yansi-chat-reveal',
      'settled'
    );
    expect(screen.getByTestId('yansi-public-audio-ayna-slot')).toBeTruthy();
    expect(screen.queryByText(/✦\s*Ayna/)).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-b.jpg'
    );
  });
});
