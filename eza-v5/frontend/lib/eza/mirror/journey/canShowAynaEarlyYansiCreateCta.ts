/**
 * Ayna 6–7 early "Yansı oluştur" visibility.
 * Journey state remains authority — no independent Q/A counter.
 */

import { requiresAuthenticatedJourneyYansiGate } from './authenticatedJourneyYansiGate';
import { getEarlyYansiReviewWindowIndex } from './journeyWindows';
import type { JourneyConversationState } from './journeyWindows';

export function canShowAynaEarlyYansiCreateCta(input: {
  isAuthenticated: boolean;
  conversationId?: string | null;
  invitationEnabled?: boolean;
  journeyState: JourneyConversationState | null;
}): boolean {
  if (
    !requiresAuthenticatedJourneyYansiGate({
      isAuthenticated: input.isAuthenticated,
      conversationId: input.conversationId,
      invitationEnabled: input.invitationEnabled,
    })
  ) {
    return false;
  }
  // Encodes: 6–7 pairs in current window, not awaiting 8, not reviewing,
  // not generating/ready/skipped/confirmed/failed for that window.
  return getEarlyYansiReviewWindowIndex(input.journeyState) != null;
}
