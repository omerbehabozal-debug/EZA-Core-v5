/**
 * Mirror landing analytics — CustomEvent + EZA observation adapter.
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const LANDING_VIEWED_EVENT = 'saina:landing-viewed';
export const LANDING_CTA_CLICKED_EVENT = 'saina:landing-cta-clicked';

export function trackLandingViewed(mirrorSlug: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LANDING_VIEWED_EVENT, {
      detail: { mirrorSlug, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('landing_viewed', {
    mirrorId: mirrorSlug,
    context: { surface: 'landing' },
  });
}

export function trackLandingCtaClicked(mirrorSlug: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LANDING_CTA_CLICKED_EVENT, {
      detail: { mirrorSlug, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('landing_cta_clicked', {
    mirrorId: mirrorSlug,
    context: { surface: 'landing' },
  });
}
