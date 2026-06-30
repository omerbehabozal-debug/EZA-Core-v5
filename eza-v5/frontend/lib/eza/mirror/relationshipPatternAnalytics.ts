/**
 * Relationship pattern analytics — EZA observation adapter.
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const RELATIONSHIP_PATTERN_VIEWED_EVENT = 'saina:relationship-pattern-viewed';

export function trackRelationshipPatternViewed(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RELATIONSHIP_PATTERN_VIEWED_EVENT, {
      detail: { at: new Date().toISOString() },
    })
  );
  ezaExperience.track('relationship_pattern_viewed', {
    context: { surface: 'pattern' },
  });
}
