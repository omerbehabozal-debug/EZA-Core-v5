import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/standalone/mirror/pattern',
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
    isAuthReady: true,
    setAuth: vi.fn(),
  })),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: vi.fn(),
}));

vi.mock('@/lib/eza/plan/useRelationshipMapAccess', () => ({
  useRelationshipMapAccess: vi.fn(() => ({
    isLoading: false,
    canViewMapData: true,
    mapAccess: 'all',
    cutoffIso: null,
    refreshMapAccess: vi.fn(),
  })),
}));

vi.mock('@/components/standalone/MirrorEntriesContext', () => ({
  useMirrorEntries: vi.fn(() => []),
  useSetConversationMirrorEntries: vi.fn(() => vi.fn()),
  MirrorEntriesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { usePlan } from '@/lib/eza/plan/usePlan';
import { useRelationshipMapAccess } from '@/lib/eza/plan/useRelationshipMapAccess';
import SainaPatternPageInner from '@/components/saina/SainaPatternPageInner';
import SainaAppRootLayout from '@/app/standalone/SainaAppRootLayout';

const mirrorLayoutSrc = readFileSync(
  join(process.cwd(), 'app/standalone/mirror/MirrorLayoutClient.tsx'),
  'utf8'
);

function renderPatternApp() {
  return render(
    <SainaAppRootLayout>
      <SainaPatternPageInner />
    </SainaAppRootLayout>
  );
}

describe('SainaPatternPageInner (Sprint C.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
    mockReplace.mockClear();
    vi.mocked(usePlan).mockReturnValue({
      plan: 'plus',
      isPlus: true,
      isFree: false,
      isLoading: false,
      source: 'server',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });
    vi.mocked(useRelationshipMapAccess).mockReturnValue({
      isLoading: false,
      canViewMapData: true,
      mapAccess: 'all',
      cutoffIso: null,
      refreshMapAccess: vi.fn(),
    });
  });

  it('renders SAINA pattern shell with conversation sidebar', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
      expect(screen.getByTestId('saina-conversation-sidebar')).toBeInTheDocument();
    });
  });

  it('renders cinematic scene behind pattern content', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-scene-analysis-layer')).toBeInTheDocument();
      expect(document.querySelector('.saina-pattern-canvas-wrap')).toBeTruthy();
    });
  });

  it('does not render legacy EZA Standalone sidebar branding', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
    });

    expect(screen.queryByText('Standalone')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /biligN/i })).toBeInTheDocument();
  });

  it('marks İlişki Deseni nav as active on pattern page', async () => {
    renderPatternApp();

    await waitFor(() => {
      const patternBtn = screen.getByTestId('saina-pattern-nav');
      expect(patternBtn).toHaveClass('saina-sidebar-dock-link--active');
    });
  });

  it('shows İlişki Deseni title and period filters', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'İlişki Haritası' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '7 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '30 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '90 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tümü' })).toBeInTheDocument();
    });
  });

  it('navigates new chat to /standalone?new=1', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yeni sohbet/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Yeni sohbet/i }));
    expect(mockReplace).toHaveBeenCalledWith('/standalone?new=1', { scroll: false });
  });

  it('navigates chat selection to /standalone?chat=...', async () => {
    localStorage.setItem(
      'eza_standalone_chat_archive',
      JSON.stringify([
        {
          id: 'chat-abc',
          title: 'Test sohbet',
          preview: 'merhaba',
          savedAt: new Date().toISOString(),
          messageCount: 1,
          messages: [{ id: 'm1', text: 'merhaba', isUser: true }],
        },
      ])
    );

    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByText('Test sohbet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test sohbet'));
    expect(mockPush).toHaveBeenCalledWith('/standalone?chat=chat-abc', { scroll: false });
  });

  it('does not show relationship map upgrade banner for locked tiers', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'server',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });
    vi.mocked(useRelationshipMapAccess).mockReturnValue({
      isLoading: false,
      canViewMapData: false,
      mapAccess: 'locked',
      cutoffIso: null,
      refreshMapAccess: vi.fn(),
    });

    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
    });

    expect(screen.queryByText(/İlişki Haritası canlı hale gelsin/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-pattern-upsell-banner')).not.toBeInTheDocument();
  });

  it('shows EZA info trigger and relationship map heading', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-trigger')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'İlişki Haritası' })).toBeInTheDocument();
      expect(screen.getByTestId('saina-eza-info-trigger')).toHaveTextContent('EZA');
      expect(screen.getByTestId('saina-eza-info-trigger')).toHaveTextContent('ⓘ');
    });
  });

  it('opens inline EZA info card instead of a right drawer', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-trigger')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('saina-eza-info-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-eza-info-drawer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('saina-eza-info-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-card')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'EZA nedir?' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /EZA hakkında daha fazla bilgi/i })).toHaveAttribute(
        'href',
        'https://eza.global'
      );
    });
  });

  it('closes EZA info card when trigger is toggled or close is clicked', async () => {
    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-trigger')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-eza-info-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-card')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-eza-info-card-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('saina-eza-info-card')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-eza-info-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-card')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-eza-info-trigger'));
    await waitFor(() => {
      expect(screen.queryByTestId('saina-eza-info-card')).not.toBeInTheDocument();
    });
  });

  it('shows activation CTA when EZA processing is disabled', async () => {
    const { setEzaUserPreferences } = await import('@/lib/eza/ezaUserPrefs');
    setEzaUserPreferences(null, {
      ezaDataProcessingEnabled: false,
      ezaVisibilityEnabled: false,
    });

    renderPatternApp();

    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-activation-cta')).toBeInTheDocument();
      expect(screen.getByTestId('saina-eza-activation-button')).toHaveTextContent(
        "EZA'yı etkinleştir"
      );
    });

    fireEvent.click(screen.getByTestId('saina-eza-info-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('saina-eza-info-card')).toBeInTheDocument();
    });
  });
});

describe('MirrorLayoutClient route split', () => {
  it('bypasses StandalonePageShell for pattern route', () => {
    expect(mirrorLayoutSrc).toContain('MIRROR_PATTERN_ROUTE');
    expect(mirrorLayoutSrc).toContain('MirrorPatternProviders');
    expect(mirrorLayoutSrc).not.toContain('StandalonePageShell');
    expect(mirrorLayoutSrc).not.toContain('MirrorNav');
  });

  it('does not mount light Daily shell for non-pattern mirror paths', () => {
    expect(mirrorLayoutSrc).not.toContain('MirrorDailyShell');
    expect(mirrorLayoutSrc).not.toContain('StandalonePageShell');
  });
});
