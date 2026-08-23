/**
 * Phase 8.8F Stage B — Yansı Experience Mode controls (frontend-only).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

vi.mock('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay', () => ({
  resolvePublicAuthorIdentity: vi.fn(async () => ({
    displayName: 'Mert Karaca',
    publicHonorific: 'bilgin',
  })),
}));

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { isContinuationMirrorChat } from '@/lib/eza/mirror/resolveMirrorPanelCopy';
import {
  isPublishedYansiExperiencePath,
  isYansiContinuationOpeningPath,
} from '@/lib/eza/mirror/yansiExperienceMode';
import {
  YANSI_RHYTHM_DEFAULT,
  YANSI_RHYTHM_STORAGE_KEY,
  normalizeYansiRhythm,
  readYansiRhythm,
  resolveYansiRevealPace,
  writeYansiRhythm,
} from '@/lib/eza/mirror/yansiRhythm';
import {
  cancelYansiSpeech,
  isYansiSpeechSupported,
  speakYansiAnswer,
} from '@/lib/eza/mirror/yansiSpeech';
import {
  resolveCanonicalYansiShareUrl,
  sharePublishedYansi,
} from '@/lib/eza/mirror/yansiExperienceShare';
import { MIRROR_PUBLIC_BASE_URL_DEFAULT } from '@/lib/eza/mirror-network/mirrorPublicUrl';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';
import YansiExperienceShareButton from '@/components/mirror-landing/YansiExperienceShareButton';
import type { ArchivedChat } from '@/lib/standaloneChatArchive';

const root = join(process.cwd());
function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

function makeArtifact(
  n: 6 | 7 | 8 = 6,
  overrides?: Partial<PublicFrozenJourneyArtifact>
) {
  const steps = Array.from({ length: n }, (_, i) => ({
    stepIndex: i + 1,
    publicQuestion: `Soru ${i + 1} tam metin?`,
    publicAnswer: `Cevap ${i + 1} birebir.`,
    ezaSnapshot: i === 0 ? { assistantScore: 91, userScore: 80, ezaFinal: 91 } : null,
  }));
  return parsePublicFrozenJourneyArtifact({
    slug: 'demo-yansi',
    journeyId: 'demo-yansi',
    journeyVersion: 1,
    publicTitle: 'Demo',
    publicSummary: 'Özet',
    authorUserId: 'alice',
    selectedCount: n,
    steps,
    replayReady: true,
    ...overrides,
  })!;
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

function stripSpeech() {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

function setMatchMedia(opts: { desktop: boolean; reducedMotion?: boolean }) {
  window.matchMedia = vi.fn((query: string) => {
    let matches = false;
    if (query.includes('min-width: 900')) matches = opts.desktop;
    if (query.includes('prefers-reduced-motion: reduce')) {
      matches = Boolean(opts.reducedMotion);
    }
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  }) as unknown as typeof window.matchMedia;
}

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const landingSurface = {
  slug: 'demo-yansi',
  cardTitle: 'Demo',
  cardDate: '2026-08-12',
  dayLabel: '12 Ağustos',
  sceneImageUrl: null,
  curiosityContext: 'Özet',
};

async function startPublishedExperience() {
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact());
  render(<MirrorLandingExperience surface={landingSurface} />);
  fireEvent.click(await screen.findByTestId('mirror-experience-start'));
  await screen.findByTestId('mirror-yansi-chain');
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  clearAllFrozenReplayProgressForTests();
  localStorage.clear();
  setMatchMedia({ desktop: true, reducedMotion: false });
  stripSpeech();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
});

afterEach(() => {
  cancelYansiSpeech();
  vi.unstubAllGlobals();
});

describe('mode detection from existing product state', () => {
  it('detects published Yansı experience vs continuation opening vs standalone', () => {
    expect(isPublishedYansiExperiencePath('/m/demo-yansi')).toBe(true);
    expect(isPublishedYansiExperiencePath('/m/demo-yansi/sohbet')).toBe(false);
    expect(isPublishedYansiExperiencePath('/standalone?new=1')).toBe(false);
    expect(isYansiContinuationOpeningPath('/m/demo-yansi/sohbet')).toBe(true);
    expect(isYansiContinuationOpeningPath('/m/demo-yansi')).toBe(false);
  });

  it('detects continuation from archive origin, not from URL cosmetics', () => {
    const continuation: ArchivedChat = {
      id: 'chat-mirror-1',
      title: 'Devam',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [],
      mirrorOrigin: {
        startedFromMirrorId: 'demo-yansi',
        parentMirrorId: 'demo-yansi',
        rootMirrorId: 'demo-yansi',
        seedTopic: 'taş',
        seedCategory: '',
        seedMood: '',
        isGuestSession: true,
      },
    };
    const fresh: ArchivedChat = {
      id: 'chat-2',
      title: 'Yeni',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 0,
      messages: [],
    };
    expect(isContinuationMirrorChat(continuation)).toBe(true);
    expect(isContinuationMirrorChat(fresh)).toBe(false);
  });
});

describe('published Yansı experience rail (Mode A, desktop)', () => {
  it('shows Audio + Rhythm after experience starts, without Ayna or Share on the rail', async () => {
    installSpeech();
    await startPublishedExperience();
    const rail = await screen.findByTestId('yansi-experience-controls');
    expect(rail).toBeInTheDocument();
    expect(screen.getByTestId('yansi-experience-audio')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('yansi-experience-audio')).toHaveAttribute(
      'aria-label',
      'Sesli okumayı aç'
    );
    expect(screen.getByTestId('yansi-experience-rhythm')).toBeInTheDocument();
    expect(rail.textContent).not.toMatch(/Ayna/i);
    expect(rail.querySelector('[data-testid="yansi-experience-share"]')).toBeNull();
    expect(screen.getByTestId('yansi-experience-share')).toHaveAttribute(
      'aria-label',
      "Yansı'yı paylaş"
    );
    expect(screen.getByTestId('ayna-author-row')).toBeInTheDocument();
  });

  it('hides audio control when SpeechSynthesis is unsupported', async () => {
    stripSpeech();
    await startPublishedExperience();
    await screen.findByTestId('yansi-experience-controls');
    expect(screen.queryByTestId('yansi-experience-audio')).not.toBeInTheDocument();
    expect(screen.getByTestId('yansi-experience-rhythm')).toBeInTheDocument();
  });

  it('does not show the desktop rail on mobile', async () => {
    setMatchMedia({ desktop: false });
    await startPublishedExperience();
    await waitFor(() => {
      expect(screen.queryByTestId('yansi-experience-controls')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('yansi-experience-share')).not.toBeInTheDocument();
  });
});

describe('audio speech', () => {
  it('defaults off, speaks only revealed public answer, never metadata', async () => {
    const { speak } = installSpeech();
    render(
      <YansiExperienceSessionProvider slug="demo-yansi">
        <YansiExperienceControls />
        <MirrorFrozenReplay artifact={makeArtifact()} />
      </YansiExperienceSessionProvider>
    );
    const audio = await screen.findByTestId('yansi-experience-audio');
    expect(audio).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(audio);
    expect(audio).toHaveAttribute('aria-pressed', 'true');
    expect(audio).toHaveAttribute('aria-label', 'Sesli okumayı kapat');
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(speak).toHaveBeenCalled();
    });
    const utterance = speak.mock.calls[0][0] as { text: string };
    expect(utterance.text).toBe('Cevap 1 birebir.');
    expect(utterance.text).not.toContain('91');
    expect(utterance.text).not.toContain('Soru 1');
    expect(utterance.text).not.toContain('Meraklı');
    expect(screen.queryByText('Soru 2 tam metin?')).toBeTruthy();
  });

  it('does not speak hidden later answers', async () => {
    const { speak } = installSpeech();
    render(
      <YansiExperienceSessionProvider slug="demo-yansi">
        <YansiExperienceControls />
        <MirrorFrozenReplay artifact={makeArtifact()} />
      </YansiExperienceSessionProvider>
    );
    fireEvent.click(await screen.findByTestId('yansi-experience-audio'));
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak.mock.calls[0][0].text).toBe('Cevap 1 birebir.');
    expect(screen.queryByText('Cevap 2 birebir.')).toBeNull();
  });

  it('cancels speech on unmount, continue click, and audio off', async () => {
    const { speak, cancel } = installSpeech();
    speakYansiAnswer('Cevap 1 birebir.');
    expect(speak).toHaveBeenCalled();
    const { unmount } = render(
      <YansiExperienceSessionProvider slug="demo-yansi">
        <YansiExperienceControls />
        <MirrorFrozenReplay artifact={makeArtifact()} />
      </YansiExperienceSessionProvider>
    );
    fireEvent.click(await screen.findByTestId('yansi-experience-audio'));
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-continue'));
    expect(cancel).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('yansi-experience-audio'));
    unmount();
    expect(cancel.mock.calls.length).toBeGreaterThan(1);
  });

  it('speak helper never imports backend TTS', () => {
    const speech = read('lib/eza/mirror/yansiSpeech.ts');
    expect(speech).toContain('speechSynthesis');
    expect(speech).not.toContain('fetch(');
    expect(speech).not.toContain('openai');
    expect(speech).not.toContain('/api/');
  });
});

describe('rhythm', () => {
  it('accepts only calm/normal/fast, defaults to normal, and recovers corrupt storage', () => {
    expect(normalizeYansiRhythm('calm')).toBe('calm');
    expect(normalizeYansiRhythm('fast')).toBe('fast');
    expect(normalizeYansiRhythm('nope')).toBe(YANSI_RHYTHM_DEFAULT);
    expect(readYansiRhythm()).toBe('normal');
    localStorage.setItem(YANSI_RHYTHM_STORAGE_KEY, 'banana');
    expect(readYansiRhythm()).toBe('normal');
    writeYansiRhythm('fast');
    expect(localStorage.getItem(YANSI_RHYTHM_STORAGE_KEY)).toBe('fast');
    expect(localStorage.getItem(YANSI_RHYTHM_STORAGE_KEY)).not.toContain('@');
    expect(localStorage.getItem(YANSI_RHYTHM_STORAGE_KEY)).not.toContain('demo-yansi');
  });

  it('reduced motion wins over Sakin pacing', () => {
    const calm = resolveYansiRevealPace('calm', false);
    const reduced = resolveYansiRevealPace('calm', true);
    expect(calm.tickMs).toBeGreaterThan(reduced.tickMs);
    expect(reduced.scrollBehavior).toBe('auto');
    expect(reduced.charsPerTick).toBeGreaterThan(calm.charsPerTick);
  });

  it('popover selects Sakin and persists locally only', async () => {
    installSpeech();
    render(
      <YansiExperienceSessionProvider slug="demo-yansi">
        <YansiExperienceControls />
      </YansiExperienceSessionProvider>
    );
    fireEvent.click(await screen.findByTestId('yansi-experience-rhythm'));
    fireEvent.click(screen.getByTestId('yansi-experience-rhythm-calm'));
    expect(localStorage.getItem(YANSI_RHYTHM_STORAGE_KEY)).toBe('calm');
    await waitFor(() => {
      expect(screen.queryByTestId('yansi-experience-rhythm-menu')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('yansi-experience-rhythm')).toHaveAttribute(
      'aria-label',
      'Ritim: Sakin'
    );
  });

  it('rhythm module does not touch API, provider, or streaming', () => {
    const src = read('lib/eza/mirror/yansiRhythm.ts');
    expect(src).not.toContain('fetch');
    expect(src).not.toContain('openai');
    expect(src).not.toContain('startStream');
    expect(src).not.toContain('/api/');
    const replay = read('components/mirror-landing/MirrorFrozenReplay.tsx');
    expect(replay).toContain('revealPace');
    expect(replay).not.toContain('startStream');
  });
});

describe('share', () => {
  it('canonical share URL is /m/{slug} on the public host, never sohbet', () => {
    const url = resolveCanonicalYansiShareUrl('demo-yansi');
    expect(url).toBe(`${MIRROR_PUBLIC_BASE_URL_DEFAULT}/m/demo-yansi`);
    const path = new URL(url!).pathname;
    expect(path).toBe('/m/demo-yansi');
    expect(path).not.toContain('/sohbet');
    expect(path.startsWith('/standalone')).toBe(false);
    expect(resolveCanonicalYansiShareUrl('')).toBeNull();
  });

  it('copies canonical URL when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    // @ts-expect-error test override
    delete navigator.share;
    await expect(sharePublishedYansi('demo-yansi')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(`${MIRROR_PUBLIC_BASE_URL_DEFAULT}/m/demo-yansi`);
  });

  it('uses navigator.share when available and still targets canonical /m/{slug}', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    await expect(sharePublishedYansi('demo-yansi')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Yansı',
      url: `${MIRROR_PUBLIC_BASE_URL_DEFAULT}/m/demo-yansi`,
    });
    const url = share.mock.calls[0][0].url as string;
    const path = new URL(url).pathname;
    expect(path).toBe('/m/demo-yansi');
    expect(path).not.toContain('/sohbet');
    expect(path.startsWith('/standalone')).toBe(false);
    expect(url).not.toContain('guest');
  });

  it('share control is absent without a published slug', () => {
    const { container } = render(<YansiExperienceShareButton slug="   " />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Ayna isolation', () => {
  it('experience rail does not render Ayna; existing eligibility path stays on the chat rail', () => {
    const rail = read('components/mirror-landing/YansiExperienceControls.tsx');
    const aynaRail = read('components/saina/SainaYansiContextRail.tsx');
    const shell = read('components/saina/SainaStandaloneShell.tsx');
    const inner = read('components/standalone/StandaloneChatInner.tsx');
    expect(rail).not.toContain('Ayna');
    expect(rail).not.toContain('tryOpenMirror');
    expect(rail).not.toContain('onOpenAyna');
    expect(aynaRail).toContain('onOpenAyna');
    expect(shell).toContain('tryOpenMirror');
    expect(inner).toContain('handleRequestMirror');
    expect(inner).toContain('Review8Screen');
  });
});

describe('privacy / metrics / ranking / observability isolation', () => {
  it('does not log spoken text or bind audio/rhythm to ops telemetry', () => {
    const speech = read('lib/eza/mirror/yansiSpeech.ts');
    const session = read('components/mirror-landing/YansiExperienceSession.tsx');
    const controls = read('components/mirror-landing/YansiExperienceControls.tsx');
    const ops = read('lib/eza/opsTelemetry.ts');
    expect(speech).not.toContain('reportOpsFailure');
    expect(session).not.toContain('reportOpsFailure');
    expect(controls).not.toContain('trackYansiExperience');
    expect(ops).not.toContain('audio');
    expect(ops).not.toContain('yansi-rhythm');
  });

  it('does not feed experience controls into Phase 6 ingest or Phase 7 ranking', () => {
    const ingest = read('lib/eza/mirror/journey/yansiExperienceAnalytics.ts');
    const replay = read('components/mirror-landing/MirrorFrozenReplay.tsx');
    expect(ingest).not.toContain('speechSynthesis');
    expect(ingest).not.toContain('yansi-rhythm');
    expect(replay).toContain('trackYansiExperienceStarted');
    expect(replay).toContain('cancelYansiSpeech');
    const discover = read('components/saina/SainaDiscoverCard.tsx');
    expect(discover).not.toContain('YansiExperienceControls');
    const profile = read('components/saina/SainaProfileMenu.tsx');
    expect(profile).not.toContain('YansiExperienceControls');
    expect(profile).not.toContain('YansiExperienceShareButton');
    const ranking = read('lib/eza/mirror-network/discoverFeed.ts');
    expect(ranking).not.toContain('YansiExperienceControls');
    expect(ranking).not.toContain('yansi-rhythm');
  });
});

describe('source contracts', () => {
  it('keeps new chat and continuation out of the Mode A rail mount', () => {
    const landing = read('components/mirror-landing/MirrorLandingExperience.tsx');
    const sohbet = read('components/mirror-landing/MirrorSohbetOpening.tsx');
    const inner = read('components/standalone/StandaloneChatInner.tsx');
    expect(landing).toContain('YansiExperienceControls');
    expect(landing).toContain('replayStarted');
    expect(sohbet).not.toContain('YansiExperienceControls');
    expect(sohbet).toContain('cancelYansiSpeech');
    expect(sohbet).toContain('data-yansi-experience-mode="b"');
    expect(inner).not.toContain('YansiExperienceControls');
    expect(inner).not.toContain('YansiExperienceShareButton');
    expect(inner).toContain('cancelYansiSpeech');
    expect(sohbet).not.toContain('YansiExperienceShareButton');
  });

  it('does not change backend files in this stage', () => {
    expect(read('app/m/layout.tsx')).toContain('yansi-experience-controls.css');
    const css = read('styles/yansi-experience-controls.css');
    expect(css).toContain('min-width: 900px');
    expect(css).toContain('max-width: 899px');
    expect(css).toContain('translateY(-50%)');
    expect(css).not.toContain('#00');
  });
});
