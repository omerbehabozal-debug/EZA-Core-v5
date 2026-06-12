import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/saina/SainaStandaloneShell', () => ({
  default: () => <div data-testid="saina-standalone-shell-branch">SAINA shell</div>,
}));

vi.mock('@/hooks/useStreamResponse', () => ({
  useStreamResponse: () => ({
    startStream: vi.fn(),
    reset: vi.fn(),
  }),
}));

import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';

describe('StandaloneChatInner default shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('always renders SainaStandaloneShell without feature flag', async () => {
    render(<StandaloneChatInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-standalone-shell-branch')).toBeInTheDocument();
    });
  });
});
