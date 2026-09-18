/**
 * Floating Ayna + edge readability gradients — mobile-only polish.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';
import { SAINA_HERO_DEFAULT_TITLE, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
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

describe('Mobile floating Ayna + readability', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const composerSrc = read('components/saina/SainaComposer.tsx');
  const viewport = read('hooks/useSainaVisualViewportInset.ts');

  beforeEach(() => {
    mockCompact = false;
  });

  it('renders exactly one Ayna control outside the composer action row', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    expect(screen.getAllByTestId('saina-mobile-ayna-pill')).toHaveLength(1);
    expect(screen.queryByTestId('saina-composer-ayna-trigger')).not.toBeInTheDocument();

    const anchor = screen.getByTestId('saina-chat-bottom-anchor');
    const float = within(anchor).getByTestId('saina-mobile-ayna-float');
    const composer = within(anchor).getByTestId('saina-composer');
    expect(float.contains(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(true);
    expect(composer.contains(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(false);
    expect(composerSrc).not.toContain('saina-composer-ayna-trigger');
  });

  it('reuses visualViewport keyboard inset for bottom interaction lift', () => {
    expect(viewport).toContain('--saina-keyboard-inset');
    expect(css).toContain('var(--saina-keyboard-inset, 0px)');
    expect(css).toContain('.saina-mobile-ayna-float');
    expect(css).toContain('0.625rem');
    expect(css).toContain('200ms ease-out');
  });

  it('draft survives Ayna open/close; keyboard dismisses; no autofocus after close', async () => {
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
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, {
      target: { value: "Mardin'de en çok nereyi önerirsin?" },
    });
    expect(input.value).toBe("Mardin'de en çok nereyi önerirsin?");

    fireEvent.click(screen.getByTestId('saina-mobile-ayna-pill'));
    expect(screen.getByTestId('saina-mobile-ayna-sheet')).toBeInTheDocument();
    expect(input.value).toBe("Mardin'de en çok nereyi önerirsin?");
    expect(document.activeElement).not.toBe(input);
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('saina-mobile-ayna-sheet-close'));
    expect(screen.queryByTestId('saina-mobile-ayna-sheet')).not.toBeInTheDocument();
    expect(input.value).toBe("Mardin'de en çok nereyi önerirsin?");
    expect(document.activeElement).not.toBe(input);

    act(() => {
      input.focus();
    });
    fireEvent.change(input, {
      target: { value: "Mardin'de en çok nereyi önerirsin? Devam" },
    });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    expect(onSend).toHaveBeenCalledWith("Mardin'de en çok nereyi önerirsin? Devam");
    expect(input.value).toBe('');
  });

  it('edge readability gradients are mobile-only with pointer-events none; no center radial dim', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*pointer-events:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*linear-gradient\(\s*180deg/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*linear-gradient\(\s*0deg/
    );
    // Mobile edge overlay must not use the old center-weighted radial pair.
    const mobileBlock = css.slice(
      css.indexOf('@media (max-width: 899px)'),
      css.indexOf('@media (min-width: 900px)')
    );
    expect(mobileBlock).toContain('Edge readability only');
    expect(mobileBlock).not.toContain('ellipse 78% 38% at 48% 34%');
    expect(css).toMatch(
      /@media \(min-width: 900px\)[\s\S]*radial-gradient\(\s*ellipse 48% 38% at 52% 36%/
    );
  });

  it('Ayna and composer interactions are ignored by swipe classifier', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    expect(yansiSwipeShouldIgnoreTarget(screen.getByTestId('saina-mobile-ayna-pill'))).toBe(
      true
    );
    expect(yansiSwipeShouldIgnoreTarget(screen.getByLabelText('Mesaj yaz'))).toBe(true);
    expect(shell).toContain('data-yansi-no-swipe');
    expect(shell).toContain('active.blur()');
  });

  it('desktop Ayna rail authority remains unchanged', () => {
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('saina-mirror-col');
    mockCompact = true;
    render(<SainaStandaloneShell {...shellProps()} />);
    expect(screen.queryByTestId('saina-mobile-ayna-pill')).not.toBeInTheDocument();
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
  });
});
