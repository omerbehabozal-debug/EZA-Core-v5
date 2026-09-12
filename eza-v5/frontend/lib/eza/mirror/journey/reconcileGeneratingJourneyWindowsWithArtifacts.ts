/**
 * Hydrate/remount: catch generating windows up to durable artifact status
 * without regenerating.
 */

import type { JourneyConversationState } from './journeyWindows';
import { loadJourneyConversationState } from './journeyWindowStore';
import { loadMirrorJourneyArtifact } from './mirrorJourneyArtifactStore';
import { promoteJourneyWindowFromArtifact } from './promoteJourneyWindowFromArtifact';

export function reconcileGeneratingJourneyWindowsWithArtifacts(input: {
  ownerUserId: string | null | undefined;
  sourceConversationId: string;
}): JourneyConversationState | null {
  const ownerUserId = (input.ownerUserId || '').trim();
  const sourceConversationId = (input.sourceConversationId || '').trim();
  if (!ownerUserId || !sourceConversationId) return null;

  let state = loadJourneyConversationState(ownerUserId, sourceConversationId);
  if (!state) return null;

  let changed = false;
  for (const w of state.windows) {
    if (w.status !== 'generating' || !w.journeyId) continue;
    const artifact = loadMirrorJourneyArtifact(ownerUserId, w.journeyId, 1);
    if (!artifact) continue;
    if (artifact.status === 'ready' || artifact.status === 'published') {
      const promoted = promoteJourneyWindowFromArtifact({
        ownerUserId,
        sourceConversationId,
        journeyId: w.journeyId,
        status: 'ready',
      });
      if (promoted) {
        state = promoted;
        changed = true;
      }
    } else if (artifact.status === 'failed') {
      const promoted = promoteJourneyWindowFromArtifact({
        ownerUserId,
        sourceConversationId,
        journeyId: w.journeyId,
        status: 'failed',
      });
      if (promoted) {
        state = promoted;
        changed = true;
      }
    }
  }
  return changed ? state : null;
}
