import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import YansiReelExperienceInvite from '@/components/mirror-landing/YansiReelExperienceInvite';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function artifact(count = 6): PublicFrozenJourneyArtifact {
  return { slug: 'invitation', journeyId: 'invitation', journeyVersion: 1, authorUserId: 'publisher',
    replayReady: true, selectedCount: count, steps: Array.from({ length: count }, (_, index) => ({
      stepIndex: index + 1, publicQuestion: `Question ${index + 1}?`, publicAnswer: `Answer ${index + 1}.`,
    })) };
}
describe('Reel experience invitation', () => {
  it.each([6, 8])('uses %s actual frozen steps and one existing handler', (count) => {
    const onOpenChat = vi.fn(); const parent = vi.fn();
    render(<div onClick={parent}><YansiReelExperienceInvite artifact={artifact(count)} onOpenChat={onOpenChat} /></div>);
    const button = screen.getByRole('button', { name: 'Deneyime Başla' });
    expect(screen.getByText(`${count} adımlık deneyim`)).toBeInTheDocument();
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(button); expect(onOpenChat).toHaveBeenCalledTimes(1); expect(parent).not.toHaveBeenCalled();
  });
  it.each(['not-ready', 'incomplete', 'missing-answer'])('fails closed for %s', (state) => {
    const value = artifact(); const onOpenChat = vi.fn();
    if (state === 'not-ready') value.replayReady = false;
    if (state === 'incomplete') value.steps.pop();
    if (state === 'missing-answer') value.steps[0].publicAnswer = '';
    render(<YansiReelExperienceInvite artifact={value} onOpenChat={onOpenChat} />);
    const button = screen.getByRole('button', { name: 'Deneyim hazırlanıyor…' });
    expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button); expect(onOpenChat).not.toHaveBeenCalled(); expect(screen.queryByText(/adımlık deneyim/)).toBeNull();
  });
  it('disables the CTA on a traveling surface without a handler', () => {
    render(<YansiReelExperienceInvite artifact={artifact()} />);
    expect(screen.getByRole('button', { name: 'Deneyime Başla' })).toBeDisabled();
  });
  it('keeps responsive touch/focus/motion styles scoped to the invitation', () => {
    const css = readFileSync(resolve(process.cwd(), 'styles/yansi-reel-responsive.css'), 'utf8').split('/* Reel invitation')[1];
    expect(css).toContain('min-height: 44px'); expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain(':focus-visible'); expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('max-width: 100%'); expect(css).not.toMatch(/position:\s*(fixed|absolute)/);
  });
});
