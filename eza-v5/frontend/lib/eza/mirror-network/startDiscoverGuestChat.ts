/**
 * Keşfet → directly open standalone guest chat (no intermediate /m/.../sohbet landing).
 */

import { createMirrorSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import {
  MIRROR_GUEST_CHAT_REPLY_PARAM,
  startMirrorGuestChat,
} from '@/lib/eza/mirror-network/mirrorGuestConversation';
import {
  trackGuestConversationStarted,
  trackSeedStart,
} from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import type { QuotaErrorDetail } from '@/lib/eza/plan/sainaQuotaMessages';

export type StartDiscoverGuestChatResult =
  | { ok: true; chatId: string; href: string }
  | { ok: false; status: number; quotaDetail?: QuotaErrorDetail };

export async function startDiscoverGuestChatFromSlug(
  slug: string,
  firstUserMessage: string,
  chatTitle?: string
): Promise<StartDiscoverGuestChatResult> {
  const text = firstUserMessage.trim();
  if (!text) return { ok: false, status: 400 };

  trackSeedStart(slug);
  const sessionResult = await createMirrorSohbetSession(slug);
  if (!sessionResult.ok) {
    return {
      ok: false,
      status: sessionResult.status,
      ...(sessionResult.quotaDetail ? { quotaDetail: sessionResult.quotaDetail } : {}),
    };
  }

  const landingTitle = chatTitle?.trim() || sessionResult.session.cardTitle;
  const created = startMirrorGuestChat({
    session: sessionResult.session,
    firstUserMessage: text,
    chatTitle: landingTitle,
  });
  if (!created) return { ok: false, status: 500 };

  trackGuestConversationStarted(sessionResult.session.mirrorSlug, sessionResult.session.guestToken);

  return {
    ok: true,
    chatId: created.chatId,
    href: `/standalone?chat=${created.chatId}&${MIRROR_GUEST_CHAT_REPLY_PARAM}=1`,
  };
}
