/**
 * Journey window status must track durable Yansı artifact readiness —
 * never Review confirm alone.
 */

import {
  markJourneyWindowFailed,
  markJourneyWindowGenerating,
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
  status: 'ready' | 'failed' | 'generating';
};

function dispatchStatus(detail: JourneyWindowStatusDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(JOURNEY_WINDOW_STATUS_EVENT, { detail })
  );
}

function findWindowIndexForJourney(
  state: JourneyConversationState,
  journeyId: string,
  allowed: ReadonlyArray<'generating' | 'failed'>
): number | null {
  const wanted = journeyId.trim().toLowerCase();
  if (!wanted) return null;
  const hit = state.windows.find(
    (w) =>
      allowed.includes(w.status as 'generating' | 'failed') &&
      (w.journeyId || '').trim().toLowerCase() === wanted
  );
  return hit ? hit.windowIndex : null;
}

/**
 * Promote a Journey window to ready/failed after artifact authority.
 * Ready accepts generating OR failed (retry reconciliation).
 * Failed only from generating (genuine in-flight failure).
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
    if (input.status === 'ready') {
      const windowIndex = findWindowIndexForJourney(base, journeyId, [
        'generating',
        'failed',
      ]);
      if (windowIndex == null) return null;
      return markJourneyWindowReady(base, windowIndex);
    }
    const windowIndex = findWindowIndexForJourney(base, journeyId, [
      'generating',
    ]);
    if (windowIndex == null) return null;
    return markJourneyWindowFailed(base, windowIndex);
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

/**
 * Retry / remount kick: re-arm the exact JourneyWindow to generating.
 * Preserves journeyId — never allocates a new window.
 * No-op when already generating; no-op when no matching failed/generating window.
 */
export function rearmJourneyWindowGeneratingFromArtifact(input: {
  ownerUserId: string | null | undefined;
  sourceConversationId: string;
  journeyId: string;
}): JourneyConversationState | null {
  const ownerUserId = (input.ownerUserId || '').trim();
  const sourceConversationId = (input.sourceConversationId || '').trim();
  const journeyId = (input.journeyId || '').trim().toLowerCase();
  if (!ownerUserId || !sourceConversationId || !journeyId) return null;

  const applyOnce = (
    base: JourneyConversationState
  ): JourneyConversationState | null => {
    const windowIndex = findWindowIndexForJourney(base, journeyId, [
      'failed',
      'generating',
    ]);
    if (windowIndex == null) return null;
    const current = base.windows.find((w) => w.windowIndex === windowIndex);
    if (current?.status === 'generating') return base;
    return markJourneyWindowGenerating(base, windowIndex);
  };

  let current =
    loadJourneyConversationState(ownerUserId, sourceConversationId) || null;
  if (!current) return null;

  let next = applyOnce(current);
  if (!next) return current;
  if (next === current) return current;

  let saved = saveJourneyConversationState(next);
  if (!saved.ok) {
    current = saved.current;
    next = applyOnce(current);
    if (!next || next === current) return current;
    saved = saveJourneyConversationState(next);
  }

  const result = saved.ok ? saved.state : saved.current;
  dispatchStatus({
    ownerUserId,
    sourceConversationId,
    journeyId,
    status: 'generating',
  });
  return result;
}
