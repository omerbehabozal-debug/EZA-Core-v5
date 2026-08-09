/**
 * Journey V1 Phase 3 — scoped meaning package from confirmed Review 8 window.
 *
 * The confirmed 8 Q/A pairs are the ONLY semantic input for D1→D2→Anchors→CB→image→NA.
 * Full conversation must not be re-read for meaning after confirm.
 */

import { djb2Hex } from '@/lib/eza/mirror/mirrorLineageHash';
import type { MirrorPrepareMessageDTO } from '@/lib/eza/mirror/prepareDirectorDraftApi';
import { JOURNEY_CANDIDATE_COUNT, type Review8Draft, type Review8SelectedStep } from './types';
import { computeReview8SnapshotHash, isReview8DraftConfirmed } from './review8Draft';

export const JOURNEY_SEMANTIC_SCOPE_V1 = 'journey_window_v1' as const;

export type ConfirmedJourneyWindow = {
  journeyId: string;
  sourceConversationId: string;
  parentJourneyId?: string | null;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  selectedSteps: Review8SelectedStep[];
  journeyVersion?: number;
  draftKey?: string;
  snapshotHash?: string | null;
};

export type JourneySemanticScopePayload = {
  semanticScope: typeof JOURNEY_SEMANTIC_SCOPE_V1;
  journeyId: string;
  journeyVersion: number;
  sourceConversationId: string;
  parentJourneyId?: string | null;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  windowHash: string;
  scopedInputHash: string;
  selectedSteps: Array<{
    stepIndex: number;
    sourceOrder: number;
    sourceUserMessageId: string;
    sourceAssistantMessageId: string;
    publicQuestion: string;
    publicAnswer: string;
  }>;
};

export type ScopedJourneyMeaningFail = {
  ok: false;
  code: 'journey_semantic_scope_invalid';
  message: string;
};

export type ScopedJourneyMeaningOk = {
  ok: true;
  window: ConfirmedJourneyWindow;
  messages: MirrorPrepareMessageDTO[];
  scope: JourneySemanticScopePayload;
  windowHash: string;
  scopedInputHash: string;
};

function fail(message: string): ScopedJourneyMeaningFail {
  return { ok: false, code: 'journey_semantic_scope_invalid', message };
}

export function computeJourneyWindowHash(steps: Review8SelectedStep[]): string {
  return computeReview8SnapshotHash(steps);
}

/** Fingerprint of the full scoped semantic package (ids + window + frozen Q/A). */
export function computeScopedJourneyInputHash(window: ConfirmedJourneyWindow): string {
  const steps = window.selectedSteps
    .map(
      (s) =>
        `${s.index}|${s.sourceOrder}|${s.userMessageId}|${s.assistantMessageId}|${s.publicQuestion}|${s.publicAnswer}`
    )
    .join('\n');
  const payload = [
    JOURNEY_SEMANTIC_SCOPE_V1,
    window.journeyId,
    String(window.journeyVersion ?? 1),
    window.sourceConversationId,
    String(window.windowIndex),
    String(window.windowStart),
    String(window.windowEnd),
    steps,
  ].join('\n');
  return `s${djb2Hex(payload)}`;
}

export function buildScopedPrepareMessagesFromSteps(
  steps: Review8SelectedStep[]
): MirrorPrepareMessageDTO[] {
  const ordered = [...steps].sort((a, b) => a.index - b.index);
  const out: MirrorPrepareMessageDTO[] = [];
  for (const step of ordered) {
    out.push({
      role: 'user',
      text: step.publicQuestion.trim(),
      sequence: step.sourceOrder * 2,
    });
    out.push({
      role: 'assistant',
      text: step.publicAnswer.trim(),
      sequence: step.sourceOrder * 2 + 1,
    });
  }
  return out;
}

export function confirmedJourneyWindowFromDraft(
  draft: Review8Draft
): ConfirmedJourneyWindow | null {
  if (!isReview8DraftConfirmed(draft) || !draft.journeyId?.trim()) return null;
  if (
    typeof draft.windowIndex !== 'number' ||
    typeof draft.windowStartSequence !== 'number' ||
    typeof draft.windowEndSequence !== 'number'
  ) {
    return null;
  }
  if (draft.selectedSteps?.length !== JOURNEY_CANDIDATE_COUNT) return null;
  return {
    journeyId: draft.journeyId.trim(),
    sourceConversationId: draft.sourceConversationId,
    parentJourneyId: draft.parentJourneyId ?? null,
    windowIndex: draft.windowIndex,
    windowStart: draft.windowStartSequence,
    windowEnd: draft.windowEndSequence,
    selectedSteps: draft.selectedSteps,
    journeyVersion:
      typeof draft.journeyVersion === 'number' && draft.journeyVersion >= 1
        ? draft.journeyVersion
        : 1,
    draftKey: draft.draftKey,
    snapshotHash: draft.snapshotHash,
  };
}

/**
 * Fail-closed builder: confirmed draft → scoped prepare messages + scope payload.
 * Never falls back to full conversation.
 */
export function resolveScopedJourneyMeaning(
  draft: Review8Draft | null | undefined
): ScopedJourneyMeaningOk | ScopedJourneyMeaningFail {
  if (!draft) {
    return fail('Journey meaning requires a confirmed Review 8 draft.');
  }
  const window = confirmedJourneyWindowFromDraft(draft);
  if (!window) {
    return fail('Confirmed journey window identity is incomplete or invalid.');
  }
  if (window.windowEnd - window.windowStart !== JOURNEY_CANDIDATE_COUNT - 1) {
    return fail('windowEnd - windowStart must equal 7.');
  }
  if (window.windowStart !== window.windowIndex * JOURNEY_CANDIDATE_COUNT) {
    return fail('windowStart must equal windowIndex * 8.');
  }

  const ordered = [...window.selectedSteps].sort((a, b) => a.index - b.index);
  for (let i = 0; i < ordered.length; i += 1) {
    const step = ordered[i]!;
    if (step.index !== i + 1) {
      return fail('selectedSteps stepIndex must be contiguous 1..8.');
    }
    if (step.sourceOrder !== window.windowStart + i) {
      return fail('sourceOrder must match the declared window.');
    }
    if (!step.publicQuestion.trim() || !step.publicAnswer.trim()) {
      return fail('Each selected step requires publicQuestion and publicAnswer.');
    }
  }

  const windowHash = computeJourneyWindowHash(ordered);
  if (draft.snapshotHash && draft.snapshotHash !== windowHash) {
    return fail('Confirmed snapshot hash does not match selected steps.');
  }

  const messages = buildScopedPrepareMessagesFromSteps(ordered);
  if (messages.length !== JOURNEY_CANDIDATE_COUNT * 2) {
    return fail('Scoped prepare messages must contain exactly 16 turns (8 Q/A).');
  }

  const scopedInputHash = computeScopedJourneyInputHash({
    ...window,
    selectedSteps: ordered,
  });

  const scope: JourneySemanticScopePayload = {
    semanticScope: JOURNEY_SEMANTIC_SCOPE_V1,
    journeyId: window.journeyId,
    journeyVersion: window.journeyVersion ?? 1,
    sourceConversationId: window.sourceConversationId,
    parentJourneyId: window.parentJourneyId ?? null,
    windowIndex: window.windowIndex,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    windowHash,
    scopedInputHash,
    selectedSteps: ordered.map((s) => ({
      stepIndex: s.index,
      sourceOrder: s.sourceOrder,
      sourceUserMessageId: s.userMessageId,
      sourceAssistantMessageId: s.assistantMessageId,
      publicQuestion: s.publicQuestion,
      publicAnswer: s.publicAnswer,
    })),
  };

  return {
    ok: true,
    window: { ...window, selectedSteps: ordered },
    messages,
    scope,
    windowHash,
    scopedInputHash,
  };
}
