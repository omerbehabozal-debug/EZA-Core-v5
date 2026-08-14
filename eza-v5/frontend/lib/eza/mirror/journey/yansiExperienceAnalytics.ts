/**
 * Phase 5.0 / 5.1 / 5.1.2 — experience analytics boundaries (counting = Phase 6).
 *
 * Skip is a frontend CustomEvent only until Phase 6 ingest exists.
 * Do not equate page view, child preload, or post-completion scroll with skip.
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const YANSI_EXPERIENCE_STARTED_EVENT = 'saina:yansi-experience-started';
export const YANSI_EXPERIENCE_COMPLETED_EVENT = 'saina:yansi-experience-completed';
export const YANSI_EXPERIENCE_SKIPPED_EVENT = 'saina:yansi-experience-skipped';

export type YansiReplayProgressSnapshot = {
  completedStepCount: number;
  replayCompleted: boolean;
  selectedCount?: number;
  journeyVersion?: number;
};

/** Conservative skip gate — started Q/A, left incomplete, not a preload/flicker. */
export function shouldRecordYansiSkip(input: {
  fromSlug: string;
  toSlug: string;
  fromProgress: YansiReplayProgressSnapshot | null | undefined;
}): boolean {
  const from = (input.fromSlug || '').trim().toLowerCase();
  const to = (input.toSlug || '').trim().toLowerCase();
  if (!from || !to || from === to) return false;
  const progress = input.fromProgress;
  if (!progress) return false;
  if (progress.replayCompleted) return false;
  if (progress.completedStepCount <= 0) return false;
  return true;
}

export function trackYansiExperienceStarted(input: {
  slug: string;
  journeyVersion: number;
}): void {
  if (typeof window === 'undefined') return;
  const slug = input.slug.trim().toLowerCase();
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_STARTED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        at: new Date().toISOString(),
      },
    })
  );
  ezaExperience.track('yansi_experience_started', {
    mirrorId: slug,
    context: {
      surface: 'frozen_replay',
      journeyVersion: input.journeyVersion,
    },
  });
}

export function trackYansiExperienceCompleted(input: {
  slug: string;
  journeyVersion: number;
}): void {
  if (typeof window === 'undefined') return;
  const slug = input.slug.trim().toLowerCase();
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_COMPLETED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        at: new Date().toISOString(),
      },
    })
  );
  ezaExperience.track('yansi_experience_completed', {
    mirrorId: slug,
    context: {
      surface: 'frozen_replay',
      journeyVersion: input.journeyVersion,
    },
  });
}

export function trackYansiExperienceSkipped(input: {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
  selectedCount: number;
  destinationSlug?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  if (
    !shouldRecordYansiSkip({
      fromSlug: input.slug,
      toSlug: input.destinationSlug || '',
      fromProgress: {
        completedStepCount: input.completedStepCount,
        replayCompleted: false,
        selectedCount: input.selectedCount,
        journeyVersion: input.journeyVersion,
      },
    })
  ) {
    return;
  }
  const slug = input.slug.trim().toLowerCase();
  const destination = (input.destinationSlug || '').trim().toLowerCase() || null;
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_SKIPPED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        completedStepCount: input.completedStepCount,
        selectedCount: input.selectedCount,
        destinationSlug: destination,
        at: new Date().toISOString(),
      },
    })
  );
  // Phase 6 may ingest this; do not POST to observation until backend allowlists it.
}
