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

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: vi.fn(),
}));

vi.mock('@/components/standalone/MirrorEntriesContext', () => ({
  useMirrorEntries: vi.fn(() => []),
}));

import { usePlan } from '@/lib/eza/plan/usePlan';
import SainaPatternPageInner from '@/components/saina/SainaPatternPageInner';
import MirrorLayoutClient from '@/app/standalone/mirror/MirrorLayoutClient';

const mirrorLayoutSrc = readFileSync(
  join(process.cwd(), 'app/standalone/mirror/MirrorLayoutClient.tsx'),
  'utf8'
);

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
  });

  it('renders SAINA pattern shell with conversation sidebar', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
      expect(screen.getByTestId('saina-conversation-sidebar')).toBeInTheDocument();
    });
  });

  it('renders cinematic scene behind pattern content', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-scene-image-layer')).toBeInTheDocument();
      expect(document.querySelector('.saina-pattern-canvas-wrap')).toBeTruthy();
    });
  });

  it('does not render legacy EZA Standalone sidebar branding', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
    });

    expect(screen.queryByText('Standalone')).not.toBeInTheDocument();
    expect(screen.getByText('SAINA')).toBeInTheDocument();
  });

  it('marks İlişki Deseni nav as active on pattern page', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByText('Açık')).toBeInTheDocument();
    });

    const patternBtn = screen.getByRole('button', { name: /İlişki Deseni/i });
    expect(patternBtn).toHaveClass('saina-pattern-nav--active');
  });

  it('shows İlişki Deseni title and period filters', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'İlişki Deseni' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '7 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '30 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '90 Gün' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tümü' })).toBeInTheDocument();
    });
  });

  it('navigates new chat to /standalone', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yeni sohbet/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Yeni sohbet/i }));
    expect(mockReplace).toHaveBeenCalledWith('/standalone', { scroll: false });
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

    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByText('Test sohbet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test sohbet'));
    expect(mockPush).toHaveBeenCalledWith('/standalone?chat=chat-abc');
  });

  it('shows upsell banner for free users', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'server',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });

    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByText(/AI İlişki Deseni canlı hale gelsin/i)).toBeInTheDocument();
    });
  });

  it('hides upsell banner for premium users', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
    });

    expect(screen.queryByText(/AI İlişki Deseni canlı hale gelsin/i)).not.toBeInTheDocument();
  });
});

describe('MirrorLayoutClient route split', () => {
  it('bypasses StandalonePageShell for pattern route', () => {
    expect(mirrorLayoutSrc).toContain('MIRROR_PATTERN_ROUTE');
    expect(mirrorLayoutSrc).toContain('MirrorPatternProviders');
    const patternBranch = mirrorLayoutSrc.split('if (isPattern)')[1]?.split('return <MirrorDailyShell>')[0] ?? '';
    expect(patternBranch).not.toContain('StandalonePageShell');
    expect(patternBranch).not.toContain('MirrorNav');
  });

  it('keeps MirrorNav only in daily shell branch', () => {
    const dailySection = mirrorLayoutSrc.split('function MirrorDailyShell')[1] ?? '';
    expect(dailySection).toContain('<MirrorNav />');
    expect(dailySection).toContain('StandalonePageShell');
  });
});
