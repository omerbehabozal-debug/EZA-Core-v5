/**
 * Mirror share analytics — CustomEvent + EZA observation adapter.
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

export const MIRROR_SHARE_OPENED_EVENT = 'saina:mirror-share-opened';
export const MIRROR_SHARED_EVENT = 'saina:mirror-shared';

export function trackMirrorShareOpened(mirrorId?: string | null, conversationId?: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_SHARE_OPENED_EVENT, {
      detail: { mirrorId, conversationId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('mirror_share_opened', {
    mirrorId,
    conversationId,
    context: { surface: 'share' },
  });
}

export function trackMirrorShared(mirrorId?: string | null, conversationId?: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_SHARED_EVENT, {
      detail: { mirrorId, conversationId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('mirror_shared', {
    mirrorId,
    conversationId,
    context: { surface: 'share' },
  });
}
