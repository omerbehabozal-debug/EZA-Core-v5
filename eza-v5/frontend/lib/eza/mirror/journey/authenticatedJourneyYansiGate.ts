/**
 * Authenticated Saina conversation Yansı gate.
 *
 * When the Yansı invitation flow is enabled, real Yansı creation for an
 * authenticated conversation must go through:
 *   8 eligible Q/A → decision banner → Review8 (6–8) → confirm → journey kick
 *
 * Legacy DailyMirrorCreatePrompt / Mirror Birth must not bypass that path.
 * Guest / non-conversation / invitation-off surfaces keep legacy create.
 */

import { isSainaYansiInvitationEnabled } from '@/lib/eza/mirror/journey/journeyClientFlag';
import { listJourneyArtifactsForConversation } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';

export function requiresAuthenticatedJourneyYansiGate(input: {
  isAuthenticated: boolean;
  conversationId?: string | null;
  /** Override for tests; defaults to live invitation flag. */
  invitationEnabled?: boolean;
}): boolean {
  const invitationOn =
    typeof input.invitationEnabled === 'boolean'
      ? input.invitationEnabled
      : isSainaYansiInvitationEnabled();
  if (!invitationOn) return false;
  if (!input.isAuthenticated) return false;
  return Boolean((input.conversationId || '').trim());
}

/**
 * True when this conversation already has a Journey/Review8-backed Yansı
 * artifact (generating, ready, or published). Used to allow remount hydrate
 * without reopening the legacy create path.
 */
export function hasJourneyBackedYansiArtifact(input: {
  ownerUserId?: string | null;
  conversationId?: string | null;
}): boolean {
  const owner = (input.ownerUserId || '').trim();
  const conversationId = (input.conversationId || '').trim();
  if (!owner || !conversationId) return false;
  return listJourneyArtifactsForConversation(owner, conversationId).some(
    (artifact) =>
      artifact.status === 'generating' ||
      artifact.status === 'ready' ||
      artifact.status === 'published'
  );
}
