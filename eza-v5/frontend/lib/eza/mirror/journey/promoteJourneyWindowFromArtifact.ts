/**
 * Journey window status must track durable Yansı artifact readiness —
 * never Review confirm alone.
 */

import {
  markJourneyWindowFailed,
  markJourneyWindowReady,
  type JourneyConversationState,
} from './journeyWindows';
import {
  loadJourneyConversationState,
  saveJourneyConversationState,
} from './journeyWindowStore';

export const JOURNEY_WINDOW_STATUS_EVENT = 'eza:journey-window-status';

export type JourneyWindowStatusDetail = {
  ownerUserId: string;
  sourceConversationId: string;
  journeyId: string;
  status: 'ready' | 'failed';
};

function dispatchStatus(detail: JourneyWindowStatusDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(JOURNEY_WINDOW_STATUS_EVENT, { detail })
  );
}

function findGeneratingWindowIndex(
  state: JourneyConversationState,
  journeyId: string
): number | null {
  const wanted = journeyId.trim().toLowerCase();
  if (!wanted) return null;
  const hit = state.windows.find(
    (w) =>
      w.status === 'generating' &&
      (w.journeyId || '').trim().toLowerCase() === wanted
  );
  return hit ? hit.windowIndex : null;
}

/**
 * Promote a generating Journey window to ready/failed after artifact authority.
 * Persists via CAS (one stale retry) and notifies same-tab listeners.
 */
export function promoteJourneyWindowFromArtifact(input: {
  ownerUserId: string | null | undefined;
  sourceConversationId: string;
  journeyId: string;
  status: 'ready' | 'failed';
}): JourneyConversationState | null {
  const ownerUserId = (input.ownerUserId || '').trim();
  const sourceConversationId = (input.sourceConversationId || '').trim();
  const journeyId = (input.journeyId || '').trim().toLowerCase();
  if (!ownerUserId || !sourceConversationId || !journeyId) return null;

  const applyOnce = (
    base: JourneyConversationState
  ): JourneyConversationState | null => {
    const windowIndex = findGeneratingWindowIndex(base, journeyId);
    if (windowIndex == null) return null;
    return input.status === 'ready'
      ? markJourneyWindowReady(base, windowIndex)
      : markJourneyWindowFailed(base, windowIndex);
  };

  let current =
    loadJourneyConversationState(ownerUserId, sourceConversationId) || null;
  if (!current) return null;

  let next = applyOnce(current);
  if (!next) return current;

  let saved = saveJourneyConversationState(next);
  if (!saved.ok) {
    current = saved.current;
    next = applyOnce(current);
    if (!next) return current;
    saved = saveJourneyConversationState(next);
  }

  const result = saved.ok ? saved.state : saved.current;
  dispatchStatus({
    ownerUserId,
    sourceConversationId,
    journeyId,
    status: input.status,
  });
  return result;
}
