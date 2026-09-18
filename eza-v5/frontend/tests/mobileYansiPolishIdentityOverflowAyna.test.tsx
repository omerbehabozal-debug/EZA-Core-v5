/**
 * Mobile Yansı polish — identity hierarchy, overflow authorities, explicit Ayna pill.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';
import {
  SAINA_HERO_DEFAULT_TITLE,
  SAINA_MENU_SETTINGS,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_NOTIFICATIONS_TITLE,
} from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';

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
import SainaMobileYansiHeader from '@/components/saina/SainaMobileYansiHeader';

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

describe('Mobile Yansı polish — identity + overflow + Ayna', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const composer = read('components/saina/SainaComposer.tsx');
  const header = read('components/saina/SainaMobileYansiHeader.tsx');

  beforeEach(() => {
    mockCompact = false;
  });

  it('mobile header uses compact ~38px avatar, not hero size', () => {
    expect(css).toContain('2.375rem');
    expect(css).toContain('compact, not hero');
    expect(header).toContain('size="sm"');
    expect(header).not.toContain('size="hero"');
  });

  it('mobile header shows author, honorific, quiet meta from real authorities', async () => {
    render(
      <SainaMobileYansiHeader
        displayName="Tarık Ayşe"
        honorificId="curious"
        metaTimeLabel="3 gün önce"
        metaTypeLabel="Yeni sohbet"
        onOpenSearch={vi.fn()}
        onOpenNotifications={vi.fn()}
        onOpenProfile={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(screen.getByTestId('saina-mobile-yansi-author')).toHaveTextContent('Tarık Ayşe');
    expect(screen.getByTestId('saina-mobile-yansi-honorific')).toBeInTheDocument();
    expect(screen.getByTestId('saina-mobile-yansi-meta-time')).toHaveTextContent('3 gün önce');
    expect(screen.getByTestId('saina-mobile-yansi-meta-type')).toHaveTextContent('Yeni sohbet');
  });

  it('shell wires heroMeta into mobile header and keeps title in hero', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-yansi-meta')).toBeInTheDocument();
    });
    expect(screen.getByTestId('saina-mobile-yansi-meta-time')).toHaveTextContent('3 gün önce');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(SAINA_HERO_DEFAULT_TITLE);
  });

  it('primary chrome does not restore large Search/Notifications buttons', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-yansi-header'));
    expect(screen.queryByTestId('saina-top-search-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-notifications-trigger')).not.toBeInTheDocument();
  });

  it('overflow exposes Ara, Bildirimler, Hesabım, Ayarlar via existing authorities', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-yansi-overflow'));
    fireEvent.click(screen.getByTestId('saina-mobile-yansi-overflow'));
    const menu = screen.getByTestId('saina-mobile-yansi-overflow-menu');
    expect(within(menu).getByTestId('saina-mobile-overflow-search')).toHaveTextContent('Ara');
    expect(within(menu).getByTestId('saina-mobile-overflow-notifications')).toHaveTextContent(
      SAINA_NOTIFICATIONS_TITLE
    );
    expect(within(menu).getByTestId('saina-mobile-overflow-profile')).toHaveTextContent('Hesabım');
    expect(within(menu).getByTestId('saina-mobile-overflow-settings')).toHaveTextContent(
      SAINA_MENU_SETTINGS
    );
    expect(within(menu).getByTestId('saina-mobile-overflow-sep')).toBeInTheDocument();

    fireEvent.click(within(menu).getByTestId('saina-mobile-overflow-notifications'));
    expect(screen.getByTestId('saina-notifications-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('saina-mobile-yansi-overflow'));
    fireEvent.click(screen.getByTestId('saina-mobile-overflow-profile'));
    expect(screen.getByTestId('saina-profile-menu')).toBeInTheDocument();
  });

  it('avatar/identity opens existing Hesabım profile panel', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-yansi-author'));
    fireEvent.click(screen.getByTestId('saina-mobile-yansi-author'));
    expect(screen.getByTestId('saina-profile-menu')).toBeInTheDocument();
  });

  it('explicit Ayna pill opens existing SainaMobileAynaSheet; composer mark is not the only path', async () => {
    expect(shell).toContain('saina-mobile-ayna-pill');
    expect(shell).toContain('SainaMobileAynaSheet');
    expect(composer).not.toContain('saina-composer-ayna-trigger');
    expect(composer).toContain('SainaGeometricMark');

    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-ayna-pill'));
    expect(screen.getByTestId('saina-mobile-ayna-pill')).toHaveTextContent(SAINA_MIRROR_EXPAND_TAB);
    expect(screen.queryByTestId('saina-composer-ayna-trigger')).not.toBeInTheDocument();

    const composerInput = screen.getByLabelText('Mesaj yaz');
    expect(document.activeElement).not.toBe(composerInput);

    fireEvent.click(screen.getByTestId('saina-mobile-ayna-pill'));
    expect(screen.getByTestId('saina-mobile-ayna-sheet')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(composerInput);

    fireEvent.click(screen.getByTestId('saina-mobile-ayna-sheet-close'));
    expect(screen.queryByTestId('saina-mobile-ayna-sheet')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(composerInput);
  });

  it('opening/closing overflow does not focus composer', async () => {
    render(<SainaStandaloneShell {...shellProps()} />);
    await waitFor(() => screen.getByTestId('saina-mobile-yansi-overflow'));
    const composerInput = screen.getByLabelText('Mesaj yaz');
    expect(document.activeElement).not.toBe(composerInput);
    fireEvent.click(screen.getByTestId('saina-mobile-yansi-overflow'));
    expect(screen.getByTestId('saina-mobile-yansi-overflow-menu')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(composerInput);
    fireEvent.click(screen.getByTestId('saina-mobile-yansi-overflow'));
    expect(document.activeElement).not.toBe(composerInput);
  });

  it('desktop Ayna rail and autofocus authority remain intact in source', () => {
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('saina-mirror-col');
    expect(composer).toContain('if (!isCompactShell) return');
    expect(composer).toContain('inputRef.current?.focus()');
  });
});
