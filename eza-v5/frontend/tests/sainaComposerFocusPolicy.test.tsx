/**
 * Mobile vs desktop composer focus policy.
 *
 * useSainaCompactShell === true  → min-width 900px (desktop autofocus OK)
 * useSainaCompactShell === false → mobile (<900) — no programmatic focus
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';
import { SAINA_COMPOSER_PLACEHOLDER } from '@/lib/eza/sainaCopy';

let mockCompact = false;

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaMinWidth: (min: number) => mockCompact && min >= SAINA_COMPACT_SHELL_MIN_PX,
  useSainaCompactShell: () => mockCompact,
}));

vi.mock('@/lib/eza/sainaChromeStore', () => ({
  useSainaChromeStore: (sel: (s: { onOpenMirror?: () => void }) => unknown) =>
    sel({ onOpenMirror: undefined }),
}));

import SainaComposer from '@/components/saina/SainaComposer';

function composerInput(): HTMLInputElement {
  return screen.getByLabelText('Mesaj yaz') as HTMLInputElement;
}

describe('SainaComposer focus policy', () => {
  beforeEach(() => {
    mockCompact = false;
  });

  afterEach(() => {
    mockCompact = false;
  });

  it('MOBILE cold mount does not focus composer', async () => {
    mockCompact = false;
    render(<SainaComposer onSend={() => undefined} isLoading={false} />);
    await waitFor(() => {
      expect(composerInput()).toBeInTheDocument();
    });
    expect(document.activeElement).not.toBe(composerInput());
  });

  it('MOBILE isLoading true → false does not focus composer', async () => {
    mockCompact = false;
    const { rerender } = render(
      <SainaComposer onSend={() => undefined} isLoading={true} />
    );
    expect(document.activeElement).not.toBe(composerInput());

    rerender(<SainaComposer onSend={() => undefined} isLoading={false} />);
    await waitFor(() => {
      expect(composerInput()).not.toBeDisabled();
    });
    expect(document.activeElement).not.toBe(composerInput());
  });

  it('MOBILE disabled true → false does not focus composer', async () => {
    mockCompact = false;
    const { rerender } = render(
      <SainaComposer onSend={() => undefined} isLoading={false} disabled />
    );
    expect(document.activeElement).not.toBe(composerInput());

    rerender(<SainaComposer onSend={() => undefined} isLoading={false} disabled={false} />);
    await waitFor(() => {
      expect(composerInput()).not.toBeDisabled();
    });
    expect(document.activeElement).not.toBe(composerInput());
  });

  it('MOBILE remount path does not focus composer', async () => {
    mockCompact = false;
    const { unmount } = render(
      <SainaComposer onSend={() => undefined} isLoading={false} />
    );
    unmount();
    render(<SainaComposer onSend={() => undefined} isLoading={false} />);
    await waitFor(() => expect(composerInput()).toBeInTheDocument());
    expect(document.activeElement).not.toBe(composerInput());
  });

  it('MOBILE explicit click/focus still works; no forced blur', async () => {
    mockCompact = false;
    render(<SainaComposer onSend={() => undefined} isLoading={false} />);
    const input = composerInput();
    expect(document.activeElement).not.toBe(input);

    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'Merhaba' } });
    expect(input.value).toBe('Merhaba');
    expect(document.activeElement).toBe(input);
  });

  it('DESKTOP ready mount autofocuses composer', async () => {
    mockCompact = true;
    render(<SainaComposer onSend={() => undefined} isLoading={false} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(composerInput());
    });
  });

  it('DESKTOP loading → ready preserves autofocus', async () => {
    mockCompact = true;
    const { rerender } = render(
      <SainaComposer onSend={() => undefined} isLoading={true} />
    );
    rerender(<SainaComposer onSend={() => undefined} isLoading={false} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(composerInput());
    });
  });

  it('send behavior still works on mobile without prior autofocus', async () => {
    mockCompact = false;
    const onSend = vi.fn();
    render(<SainaComposer onSend={onSend} isLoading={false} />);
    const input = composerInput();
    fireEvent.change(input, { target: { value: 'Merhaba' } });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    expect(onSend).toHaveBeenCalledWith('Merhaba');
    expect(screen.getByPlaceholderText(SAINA_COMPOSER_PLACEHOLDER)).toBeInTheDocument();
  });
});
