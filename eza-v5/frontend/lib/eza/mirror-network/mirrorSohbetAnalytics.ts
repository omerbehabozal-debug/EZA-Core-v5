/**
 * Internal analytics — seed start (UI never shows "seed").
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

const SEED_START_EVENT = 'saina:mirror-sohbet-start';
export const GUEST_CONVERSATION_STARTED_EVENT = 'saina:guest-conversation-started';
export const SECOND_USER_MESSAGE_SENT_EVENT = 'saina:second-user-message-sent';

export function trackSeedStart(mirrorSlug: string): void {
  if (typeof window === 'undefined') return;
  const key = `saina_seed_start:${mirrorSlug}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');

  window.dispatchEvent(
    new CustomEvent(SEED_START_EVENT, {
      detail: { mirrorSlug, at: new Date().toISOString() },
    })
  );

  if (process.env.NODE_ENV === 'development') {
    console.info('[SAINA] sohbet start', { mirrorSlug });
  }
}

export function trackGuestConversationStarted(
  mirrorSlug: string,
  guestToken?: string | null
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GUEST_CONVERSATION_STARTED_EVENT, {
      detail: { mirrorSlug, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('guest_conversation_started', {
    mirrorId: mirrorSlug,
    guestToken: guestToken ?? undefined,
    context: { surface: 'landing', source: 'mirror' },
  });
}

export function trackSecondUserMessageSent(
  conversationId: string,
  mirrorId?: string | null
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SECOND_USER_MESSAGE_SENT_EVENT, {
      detail: { conversationId, mirrorId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('second_user_message_sent', {
    conversationId,
    mirrorId: mirrorId ?? undefined,
    context: { surface: 'conversation', source: 'mirror' },
  });
}

export { SEED_START_EVENT };
