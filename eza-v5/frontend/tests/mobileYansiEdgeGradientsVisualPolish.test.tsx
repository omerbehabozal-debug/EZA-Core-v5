/**
 * FINAL mobile Yansı visual polish — edge gradients + full-viewport scene.
 * Contracts only; does not redesign Ayna / autofocus / desktop / gestures.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';
import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';
import { yansiSwipeShouldIgnoreTarget } from '@/lib/eza/mirror/journey/yansiSwipeGesture';

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaMinWidth: (min: number) => mockCompact && min >= SAINA_COMPACT_SHELL_MIN_PX,
  useSainaCompactShell: () => mockCompact,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      user_id: 'u1',
      email: 'a@b.c',
      full_name: 'Tarık Ayşe',
      public_display_name: 'Tarık Ayşe',
      public_honorific: 'curious',
    },
    isAuthenticated: true,
    isAuthReady: true,
    token: 't',
    setAuth: vi.fn(),
    patchAuthUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/standalone',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: () => ({
    isPlus: false,
    isLoading: false,
    source: 'mock',
    setPlan: vi.fn(),
    refreshPlan: vi.fn(),
  }),
}));

vi.mock('@/lib/eza/plan/useAccountEntitlements', () => ({
  useAccountEntitlements: () => ({
    entitlements: {
      tier: 'free',
      label: 'biligN Free',
      entitlements: {
        tier: 'free',
        dailyMessageLimit: 10,
        maxMessageChars: 500,
        mirrorCooldownHours: null,
        dailyMirrorLimit: 1,
        dailyDiscoverStartLimit: 1,
        relationshipMapAccess: 'locked',
        imageQuality: 'medium',
        priorityGeneration: false,
      },
      usage: {
        dailyMessagesUsed: 0,
        dailyMessagesLimit: 10,
        dailyDiscoverStartsUsed: 0,
        dailyDiscoverStartsLimit: 1,
        nextVisualAvailableAt: null,
      },
    },
    isLoading: false,
    refreshEntitlements: vi.fn(),
  }),
}));

import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import SainaComposer from '@/components/saina/SainaComposer';

let mockCompact = false;

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function shellProps(extra?: Record<string, unknown>) {
  return {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    heroMeta: { timeLabel: '3 gün önce', typeLabel: 'Yeni sohbet' },
    isEmpty: false,
    messages: <div>messages</div>,
    composer: <SainaComposer onSend={() => undefined} isLoading={false} />,
    conversations: [],
    activeChatId: 'c1',
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
    ...extra,
  };
}

describe('Mobile Yansı edge gradients visual polish', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const composerSrc = read('components/saina/SainaComposer.tsx');
  const viewport = read('hooks/useSainaVisualViewportInset.ts');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  beforeEach(() => {
    mockCompact = false;
  });

  it('keeps full-viewport scene ownership with cover + focal authority', () => {
    expect(mobileBlock).toContain('min-height: 100dvh');
    expect(mobileBlock).toContain('height: 100dvh');
    expect(mirror).toContain('background-size: cover');
    expect(mirror).toContain('--mirror-focal-position');
    expect(mirror).not.toMatch(
      /\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*contain/
    );
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-height: 90dvh');
    expect(mobileBlock).toContain('.saina-scene-fit__frame');
  });

  it('defines edge-weighted top gradient via header overlay', () => {
    expect(mobileBlock).toContain('.saina-mobile-yansi-header::before');
    const headerBefore = mobileBlock.slice(
      mobileBlock.indexOf('.saina-mobile-yansi-header::before {'),
      mobileBlock.indexOf('.saina-mobile-yansi-header > *')
    );
    expect(headerBefore).toMatch(/linear-gradient\(\s*180deg/);
    // Chrome-local only — long cinematic top fade is on the vignette behind text.
    expect(headerBefore).toMatch(/height:\s*100%/);
    expect(headerBefore).toMatch(/pointer-events:\s*none/);
    expect(headerBefore).not.toMatch(/height:\s*36dvh/);
  });

  it('defines edge-weighted bottom gradient via absolute overlay', () => {
    expect(mobileBlock).toContain('.saina-chat-bottom-anchor::before');
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*linear-gradient\(\s*to top/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*rgba\(9, 11, 11, 0\.97\)/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*pointer-events:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*height:\s*36dvh/
    );
  });

  it('vignette is edge-weighted with a clear transparent center band', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\) 38%[\s\S]*rgba\(9, 11, 11, 0\) 62%/
    );
    expect(mobileBlock).not.toContain('ellipse 78% 38% at 48% 34%');
  });

  it('does not add a new full-screen/global dark overlay or center radial veil', () => {
    expect(mobileBlock).toContain('Soft local assist only');
    expect(mobileBlock).not.toContain('ellipse 78% 38% at 48% 34%');
    expect(mobileBlock).not.toMatch(
      /\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*radial-gradient/
    );
    expect(mobileBlock).toMatch(
      /\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*transparent 18%/
    );
    expect(mobileBlock).toMatch(
      /\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*transparent 16%/
    );
  });

  it('neutralizes stacked canvas left/center/pattern-dim/right overlays on mobile', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--center[\s\S]*display:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--pattern-dim[\s\S]*display:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--left[\s\S]*background:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--right[\s\S]*background:\s*none/
    );
  });

  it('gradients do not consume layout height (absolute overlays)', () => {
    expect(mobileBlock).toMatch(
      /\.saina-mobile-yansi-header::before[\s\S]*position:\s*absolute/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*position:\s*absolute/
    );
    expect(mobileBlock).toMatch(
      /\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*position:\s*absolute/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*background:\s*transparent/
    );
  });

  it('does not increase header height tokens', () => {
    expect(mobileBlock).toContain('width: 2.375rem; /* 38px — compact, not hero */');
    expect(mobileBlock).toMatch(
      /\.saina-mobile-yansi-header[\s\S]*padding:\s*max\(0\.45rem, env\(safe-area-inset-top, 0px\)\) 0\.75rem 0\.35rem/
    );
  });

  it('reduces reserved vertical UI consumption around title/content', () => {
    expect(mobileBlock).toContain(
      '--saina-identity-chat-breath: clamp(0.55rem, 2.2vw, 0.9rem)'
    );
    expect(mobileBlock).toMatch(/\.saina-chat-card[\s\S]*padding:\s*0\.4rem 0 0\.3rem/);
  });

  it('Ayna remains outside composer and floating above it', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    const anchor = screen.getByTestId('saina-chat-bottom-anchor');
    const float = within(anchor).getByTestId('saina-mobile-ayna-float');
    const composer = within(anchor).getByTestId('saina-composer');
    expect(float.contains(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(true);
    expect(composer.contains(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(false);
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
    expect(mobileBlock).toContain('0.625rem');
    expect(composerSrc).not.toContain('saina-composer-ayna-trigger');
  });

  it('keyboard-open Ayna still uses visualViewport inset authority', () => {
    expect(viewport).toContain('--saina-keyboard-inset');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });

  it('draft survives Ayna open/close without autofocus regain', async () => {
    const onSend = vi.fn();
    render(
      <SainaStandaloneShell
        {...shellProps({
          composer: <SainaComposer onSend={onSend} isLoading={false} />,
        })}
      />
    );
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    const input = screen.getByLabelText('Mesaj yaz') as HTMLInputElement;
    act(() => {
      input.focus();
    });
    fireEvent.change(input, {
      target: { value: "Mardin'de en çok nereyi önerirsin?" },
    });
    fireEvent.click(screen.getByTestId('saina-mobile-ayna-pill'));
    expect(input.value).toBe("Mardin'de en çok nereyi önerirsin?");
    expect(document.activeElement).not.toBe(input);
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('saina-mobile-ayna-sheet-close'));
    expect(input.value).toBe("Mardin'de en çok nereyi önerirsin?");
    expect(document.activeElement).not.toBe(input);
  });

  it('mobile composer does not autofocus on entry', async () => {
    expect(composerSrc).toContain('if (!isCompactShell) return');
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByLabelText('Mesaj yaz'));
    expect(document.activeElement).not.toBe(screen.getByLabelText('Mesaj yaz'));
  });

  it('gesture safety and desktop Ayna rail remain unchanged', async () => {
    expect(shell).toContain('data-yansi-no-swipe');
    expect(shell).toContain('SainaYansiContextRail');
    expect(desktopBlock).toContain('radial-gradient');

    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    expect(yansiSwipeShouldIgnoreTarget(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(
      true
    );
  });

  it('desktop does not mount mobile floating Ayna', () => {
    mockCompact = true;
    render(<SainaStandaloneShell {...shellProps()} />);
    expect(screen.queryByTestId('saina-mobile-ayna-pill')).not.toBeInTheDocument();
  });
});
