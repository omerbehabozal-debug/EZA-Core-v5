/**
 * Hydrate/remount: catch generating/failed windows up to durable artifact status
 * without regenerating.
 */

import type { JourneyConversationState } from './journeyWindows';
import { loadJourneyConversationState } from './journeyWindowStore';
import {
  listJourneyArtifactsForConversation,
  loadMirrorJourneyArtifact,
} from './mirrorJourneyArtifactStore';
import { promoteJourneyWindowFromArtifact } from './promoteJourneyWindowFromArtifact';

function resolveArtifactForWindow(
  ownerUserId: string,
  sourceConversationId: string,
  journeyId: string
) {
  const listed = listJourneyArtifactsForConversation(
    ownerUserId,
    sourceConversationId
  ).filter(
    (a) => (a.journeyId || '').trim().toLowerCase() === journeyId.trim().toLowerCase()
  );
  const ready = listed.find(
    (a) => a.status === 'ready' || a.status === 'published'
  );
  if (ready) return ready;
  if (listed[0]) return listed[0];
  return loadMirrorJourneyArtifact(ownerUserId, journeyId, 1);
}

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
    // generating: normal in-flight catch-up
    // failed: retry success may have left window failed while artifact is ready
    if (
      (w.status !== 'generating' && w.status !== 'failed') ||
      !w.journeyId
    ) {
      continue;
    }
    const artifact = resolveArtifactForWindow(
      ownerUserId,
      sourceConversationId,
      w.journeyId
    );
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
    } else if (artifact.status === 'failed' && w.status === 'generating') {
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
