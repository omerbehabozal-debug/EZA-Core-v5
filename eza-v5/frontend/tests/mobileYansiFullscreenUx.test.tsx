import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAINA_COMPACT_SHELL_MIN_PX, SAINA_MOBILE_MAX_PX } from '@/lib/eza/sainaBreakpoints';
import { SAINA_HERO_DEFAULT_TITLE, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';
import {
  createYansiSwipeGestureState,
  yansiSwipePointerDown,
  yansiSwipePointerUp,
} from '@/lib/eza/mirror/journey/yansiSwipeGesture';

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaMinWidth: (min: number) => mockCompact && min >= SAINA_COMPACT_SHELL_MIN_PX,
  useSainaCompactShell: () => mockCompact,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { user_id: 'u1', email: 'a@b.c', full_name: 'Tarık Ayşe' },
    isAuthenticated: true,
    isAuthReady: true,
    token: 't',
    setAuth: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/standalone',
  useSearchParams: () => new URLSearchParams(),
}));

import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import SainaComposer from '@/components/saina/SainaComposer';
import SainaPageTopBar from '@/components/saina/SainaPageTopBar';

let mockCompact = false;

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function mockSainaSidebarViewport(compact: boolean) {
  mockCompact = compact;
}

describe('Mobile Yansı fullscreen UX contracts', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const publicCss = read('styles/saina-yansi-mobile-public.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const chain = read('components/mirror-landing/MirrorYansiChainExperience.tsx');
  const speech = read('lib/eza/mirror/yansiSpeech.ts');

  beforeEach(() => {
    mockCompact = false;
  });

  it('uses existing 899/900 breakpoint authority', () => {
    expect(SAINA_MOBILE_MAX_PX).toBe(899);
    expect(SAINA_COMPACT_SHELL_MIN_PX).toBe(900);
  });

  it('hides duplicate large author block on mobile via compact identity contract', () => {
    expect(css).toContain("data-compact-mobile-identity='true'");
    expect(css).toMatch(
      /bilign-yansi-identity\[data-compact-mobile-identity='true'\][\s\S]*\.bilign-yansi-identity__mark[\s\S]*display:\s*none/
    );
  });

  it('defines mobile overlay header + Ayna bottom sheet', () => {
    expect(shell).toContain('SainaMobileYansiHeader');
    expect(shell).toContain('SainaMobileAynaSheet');
    expect(shell).not.toContain('SainaMobileMirrorRail');
    expect(css).toContain('.saina-mobile-ayna-sheet');
    expect(css).toContain('min-height: min(70dvh, 100%)');
  });

  it('desktop keeps right-side Ayna rail', () => {
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('saina-mirror-col');
  });

  it('mobile shell exposes explicit Ayna pill (composer mark is branding only)', () => {
    mockSainaSidebarViewport(false);
    render(<SainaComposer onSend={() => undefined} isLoading={false} onOpenAyna={vi.fn()} />);
    expect(screen.queryByTestId('saina-composer-ayna-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('saina-composer')).toBeInTheDocument();
  });

  it('desktop composer mark is not an Ayna button', () => {
    mockSainaSidebarViewport(true);
    render(<SainaComposer onSend={() => undefined} isLoading={false} onOpenAyna={vi.fn()} />);
    expect(screen.queryByTestId('saina-composer-ayna-trigger')).not.toBeInTheDocument();
  });

  it('desktop top bar still renders search + notifications', () => {
    mockSainaSidebarViewport(true);
    render(<SainaPageTopBar onOpenCommandPalette={vi.fn()} />);
    expect(screen.getByTestId('saina-top-search-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('saina-notifications-trigger')).toBeInTheDocument();
  });

  it('mobile shell shows minimal header and opens Ayna sheet from explicit pill', async () => {
    mockSainaSidebarViewport(false);
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

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-yansi-header')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('saina-top-search-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-notifications-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-mobile-mirror-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-composer-ayna-trigger')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('saina-mobile-ayna-pill'));
    expect(screen.getByTestId('saina-mobile-ayna-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('saina-mobile-ayna-pill')).toHaveAttribute(
      'aria-label',
      SAINA_MIRROR_EXPAND_TAB
    );
  });

  it('public chain keeps Discover vertical + continuation horizontal authority (no /children, no parent_slug nav)', () => {
    expect(chain).toContain('goDown');
    expect(chain).toContain('goHorizontal');
    expect(chain).toContain('yansiSwipePointerUp');
    expect(chain).toContain('fetchContinuationNeighbors');
    expect(chain).not.toMatch(/fetch\([`'"][^`'"]*\/children/);
    expect(chain).not.toMatch(/goHorizontal[\s\S]*parent_slug/);
    expect(publicCss).toContain('.yansi-mobile-public-header');
  });

  it('audio sheet exposes only supported speech toggle + rhythm (no fake lang/voice/speed)', () => {
    const audioSheet = read('components/mirror-landing/YansiMobileAudioSheet.tsx');
    expect(audioSheet).toContain('speechSupported');
    expect(audioSheet).toContain('Ritim');
    expect(audioSheet).not.toContain('Dil');
    expect(audioSheet).not.toContain('Ses       ');
    expect(speech).toContain("utterance.lang = 'tr-TR'");
    expect(speech).not.toContain('utterance.rate');
    expect(speech).not.toContain('getVoices');
  });

  it('audio sheet open/close does not programmatically focus a chat composer', () => {
    const audioSheet = read('components/mirror-landing/YansiMobileAudioSheet.tsx');
    expect(audioSheet).not.toContain('SainaComposer');
    expect(audioSheet).not.toContain('inputRef');
    expect(audioSheet).not.toMatch(/\.focus\s*\(/);
  });

  it('swipe classifier requires deliberate threshold + scroll-boundary for vertical nav', () => {
    const gesture = read('lib/eza/mirror/journey/yansiSwipeGesture.ts');
    const chain = read('components/mirror-landing/MirrorYansiChainExperience.tsx');
    expect(gesture).toContain('YANSI_SWIPE_VERTICAL_COMMIT_PX');
    expect(gesture).toContain('YANSI_SWIPE_AXIS_DOMINANCE');
    expect(gesture).toContain('yansiAtScrollBottom');
    expect(gesture).toContain('yansiAtScrollTop');
    expect(chain).toContain('readYansiScrollMetrics');
    expect(chain).toContain('scrollRootRef');
    // Pointer swipe must keep native scroll; keyboard Escape/arrows may preventDefault.
    expect(chain).toContain('never cancel the pointer event');
    expect(chain).not.toMatch(
      /onSwipePointer(?:Down|Up|Cancel)[\s\S]{0,500}?\.preventDefault\s*\(/
    );
    expect(publicCss).toContain('touch-action: pan-y');
  });

  it('legacy tiny-move classifier path is replaced by dominance arbitration', () => {
    // Short upward flick must not navigate even at bottom without enough travel.
    let state = createYansiSwipeGestureState();
    state = yansiSwipePointerDown(state, 1, 100, 100);
    expect(
      yansiSwipePointerUp(state, 1, 100, 60, {
        scrollTop: 1300,
        scrollHeight: 2000,
        clientHeight: 700,
      }).direction
    ).toBeNull();

    state = yansiSwipePointerDown(createYansiSwipeGestureState(), 2, 100, 100);
    expect(
      yansiSwipePointerUp(state, 2, 180, 100, {
        scrollTop: 400,
        scrollHeight: 2000,
        clientHeight: 700,
      }).direction
    ).toBe('right');
  });
});
