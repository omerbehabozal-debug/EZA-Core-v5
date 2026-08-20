/**
 * Phase 5.0 — progressive frozen Yansı replay.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer')
  >('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer');
  return {
    ...actual,
    fetchPublicFrozenJourneyArtifact: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({
  createMirrorSohbetSession: vi.fn(),
}));

vi.mock('@/lib/eza/mirror/journey/yansiExperienceAnalytics', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/eza/mirror/journey/yansiExperienceAnalytics')
  >();
  return {
    ...actual,
    trackYansiExperienceStarted: vi.fn(),
  };
});

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import { createMirrorSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import { trackYansiExperienceStarted } from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import {
  clearAllFrozenReplayProgressForTests,
  getNextReplayStep,
  startReplaySession,
  afterQuestionTapped,
  afterAnswerRevealed,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  clearEzaUserPreferencesForTests,
  getEzaUserPreferences,
  resolveFrozenEzaSnapshotForDisplay,
  setEzaUserPreferences,
  shouldShowEzaInExperience,
} from '@/lib/eza/ezaUserPrefs';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';

function makeArtifact(n: 6 | 7 | 8, overrides?: Partial<PublicFrozenJourneyArtifact>) {
  const steps = Array.from({ length: n }, (_, i) => ({
    stepIndex: i + 1,
    publicQuestion: `Soru ${i + 1} tam metin?`,
    publicAnswer: `Cevap ${i + 1} birebir.`,
    ezaSnapshot:
      i === 0
        ? { assistantScore: 91, userScore: 80, ezaFinal: 91 }
        : i === 1
          ? null
          : { assistantScore: 70 + i },
  }));
  return parsePublicFrozenJourneyArtifact({
    slug: 'demo-yansi',
    journeyId: 'demo-yansi',
    journeyVersion: 1,
    publicTitle: 'Demo',
    publicSummary: 'Özet',
    authorUserId: 'alice',
    selectedCount: n,
    steps,
    replayReady: true,
    ...overrides,
  })!;
}

beforeEach(() => {
  clearAllFrozenReplayProgressForTests();
  clearEzaUserPreferencesForTests();
  localStorage.clear();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(createMirrorSohbetSession).mockReset();
  vi.mocked(trackYansiExperienceStarted).mockReset();
});

describe('Phase 5.0 session progression', () => {
  it.each([6, 7, 8] as const)('A/B/C. %s-step progressive questions', (n) => {
    const artifact = makeArtifact(n);
    let session = startReplaySession(artifact);
    expect(getNextReplayStep(artifact, session)?.stepIndex).toBe(1);

    for (let i = 0; i < n; i += 1) {
      const next = getNextReplayStep(artifact, session);
      expect(next?.stepIndex).toBe(i + 1);
      session = afterQuestionTapped(session);
      expect(getNextReplayStep(artifact, session)).toBeNull();
      session = afterAnswerRevealed(session, n);
    }
    expect(session.replayCompleted).toBe(true);
    expect(getNextReplayStep(artifact, session)).toBeNull();
  });

  it('D/E/F. only one next question; Q3 hidden before Q2 complete', () => {
    const artifact = makeArtifact(6);
    let session = startReplaySession(artifact);
    expect(getNextReplayStep(artifact, session)?.publicQuestion).toBe('Soru 1 tam metin?');
    session = afterQuestionTapped(session);
    expect(getNextReplayStep(artifact, session)).toBeNull();
    session = afterAnswerRevealed(session, 6);
    expect(getNextReplayStep(artifact, session)?.stepIndex).toBe(2);
    session = afterQuestionTapped(session);
    expect(getNextReplayStep(artifact, session)).toBeNull();
  });

  it('G. frozen text matches server artifact exactly', () => {
    const artifact = makeArtifact(6);
    expect(artifact.steps[0].publicQuestion).toBe('Soru 1 tam metin?');
    expect(artifact.steps[0].publicAnswer).toBe('Cevap 1 birebir.');
  });

  it('P. version pin: session keeps v1 when artifact prop would be v2', () => {
    const v1 = makeArtifact(6, { journeyVersion: 1 });
    const session = startReplaySession(v1);
    expect(session.journeyVersion).toBe(1);
    const v2 = makeArtifact(6, { journeyVersion: 2 });
    // Starting a new session on v2 is separate; active v1 session object unchanged.
    expect(session.journeyVersion).not.toBe(v2.journeyVersion);
  });
});

describe('Phase 5.0 EZA display', () => {
  it('J/K/L/M. visibility gates frozen snapshot without scoring fetch', () => {
    const fetchSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;
    const snap = { assistantScore: 91, userScore: 80 };
    setEzaUserPreferences(null, { ezaVisibilityEnabled: true });
    expect(resolveFrozenEzaSnapshotForDisplay(snap, getEzaUserPreferences(null))).toEqual(snap);
    setEzaUserPreferences(null, { ezaVisibilityEnabled: false });
    expect(resolveFrozenEzaSnapshotForDisplay(snap, getEzaUserPreferences(null))).toBeNull();
    expect(resolveFrozenEzaSnapshotForDisplay(null, getEzaUserPreferences(null))).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('N/O. processing preference does not alter frozen artifact / no profile write', () => {
    const artifact = makeArtifact(6);
    const before = JSON.stringify(artifact);
    setEzaUserPreferences('bob', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    });
    expect(JSON.stringify(artifact)).toBe(before);
    expect(shouldShowEzaInExperience(getEzaUserPreferences('bob'))).toBe(false);
  });
});

describe('Phase 5.0 UI', () => {
  it('D. initial replay shows only Q1 button', async () => {
    const artifact = makeArtifact(6);
    render(<MirrorFrozenReplay artifact={artifact} />);
    const btn = await screen.findByTestId('mirror-frozen-replay-next-question');
    expect(btn).toHaveTextContent('Soru 1 tam metin?');
    expect(screen.queryByText('Soru 2 tam metin?')).toBeNull();
  });

  it('E. tap Q1 → user bubble + answer + then Q2', async () => {
    const artifact = makeArtifact(6);
    render(<MirrorFrozenReplay artifact={artifact} />);
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    expect(screen.getAllByText('Soru 1 tam metin?').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText('Cevap 1 birebir.')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
        'Soru 2 tam metin?'
      );
    });
  });

  it('R/S. completion CTA routes to existing /sohbet path', async () => {
    const artifact = makeArtifact(6);
    let session = startReplaySession(artifact);
    for (let i = 0; i < 6; i += 1) {
      session = afterAnswerRevealed(afterQuestionTapped(session), 6);
    }
    // Render with pre-completed progress
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:demo-yansi:v1`,
      JSON.stringify({
        slug: 'demo-yansi',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );
    render(<MirrorFrozenReplay artifact={artifact} />);
    const continueLink = await screen.findByTestId('mirror-frozen-replay-continue');
    expect(continueLink).toHaveAttribute('href', '/m/demo-yansi/sohbet');
    expect(continueLink).toHaveTextContent('Kendi merakımla devam et');
  });

  it('landing start CTA appears when frozen ready', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(makeArtifact(6));
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'demo-yansi',
          cardTitle: 'Demo',
          cardDate: '2026-08-12',
          dayLabel: '12 Ağustos',
          sceneImageUrl: null,
          curiosityContext: 'Özet',
        }}
      />
    );
    expect(await screen.findByTestId('mirror-experience-start')).toHaveTextContent(
      'Bu merakı deneyimle'
    );
  });

  it('malformed / unavailable frozen fails closed without live sohbet CTA (Phase 8.2)', async () => {
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(null);
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'legacy',
          cardTitle: 'Legacy',
          cardDate: '2026-08-12',
          dayLabel: '12 Ağustos',
          sceneImageUrl: null,
          curiosityContext: 'Özet',
        }}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('mirror-experience-unavailable-inline')).toBeTruthy();
    });
    expect(screen.getByText('Bu Yansı şu an deneyimlenemiyor.')).toBeTruthy();
    expect(screen.queryByText('Bu konudan devam et')).toBeNull();
    expect(screen.queryByRole('link', { name: /devam et/i })).toBeNull();
    expect(screen.queryByTestId('mirror-experience-start')).toBeNull();
    expect(document.querySelector('a[href="/m/legacy/sohbet"]')).toBeNull();
    expect(vi.mocked(trackYansiExperienceStarted)).not.toHaveBeenCalled();
    expect(vi.mocked(createMirrorSohbetSession)).not.toHaveBeenCalled();
  });
});

describe('Phase 5.0 parse fail-closed', () => {
  it('I. malformed steps reject entire artifact (no AI repair)', () => {
    expect(
      parsePublicFrozenJourneyArtifact({
        slug: 'x',
        journeyId: 'x',
        journeyVersion: 1,
        authorUserId: 'a',
        selectedCount: 6,
        replayReady: true,
        steps: [{ stepIndex: 1, publicQuestion: 'Q', publicAnswer: '' }],
      })
    ).toBeNull();
  });

  it('H. parse does not invent generation — only validates stored fields', () => {
    const artifact = makeArtifact(6);
    expect(artifact.steps.every((s) => s.publicAnswer.includes('birebir'))).toBe(true);
  });
});
