/**
 * Mirror Birth Intelligence analytics — conversion funnel (Stage 4A).
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';
import type { MirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';

export const MIRROR_BIRTH_SUGGESTED_EVENT = 'saina:mirror-birth-suggested';
export const MIRROR_BIRTH_DISMISSED_EVENT = 'saina:mirror-birth-dismissed';
export const MIRROR_BIRTH_ACCEPTED_EVENT = 'saina:mirror-birth-accepted';
export const MIRROR_BIRTH_GENERATE_EVENT = 'saina:mirror-birth-generate';
export const MIRROR_CREATED_EVENT = 'saina:mirror-created';

export function trackMirrorBirthSuggested(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_SUGGESTED_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('mirror_birth_suggested', {
    conversationId,
    context: { surface: 'conversation' },
  });
}

export function trackMirrorBirthDismissed(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_DISMISSED_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
}

export function trackMirrorBirthAccepted(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_ACCEPTED_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('mirror_birth_accepted', {
    conversationId,
    context: { surface: 'conversation' },
  });
}

export function trackMirrorCreated(
  conversationId: string,
  mirrorId?: string | null,
  lineage?: Pick<MirrorPublishLineage, 'parentMirrorId' | 'rootMirrorId'>
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_CREATED_EVENT, {
      detail: { conversationId, mirrorId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('mirror_created', {
    conversationId,
    mirrorId: mirrorId ?? undefined,
    parentMirrorId: lineage?.parentMirrorId,
    rootMirrorId: lineage?.rootMirrorId,
    context: { surface: 'mirror' },
  });
}

export function requestMirrorBirthGeneration(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_GENERATE_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
}
