/**
 * Deterministic Journey source blocks — Phase 3.7 product contract.
 *
 * Source block: contiguous 8 eligible Q/A (blockStart = N*8 … blockEnd = N*8+7).
 * Yansı: confirmed 6–8 from that block only.
 * Journey Mode: unlimited blocks (no product-level max).
 * Private Mode: permanent after explicit "Yansı oluşturmadan devam et"; 20-question cap.
 */

import {
  extractQaPairs,
  isEligiblePairingMessage,
  resolveJourneyMessageRole,
} from './extractQaPairs';
import type { EligibleQaPair, JourneyMessageLike } from './types';

export const JOURNEY_WINDOW_SIZE = 8 as const;
export const JOURNEY_SOURCE_BLOCK_SIZE = 8 as const;
export const JOURNEY_SELECTED_MIN = 6 as const;
export const JOURNEY_SELECTED_MAX = 8 as const;
/** Private Mode only — Journey Mode has no product-level question cap. */
export const JOURNEY_CONVERSATION_MAX_PAIRS = 20 as const;
/**
 * @deprecated Phase 3.7 — Journey Mode is unlimited. Kept as null sentinel so
 * accidental max-2 checks fail closed rather than silently capping.
 */
export const JOURNEY_MAX_PUBLISHABLE_WINDOWS = null;

export type JourneyMode =
  | 'journey_mode'
  | 'private_chat_mode';

export type JourneyWindowStatus =
  | 'pending'
  | 'awaiting_decision'
  | 'skipped'
  | 'reviewing'
  | 'confirmed'
  | 'generating'
  | 'ready'
  | 'failed';

export type JourneyWindowRecord = {
  windowIndex: number;
  /** Alias: blockIndex */
  startSequence: number;
  endSequence: number;
  status: JourneyWindowStatus;
  draftKey: string | null;
  journeyId: string | null;
  parentJourneyId: string | null;
  decidedAt: string | null;
  confirmedAt: string | null;
  selectedCount?: number | null;
};

export type JourneyConversationState = {
  ownerUserId: string;
  sourceConversationId: string;
  /** Completed eligible Q/A pair count last synced. */
  eligiblePairCount: number;
  /**
   * Completed pairs + pending unpaired eligible user question.
   * Used for Private Mode Q20/Q21 guard only.
   */
  acceptedEligibleQuestionCount: number;
  windows: JourneyWindowRecord[];
  /**
   * Permanent Private Mode for this conversation.
   * Only set by explicit PRIVATE_CONTINUE ("Yansı oluşturmadan devam et").
   */
  journeyMode: JourneyMode;
  /** True when private_chat_mode and acceptedEligibleQuestionCount >= 20. */
  conversationClosed: boolean;
  updatedAt: string;
  /** Monotonic revision for multi-tab CAS writes. */
  stateVersion: number;
  /**
   * Phase 5.2 — verified continuation origin (startedFromMirrorId).
   * Seeds parent for window 0 when no prior READY Journey exists in this chat.
   * Null for ordinary (non-Yansı) chats — first Journey stays a root.
   */
  originatingParentJourneyId: string | null;
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

export const blockRange = windowRange;

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
    selectedCount: null,
  };
}

function normalizeOriginatingParentId(
  value: string | null | undefined
): string | null {
  const slug = (value || '').trim().toLowerCase();
  return slug || null;
}

export function createEmptyJourneyConversationState(input: {
  ownerUserId: string;
  sourceConversationId: string;
  originatingParentJourneyId?: string | null;
}): JourneyConversationState {
  return {
    ownerUserId: input.ownerUserId,
    sourceConversationId: input.sourceConversationId,
    eligiblePairCount: 0,
    acceptedEligibleQuestionCount: 0,
    windows: [],
    journeyMode: 'journey_mode',
    conversationClosed: false,
    updatedAt: new Date().toISOString(),
    stateVersion: 0,
    originatingParentJourneyId: normalizeOriginatingParentId(
      input.originatingParentJourneyId
    ),
  };
}

function normalizeLoadedState(
  state: JourneyConversationState
): JourneyConversationState {
  return {
    ...state,
    journeyMode: state.journeyMode === 'private_chat_mode'
      ? 'private_chat_mode'
      : 'journey_mode',
    originatingParentJourneyId: normalizeOriginatingParentId(
      state.originatingParentJourneyId
    ),
  };
}

/**
 * Sync conversation journey state from live/archive messages.
 * Idempotent: skipped/confirmed windows are never re-prompted.
 * Private Mode: never opens new block decisions.
 * Does not bump stateVersion — callers persist via CAS save.
 */
export function syncJourneyConversationState(input: {
  state: JourneyConversationState | null;
  ownerUserId: string;
  sourceConversationId: string;
  messages: JourneyMessageLike[];
  now?: string;
  originatingParentJourneyId?: string | null;
}): JourneyConversationState {
  const now = input.now || new Date().toISOString();
  const base =
    input.state &&
    input.state.ownerUserId === input.ownerUserId &&
    input.state.sourceConversationId === input.sourceConversationId
      ? normalizeLoadedState(input.state)
      : createEmptyJourneyConversationState({
          ownerUserId: input.ownerUserId,
          sourceConversationId: input.sourceConversationId,
          originatingParentJourneyId: input.originatingParentJourneyId,
        });
  const originatingParentJourneyId =
    normalizeOriginatingParentId(input.originatingParentJourneyId) ??
    base.originatingParentJourneyId;

  const pairs = extractQaPairs(input.messages);
  const eligiblePairCount = pairs.length;
  const acceptedEligibleQuestionCount = countAcceptedEligibleUserQuestions(
    input.messages
  );
  const windows = [...base.windows];
  const inPrivate = base.journeyMode === 'private_chat_mode';

  if (!inPrivate) {
    const completedBlocks = Math.floor(eligiblePairCount / JOURNEY_WINDOW_SIZE);
    for (let w = 0; w < completedBlocks; w += 1) {
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
          draftKey:
            rec.draftKey || allocateWindowDraftKey(input.sourceConversationId, w),
        };
        const idx = windows.findIndex((x) => x.windowIndex === w);
        windows[idx] = rec;
      }
    }
  }

  windows.sort((a, b) => a.windowIndex - b.windowIndex);

  const conversationClosed =
    inPrivate &&
    acceptedEligibleQuestionCount >= JOURNEY_CONVERSATION_MAX_PAIRS;

  return {
    ...base,
    eligiblePairCount,
    acceptedEligibleQuestionCount,
    windows,
    conversationClosed,
    originatingParentJourneyId,
    updatedAt: now,
  };
}

export function getAwaitingDecisionWindow(
  state: JourneyConversationState | null
): JourneyWindowRecord | null {
  if (!state || state.journeyMode === 'private_chat_mode') return null;
  return state.windows.find((w) => w.status === 'awaiting_decision') ?? null;
}

/**
 * Explicit PRIVATE_CONTINUE — permanent Private Mode for this conversation.
 * Review cancel must NOT call this.
 */
export function enterPrivateChatMode(
  state: JourneyConversationState,
  windowIndex?: number
): JourneyConversationState {
  const now = new Date().toISOString();
  const windows =
    typeof windowIndex === 'number'
      ? state.windows.map((w) =>
          w.windowIndex === windowIndex
            ? {
                ...w,
                status: 'skipped' as const,
                decidedAt: now,
                draftKey: null,
                journeyId: null,
              }
            : w
        )
      : state.windows;

  return {
    ...state,
    journeyMode: 'private_chat_mode',
    windows,
    conversationClosed:
      state.acceptedEligibleQuestionCount >= JOURNEY_CONVERSATION_MAX_PAIRS,
    updatedAt: now,
  };
}

/**
 * @deprecated Prefer enterPrivateChatMode — skip is permanent Private Mode (LOCK 5).
 */
export function skipJourneyWindow(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  return enterPrivateChatMode(state, windowIndex);
}

/**
 * Phase 8.8F — defer this window's invitation without entering Private Mode.
 * Conversation continues; the next full 8-pair block may invite again.
 */
export function dismissJourneyWindowInvitation(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex && w.status === 'awaiting_decision'
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
  if (state.journeyMode === 'private_chat_mode') return state;
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

/** Cancel Review — return to decision_required. Does NOT enter Private Mode. */
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

/**
 * Parent = latest prior READY Journey in this conversation chain.
 * Else originating published Yansı (Phase 5.2 continuation seed).
 * Do not use a still-generating artifact as published parent authority.
 */
export function resolveParentJourneyId(
  state: JourneyConversationState,
  forWindowIndex: number
): string | null {
  const prior = state.windows
    .filter(
      (w) =>
        w.windowIndex < forWindowIndex &&
        w.journeyId &&
        w.status === 'ready'
    )
    .sort((a, b) => b.windowIndex - a.windowIndex);
  if (prior[0]?.journeyId) return prior[0].journeyId;
  return normalizeOriginatingParentId(state.originatingParentJourneyId);
}

export function confirmJourneyWindow(input: {
  state: JourneyConversationState;
  windowIndex: number;
  journeyId: string;
  draftKey: string;
  selectedCount?: number;
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
            selectedCount: input.selectedCount ?? w.selectedCount ?? null,
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

export function markJourneyWindowFailed(
  state: JourneyConversationState,
  windowIndex: number
): JourneyConversationState {
  const now = new Date().toISOString();
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.windowIndex === windowIndex && w.status === 'generating'
        ? { ...w, status: 'failed' as const }
        : w
    ),
    updatedAt: now,
  };
}

export function canSendMoreJourneyQuestions(
  state: JourneyConversationState | null
): boolean {
  if (!state) return true;
  if (state.journeyMode !== 'private_chat_mode') return true;
  return !state.conversationClosed;
}

/** Live send guard — Private Mode blocks Q21 while A20 may still stream. */
export function canAcceptAnotherJourneyQuestion(
  messages: JourneyMessageLike[],
  state?: JourneyConversationState | null
): boolean {
  if (!state || state.journeyMode !== 'private_chat_mode') {
    // Journey Mode: unlimited
    return true;
  }
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
          w.status === 'ready' ||
          w.status === 'failed')
    )
    .map((w) => ({
      windowIndex: w.windowIndex,
      journeyId: w.journeyId!,
      parentJourneyId: w.parentJourneyId,
    }));
}

export function isPrivateChatMode(
  state: JourneyConversationState | null
): boolean {
  return state?.journeyMode === 'private_chat_mode';
}
