/**
 * Authenticated Saina conversation Yansı gate.
 *
 * When the Yansı invitation flow is enabled, real Yansı creation for an
 * authenticated conversation must go through:
 *   ≥6 eligible Q/A → Review8 select (6–8) → confirm → journey kick
 *   (at 8 pairs the existing create / continue decision banner still applies)
 *
 * Legacy DailyMirrorCreatePrompt / Mirror Birth must not bypass that path.
 * Guest / invitation-off surfaces keep legacy create.
 *
 * Pending drafts (no conversationId yet) stay gated while authenticated so the
 * early 3-sample CreatePrompt cannot fire before the Journey path.
 */

import { isSainaYansiInvitationEnabled } from '@/lib/eza/mirror/journey/journeyClientFlag';
import { listJourneyArtifactsForConversation } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { readPendingJourneyAynaGeneration } from '@/lib/eza/mirror/journey/journeyAynaGenerate';

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
  // Authenticated + invitation: always gate legacy create (including pending chat).
  return true;
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

/**
 * Generation / reveal may run for an authenticated gated conversation only when
 * Review8 confirm (or an equivalent Journey kick) has authorized it, or a
 * Journey-backed artifact already exists (hydrate / retry).
 */
export function canAuthorizeAuthenticatedJourneyMirrorReveal(input: {
  isAuthenticated: boolean;
  conversationId?: string | null;
  ownerUserId?: string | null;
  journeyAuthorizedReveal: boolean;
  invitationEnabled?: boolean;
}): boolean {
  if (
    !requiresAuthenticatedJourneyYansiGate({
      isAuthenticated: input.isAuthenticated,
      conversationId: input.conversationId,
      invitationEnabled: input.invitationEnabled,
    })
  ) {
    return true; // legacy path may generate
  }
  if (input.journeyAuthorizedReveal) return true;
  const conversationId = (input.conversationId || '').trim();
  if (conversationId && readPendingJourneyAynaGeneration(conversationId)) {
    return true;
  }
  return hasJourneyBackedYansiArtifact({
    ownerUserId: input.ownerUserId,
    conversationId: input.conversationId,
  });
}
