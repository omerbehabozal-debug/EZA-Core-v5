/**
 * Deterministic 8-question Journey windows — product model reset.
 *
 * Conversation max: 20 eligible user questions (completed OR pending answer).
 * Yansı size: exactly 8 chronological pairs per window.
 * Windows: [0–7], [8–15]. (Q17–Q20 never form a full Yansı.)
 *
 * No best-8 scoring. No topic clustering. No cross-window mixing.
 */

import {
  extractQaPairs,
  isEligiblePairingMessage,
  resolveJourneyMessageRole,
} from './extractQaPairs';
import type { EligibleQaPair, JourneyMessageLike } from './types';

export const JOURNEY_WINDOW_SIZE = 8 as const;
export const JOURNEY_CONVERSATION_MAX_PAIRS = 20 as const;
/** Only full 8-pair windows can become a Yansı (indices 0 and 1). */
export const JOURNEY_MAX_PUBLISHABLE_WINDOWS = 2 as const;

export type JourneyWindowStatus =
  | 'pending'
  | 'awaiting_decision'
  | 'skipped'
  | 'reviewing'
  | 'confirmed'
  | 'generating'
  | 'ready';

export type JourneyWindowRecord = {
  windowIndex: number;
  startSequence: number;
  endSequence: number;
  status: JourneyWindowStatus;
  draftKey: string | null;
  journeyId: string | null;
  parentJourneyId: string | null;
  decidedAt: string | null;
  confirmedAt: string | null;
};

export type JourneyConversationState = {
  ownerUserId: string;
  sourceConversationId: string;
  /** Completed eligible Q/A pair count last synced. */
  eligiblePairCount: number;
  /**
   * Completed pairs + pending unpaired eligible user question.
   * Used for the hard 20-question send cap (blocks Q21 while A20 streams).
   */
  acceptedEligibleQuestionCount: number;
  windows: JourneyWindowRecord[];
  conversationClosed: boolean;
  updatedAt: string;
  /** Monotonic revision for multi-tab CAS writes. */
  stateVersion: number;
};

/**
 * Count accepted eligible user questions:
 * completed Q/A pairs + at most one trailing unpaired eligible user turn.
 */
export function countAcceptedEligibleUserQuestions(
  messages: JourneyMessageLike[]
): number {
  const pairs = extractQaPairs(messages);
  const pairedUserIds = new Set(pairs.map((p) => p.userMessageId));

  let lastEligibleUser: JourneyMessageLike | null = null;
  for (const msg of messages) {
    const role = resolveJourneyMessageRole(msg);
    if (role === 'user' && isEligiblePairingMessage(msg)) {
      lastEligibleUser = msg;
      continue;
    }
    if (role === 'assistant' && isEligiblePairingMessage(msg)) {
      // Complete assistant consumes the pending user for slot accounting.
      lastEligibleUser = null;
    }
  }

  const pending =
    lastEligibleUser && !pairedUserIds.has(lastEligibleUser.id) ? 1 : 0;
  return pairs.length + pending;
}

export function windowRange(windowIndex: number): {
  startSequence: number;
  endSequence: number;
} {
  const startSequence = windowIndex * JOURNEY_WINDOW_SIZE;
  return {
    startSequence,
    endSequence: startSequence + JOURNEY_WINDOW_SIZE - 1,
  };
}

export function pairsForWindow(
  pairs: EligibleQaPair[],
  windowIndex: number
): EligibleQaPair[] {
  const { startSequence, endSequence } = windowRange(windowIndex);
  return pairs.slice(startSequence, endSequence + 1);
}

export function isFullWindow(pairs: EligibleQaPair[], windowIndex: number): boolean {
  return pairsForWindow(pairs, windowIndex).length === JOURNEY_WINDOW_SIZE;
}

export function allocateWindowDraftKey(
  sourceConversationId: string,
  windowIndex: number
): string {
  return `win-${(sourceConversationId || 'conv').slice(0, 32)}-${windowIndex}`;
}

function emptyWindow(windowIndex: number): JourneyWindowRecord {
  const range = windowRange(windowIndex);
  return {
    windowIndex,
    startSequence: range.startSequence,
    endSequence: range.endSequence,
    status: 'pending',
    draftKey: null,
    journeyId: null,
    parentJourneyId: null,
    decidedAt: null,
    confirmedAt: null,
  };
}

export function createEmptyJourneyConversationState(input: {
  ownerUserId: string;
  sourceConversationId: string;
}): JourneyConversationState {
  return {
    ownerUserId: input.ownerUserId,
    sourceConversationId: input.sourceConversationId,
    eligiblePairCount: 0,
    acceptedEligibleQuestionCount: 0,
    windows: [],
    conversationClosed: false,
    updatedAt: new Date().toISOString(),
    stateVersion: 0,
  };
}

/**
 * Sync conversation journey state from live/archive messages.
 * Idempotent: skipped/confirmed windows are never re-prompted.
 * Does not bump stateVersion — callers persist via CAS save.
 */
export function syncJourneyConversationState(input: {
  state: JourneyConversationState | null;
  ownerUserId: string;
  sourceConversationId: string;
  messages: JourneyMessageLike[];
  now?: string;
}): JourneyConversationState {
  const now = input.now || new Date().toISOString();
  const base =
    input.state &&
    input.state.ownerUserId === input.ownerUserId &&
    input.state.sourceConversationId === input.sourceConversationId
      ? input.state
      : createEmptyJourneyConversationState({
          ownerUserId: input.ownerUserId,
          sourceConversationId: input.sourceConversationId,
        });

  const pairs = extractQaPairs(input.messages);
  const eligiblePairCount = pairs.length;
  const acceptedEligibleQuestionCount = countAcceptedEligibleUserQuestions(
    input.messages
  );
  const windows = [...base.windows];

  for (let w = 0; w < JOURNEY_MAX_PUBLISHABLE_WINDOWS; w += 1) {
    if (!isFullWindow(pairs, w)) continue;
    let rec = windows.find((x) => x.windowIndex === w);
    if (!rec) {
      rec = emptyWindow(w);
      windows.push(rec);
    }
    // Remount mid-review: return to decision (not skip/confirmed — those stay frozen).
    if (rec.status === 'reviewing') {
      rec = { ...rec, status: 'awaiting_decision' };
      const idx = windows.findIndex((x) => x.windowIndex === w);
      windows[idx] = rec;
    }
    if (rec.status === 'pending') {
      rec = {
        ...rec,
        status: 'awaiting_decision',
        draftKey: rec.draftKey || allocateWindowDraftKey(input.sourceConversationId, w),
      };
      const idx = windows.findIndex((x) => x.windowIndex === w);
      windows[idx] = rec;
    }
  }

  windows.sort((a, b) => a.windowIndex - b.windowIndex);

  return {
    ...base,
    eligiblePairCount,
    acceptedEligibleQuestionCount,
    windows,
    conversationClosed:
      acceptedEligibleQuestionCount >= JOURNEY_CONVERSATION_MAX_PAIRS,
    updatedAt: now,
  };
}

export function getAwaitingDecisionWindow(
  state: JourneyConversationState | null
): JourneyWindowRecord | null {
  if (!state) return null;
  return state.windows.find((w) => w.status === 'awaiting_decision') ?? null;
}

export function skipJourneyWindow(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex
        ? {
            ...w,
            status: 'skipped' as const,
            decidedAt: now,
            draftKey: null,
            journeyId: null,
          }
        : w
    ),
    updatedAt: now,
  };
}

export function markJourneyWindowReviewing(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex
        ? {
            ...w,
            status: 'reviewing' as const,
            draftKey:
              w.draftKey ||
              allocateWindowDraftKey(state.sourceConversationId, windowIndex),
            decidedAt: w.decidedAt || now,
          }
        : w
    ),
    updatedAt: now,
  };
}

/** Cancel Review 8 — return to decision without publishing. */
export function reopenJourneyWindowDecision(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex && w.status === 'reviewing'
        ? { ...w, status: 'awaiting_decision' as const }
        : w
    ),
    updatedAt: now,
  };
}

/** Most recent confirmed/ready/generating journey in this conversation. */
export function resolveParentJourneyId(
  state: JourneyConversationState,
  forWindowIndex: number
): string | null {
  const prior = state.windows
    .filter(
      (w) =>
        w.windowIndex < forWindowIndex &&
        w.journeyId &&
        (w.status === 'confirmed' ||
          w.status === 'generating' ||
          w.status === 'ready')
    )
    .sort((a, b) => b.windowIndex - a.windowIndex);
  return prior[0]?.journeyId ?? null;
}

export function confirmJourneyWindow(input: {
  state: JourneyConversationState;
  windowIndex: number;
  journeyId: string;
  draftKey: string;
}): JourneyConversationState {
  const now = new Date().toISOString();
  const parentJourneyId = resolveParentJourneyId(input.state, input.windowIndex);
  return {
    ...input.state,
    windows: input.state.windows.map((w) =>
      w.windowIndex === input.windowIndex
        ? {
            ...w,
            status: 'generating' as const,
            journeyId: input.journeyId,
            draftKey: input.draftKey,
            parentJourneyId,
            decidedAt: w.decidedAt || now,
            confirmedAt: now,
          }
        : w
    ),
    updatedAt: now,
  };
}

export function markJourneyWindowReady(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex && w.status === 'generating'
        ? { ...w, status: 'ready' as const }
        : w
    ),
    updatedAt: now,
  };
}

export function canSendMoreJourneyQuestions(
  state: JourneyConversationState | null
): boolean {
  if (!state) return true;
  return !state.conversationClosed;
}

/** Live send guard — also blocks Q21 while A20 is still streaming. */
export function canAcceptAnotherJourneyQuestion(
  messages: JourneyMessageLike[]
): boolean {
  return (
    countAcceptedEligibleUserQuestions(messages) < JOURNEY_CONVERSATION_MAX_PAIRS
  );
}

export function listPublishedJourneyChain(
  state: JourneyConversationState
): Array<{ windowIndex: number; journeyId: string; parentJourneyId: string | null }> {
  return state.windows
    .filter(
      (w) =>
        w.journeyId &&
        (w.status === 'confirmed' ||
          w.status === 'generating' ||
          w.status === 'ready')
    )
    .map((w) => ({
      windowIndex: w.windowIndex,
      journeyId: w.journeyId!,
      parentJourneyId: w.parentJourneyId,
    }));
}
