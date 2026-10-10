import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { setEzaUserPreferences } from '@/lib/eza/ezaUserPrefs';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';

const snapshot = { assistantScore: 91, userScore: 80, ezaFinal: 91, inputHealth: .7,
  outputHealth: .8, alignmentScore: .9, redirect: true, redirectBenign: false, intent: 'private',
  behavioral: { vector: { eza_final: 91 }, nested: { userScore: 80 } } };
function raw(version: number) {
  return { slug: 'privacy', journeyId: 'privacy', journeyVersion: version, selectedCount: 6,
    authorUserId: 'publisher', replayReady: true, extra: { ezaSnapshot: snapshot },
    steps: Array.from({ length: 6 }, (_, i) => ({ stepIndex: i + 1, publicQuestion: `Question ${i + 1}?`,
      publicAnswer: `Answer ${i + 1}.`, ezaSnapshot: snapshot, ...snapshot })) };
}
const forbidden = new Set(['ezaSnapshot', ...Object.keys(snapshot)]);
function check(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { expect(forbidden.has(key)).toBe(false); check(child); }
}
beforeEach(() => { localStorage.clear(); clearAllFrozenReplayProgressForTests(); setEzaUserPreferences(null, { ezaVisibilityEnabled: true }); });
describe('public frozen privacy', () => {
  it.each([1, 9])('drops old/nested analysis from version %s while retaining public content', (version) => {
    const input = raw(version); const before = JSON.stringify(input);
    const artifact = parsePublicFrozenJourneyArtifact(input)!;
    check(artifact); expect(artifact.journeyVersion).toBe(version);
    expect(artifact.steps[0]).toEqual({ stepIndex: 1, publicQuestion: 'Question 1?', publicAnswer: 'Answer 1.' });
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([false, true])('never displays source analysis even with visibility ON and stale runtime data (desktop=%s)', async (desktop) => {
    const artifact = parsePublicFrozenJourneyArtifact(raw(1))!;
    // Simulate an artifact retained in memory before the hotfix parser ran.
    Object.assign(artifact.steps[0], { ezaSnapshot: snapshot, ...snapshot });
    const { container } = render(<MirrorFrozenReplay artifact={artifact} desktopIdentity={desktop ? {
      title: 'Public', displayName: 'Publisher', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null,
    } : undefined} />);
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(screen.getByText('Answer 1.')).toBeInTheDocument());
    expect(container.querySelector('.saina-tone-pill')).toBeNull();
    expect(container.querySelector('.saina-tone-pill-detail')).toBeNull();
    expect(container.textContent).not.toContain('91');
  });
});
