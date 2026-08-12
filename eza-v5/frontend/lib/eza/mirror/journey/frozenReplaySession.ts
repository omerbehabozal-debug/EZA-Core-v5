/**
 * Phase 5.0 — lightweight frozen replay session (presentation only).
 * Frozen artifact remains server authority; this stores progress pointers only.
 */

import type { PublicFrozenJourneyArtifact } from './publicFrozenTypes';

export type FrozenReplayPhase =
  | 'idle'
  | 'active'
  | 'revealing'
  | 'awaiting_next'
  | 'completed'
  | 'unavailable';

export type FrozenReplaySession = {
  slug: string;
  journeyVersion: number;
  /** 0-based index of the next step to ask (completed count). */
  completedStepCount: number;
  replayStarted: boolean;
  replayCompleted: boolean;
  phase: FrozenReplayPhase;
};

export type FrozenReplayProgress = {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
  replayCompleted: boolean;
};

const PROGRESS_KEY_PREFIX = 'eza_frozen_replay_progress_v1:';

export function frozenReplayProgressKey(slug: string, journeyVersion: number): string {
  return `${PROGRESS_KEY_PREFIX}${slug.trim().toLowerCase()}:v${journeyVersion}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

export function createIdleReplaySession(slug: string): FrozenReplaySession {
  return {
    slug: slug.trim().toLowerCase(),
    journeyVersion: 0,
    completedStepCount: 0,
    replayStarted: false,
    replayCompleted: false,
    phase: 'idle',
  };
}

export function startReplaySession(
  artifact: PublicFrozenJourneyArtifact,
  resumed?: FrozenReplayProgress | null
): FrozenReplaySession {
  const max = artifact.steps.length;
  const completed = Math.max(
    0,
    Math.min(max, resumed?.completedStepCount ?? 0)
  );
  const completedDone = resumed?.replayCompleted === true && completed >= max;
  return {
    slug: artifact.slug,
    journeyVersion: artifact.journeyVersion,
    completedStepCount: completed,
    replayStarted: true,
    replayCompleted: completedDone,
    phase: completedDone
      ? 'completed'
      : completed > 0
        ? 'awaiting_next'
        : 'awaiting_next',
  };
}

/** Next step to offer as a question button, or null when done. */
export function getNextReplayStep(artifact: PublicFrozenJourneyArtifact, session: FrozenReplaySession) {
  if (!session.replayStarted || session.replayCompleted) return null;
  if (session.phase === 'revealing') return null;
  const idx = session.completedStepCount;
  if (idx < 0 || idx >= artifact.steps.length) return null;
  return artifact.steps[idx] ?? null;
}

export function afterQuestionTapped(session: FrozenReplaySession): FrozenReplaySession {
  return { ...session, phase: 'revealing' };
}

export function afterAnswerRevealed(
  session: FrozenReplaySession,
  totalSteps: number
): FrozenReplaySession {
  const nextCount = Math.min(totalSteps, session.completedStepCount + 1);
  const done = nextCount >= totalSteps;
  return {
    ...session,
    completedStepCount: nextCount,
    phase: done ? 'completed' : 'awaiting_next',
    replayCompleted: done,
  };
}

export function loadFrozenReplayProgress(
  slug: string,
  journeyVersion: number
): FrozenReplayProgress | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(frozenReplayProgressKey(slug, journeyVersion));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FrozenReplayProgress;
    if (
      !parsed ||
      parsed.slug !== slug.trim().toLowerCase() ||
      parsed.journeyVersion !== journeyVersion ||
      typeof parsed.completedStepCount !== 'number'
    ) {
      return null;
    }
    return {
      slug: parsed.slug,
      journeyVersion: parsed.journeyVersion,
      completedStepCount: Math.max(0, Math.trunc(parsed.completedStepCount)),
      replayCompleted: Boolean(parsed.replayCompleted),
    };
  } catch {
    return null;
  }
}

export function saveFrozenReplayProgress(session: FrozenReplaySession): void {
  if (!session.replayStarted || session.journeyVersion < 1) return;
  const ls = storage();
  if (!ls) return;
  try {
    const payload: FrozenReplayProgress = {
      slug: session.slug,
      journeyVersion: session.journeyVersion,
      completedStepCount: session.completedStepCount,
      replayCompleted: session.replayCompleted,
    };
    ls.setItem(
      frozenReplayProgressKey(session.slug, session.journeyVersion),
      JSON.stringify(payload)
    );
  } catch {
    /* ignore */
  }
}

export function clearFrozenReplayProgress(slug: string, journeyVersion: number): void {
  const ls = storage();
  try {
    ls?.removeItem(frozenReplayProgressKey(slug, journeyVersion));
  } catch {
    /* ignore */
  }
}

/** Test helper */
export function clearAllFrozenReplayProgressForTests(): void {
  const ls = storage();
  if (!ls) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k?.startsWith(PROGRESS_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  } catch {
    /* ignore */
  }
}
