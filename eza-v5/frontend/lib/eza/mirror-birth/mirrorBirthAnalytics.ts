/**
 * Mirror Birth Intelligence analytics — conversion funnel (Stage 4A).
 */

export const MIRROR_BIRTH_SUGGESTED_EVENT = 'saina:mirror-birth-suggested';
export const MIRROR_BIRTH_DISMISSED_EVENT = 'saina:mirror-birth-dismissed';
export const MIRROR_BIRTH_ACCEPTED_EVENT = 'saina:mirror-birth-accepted';
export const MIRROR_BIRTH_GENERATE_EVENT = 'saina:mirror-birth-generate';

export function trackMirrorBirthSuggested(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_SUGGESTED_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
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
}

export function requestMirrorBirthGeneration(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MIRROR_BIRTH_GENERATE_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
}
