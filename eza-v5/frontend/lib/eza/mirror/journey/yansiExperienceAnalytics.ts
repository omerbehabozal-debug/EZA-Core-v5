/**
 * Phase 5.0 — experience-start analytics boundary (counting = Phase 6).
 * Fires when the viewer consciously starts progressive Yansı replay.
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const YANSI_EXPERIENCE_STARTED_EVENT = 'saina:yansi-experience-started';

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
