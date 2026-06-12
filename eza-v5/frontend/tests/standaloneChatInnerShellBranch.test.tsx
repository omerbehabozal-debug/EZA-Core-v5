import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const shellEnabled = vi.hoisted(() => ({ value: false }));

vi.mock('@/lib/eza/sainaStandaloneShell', () => ({
  isSainaStandaloneShellEnabled: () => shellEnabled.value,
}));

vi.mock('@/components/saina/SainaStandaloneShell', () => ({
  default: () => <div data-testid="saina-standalone-shell-branch">SAINA shell</div>,
}));

vi.mock('@/components/standalone/StandaloneChatLayout', () => ({
  default: () => <div data-testid="legacy-chat-layout-branch">Legacy layout</div>,
}));

vi.mock('@/hooks/useStreamResponse', () => ({
  useStreamResponse: () => ({
    startStream: vi.fn(),
    reset: vi.fn(),
  }),
}));

import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';

describe('StandaloneChatInner shell branch', () => {
  beforeEach(() => {
    shellEnabled.value = false;
    localStorage.clear();
  });

  it('renders legacy StandaloneChatLayout when flag is false', async () => {
    shellEnabled.value = false;
    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(screen.getByTestId('legacy-chat-layout-branch')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('saina-standalone-shell-branch')).not.toBeInTheDocument();
  });

  it('renders SainaStandaloneShell when flag is true', async () => {
    shellEnabled.value = true;
    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-standalone-shell-branch')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('legacy-chat-layout-branch')).not.toBeInTheDocument();
  });
});
