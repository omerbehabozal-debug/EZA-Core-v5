/**
 * Phase — owner-wide READY Yansı preparation bootstrap for clean browsers.
 * Upserts into the existing MirrorJourneyArtifact store (no second sidebar source).
 */

import {
  getServerConversationAuthority,
  isServerConversationAuthorityValid,
} from '@/lib/eza/serverConversationStore';
import { listAllServerYansiPreparationsForOwner } from '@/lib/eza/standaloneConversationsApi';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { upsertMirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { artifactFromServerYansiPreparation } from '@/lib/eza/mirror/journey/hydrateYansiPreparationsFromServer';

/**
 * Fetch all owner-wide server preparations and upsert into the local artifact store.
 * Failure-safe: throws only if the caller wants to log; bootstrap should catch.
 * Never clears the artifact store on failure.
 */
export async function hydrateOwnerYansiPreparationsFromServer(input: {
  ownerUserId: string | null | undefined;
  ownerAtStart: string | null;
  epochAtStart: number;
}): Promise<MirrorJourneyArtifact[]> {
  const owner = (input.ownerUserId || '').trim();
  if (!owner) return [];
  if (!isServerConversationAuthorityValid(input.ownerAtStart, input.epochAtStart)) {
    return [];
  }

  const items = await listAllServerYansiPreparationsForOwner();

  if (!isServerConversationAuthorityValid(input.ownerAtStart, input.epochAtStart)) {
    return [];
  }
  if (getServerConversationAuthority().ownerKey !== owner) {
    return [];
  }

  const hydrated: MirrorJourneyArtifact[] = [];
  for (const row of items) {
    // Owner-wide DTO conversationId is the CLIENT source conversation id.
    const sourceConversationId = (row.conversationId || '').trim();
    if (!sourceConversationId) continue;
    const artifact = artifactFromServerYansiPreparation(row, sourceConversationId);
    if (!artifact) continue;
    if (
      !isServerConversationAuthorityValid(input.ownerAtStart, input.epochAtStart) ||
      getServerConversationAuthority().ownerKey !== owner
    ) {
      return hydrated;
    }
    const saved = upsertMirrorJourneyArtifact(owner, artifact);
    if (saved) hydrated.push(saved);
  }
  return hydrated;
}
