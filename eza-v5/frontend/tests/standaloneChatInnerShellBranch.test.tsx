import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const shellRenderProps = vi.fn();

vi.mock('@/components/saina/SainaStandaloneShell', () => ({
  default: (props: Record<string, unknown>) => {
    shellRenderProps(props);
    return <div data-testid="saina-standalone-shell-branch">SAINA shell</div>;
  },
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: vi.fn(() => ({
    plan: 'free',
    isPlus: false,
    isFree: true,
    isLoading: false,
    source: 'default',
    setPlan: vi.fn(),
    refreshPlan: vi.fn(),
  })),
}));

vi.mock('@/hooks/useStreamResponse', () => ({
  useStreamResponse: () => ({
    startStream: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { usePlan } from '@/lib/eza/plan/usePlan';
import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';

describe('StandaloneChatInner default shell', () => {
  beforeEach(() => {
    localStorage.clear();
    shellRenderProps.mockClear();
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'default',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });
  });

  it('always renders SainaStandaloneShell without feature flag', async () => {
    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-standalone-shell-branch')).toBeInTheDocument();
    });
  });

  it('hydrates plan from server on mount', async () => {
    const refreshPlan = vi.fn();
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'default',
      setPlan: vi.fn(),
      refreshPlan,
    });

    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(refreshPlan).toHaveBeenCalled();
    });
  });

  it('passes loading plan tier while plan is hydrating', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: true,
      source: 'default',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });

    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(shellRenderProps).toHaveBeenCalled();
    });

    const latestProps = shellRenderProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.planTier).toBe('loading');
  });

  it('passes unknown plan tier when server fetch fails', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'unknown',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });

    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(shellRenderProps).toHaveBeenCalled();
    });

    const latestProps = shellRenderProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.planTier).toBe('unknown');
  });

  it('passes free plan tier to shell when user is not plus', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'free',
      isPlus: false,
      isFree: true,
      isLoading: false,
      source: 'server',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });

    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(shellRenderProps).toHaveBeenCalled();
    });

    const latestProps = shellRenderProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.planTier).toBe('free');
    expect(typeof latestProps?.onUpgrade).toBe('function');
  });

  it('passes premium plan tier to shell when user is plus', async () => {
    vi.mocked(usePlan).mockReturnValue({
      plan: 'plus',
      isPlus: true,
      isFree: false,
      isLoading: false,
      source: 'server',
      setPlan: vi.fn(),
      refreshPlan: vi.fn(),
    });

    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(shellRenderProps).toHaveBeenCalled();
    });

    const latestProps = shellRenderProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.planTier).toBe('premium');
  });
});
