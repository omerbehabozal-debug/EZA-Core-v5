/**
 * Phase 5.0 / 5.1 — experience analytics boundaries (counting = Phase 6).
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const YANSI_EXPERIENCE_STARTED_EVENT = 'saina:yansi-experience-started';
export const YANSI_EXPERIENCE_COMPLETED_EVENT = 'saina:yansi-experience-completed';

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
