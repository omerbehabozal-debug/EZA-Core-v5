/**
 * Journey V1 Phase 3/3.7 — scoped meaning from confirmed Review selection (6–8).
 *
 * Confirmed selected Q/A ONLY enter D1→D2→Anchors→CB→image→NA.
 * Deselected source-block pairs stay private and never enter scoped messages.
 */

import { djb2Hex } from '@/lib/eza/mirror/mirrorLineageHash';
import type { MirrorPrepareMessageDTO } from '@/lib/eza/mirror/prepareDirectorDraftApi';
import {
  JOURNEY_CANDIDATE_COUNT,
  JOURNEY_SELECTED_MAX,
  JOURNEY_SELECTED_MIN,
  type EligibleQaPair,
  type Review8Draft,
  type Review8SelectedStep,
} from './types';
import {
  computeReview8SnapshotHash,
  computeSourceBlockHash,
  isReview8DraftConfirmed,
} from './review8Draft';

export const JOURNEY_SEMANTIC_SCOPE_V1 = 'journey_window_v1' as const;

export type ConfirmedJourneyWindow = {
  journeyId: string;
  sourceConversationId: string;
  parentJourneyId?: string | null;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  selectedSteps: Review8SelectedStep[];
  sourceBlockSteps: EligibleQaPair[];
  journeyVersion?: number;
  draftKey?: string;
  snapshotHash?: string | null;
  sourceBlockHash?: string | null;
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
  blockIndex: number;
  blockStart: number;
  blockEnd: number;
  windowHash: string;
  sourceBlockHash: string;
  scopedInputHash: string;
  selectedSteps: Array<{
    stepIndex: number;
    sourceOrder: number;
    sourceUserMessageId: string;
    sourceAssistantMessageId: string;
    publicQuestion: string;
    publicAnswer: string;
  }>;
  sourceBlockSteps: Array<{
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
  sourceBlockHash: string;
  scopedInputHash: string;
  selectedCount: number;
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
  const count = draft.selectedSteps?.length ?? 0;
  if (count < JOURNEY_SELECTED_MIN || count > JOURNEY_SELECTED_MAX) return null;
  const block =
    draft.sourceBlockSteps?.length === JOURNEY_CANDIDATE_COUNT
      ? draft.sourceBlockSteps
      : count === JOURNEY_CANDIDATE_COUNT
        ? draft.selectedSteps
        : null;
  if (!block || block.length !== JOURNEY_CANDIDATE_COUNT) return null;
  return {
    journeyId: draft.journeyId.trim(),
    sourceConversationId: draft.sourceConversationId,
    parentJourneyId: draft.parentJourneyId ?? null,
    windowIndex: draft.windowIndex,
    windowStart: draft.windowStartSequence,
    windowEnd: draft.windowEndSequence,
    selectedSteps: draft.selectedSteps,
    sourceBlockSteps: block,
    journeyVersion:
      typeof draft.journeyVersion === 'number' && draft.journeyVersion >= 1
        ? draft.journeyVersion
        : 1,
    draftKey: draft.draftKey,
    snapshotHash: draft.snapshotHash,
    sourceBlockHash: draft.sourceBlockHash ?? computeSourceBlockHash(block),
  };
}

/**
 * Fail-closed builder: confirmed draft → scoped prepare messages + scope payload.
 * Never falls back to full conversation or V3.
 */
export function resolveScopedJourneyMeaning(
  draft: Review8Draft | null | undefined
): ScopedJourneyMeaningOk | ScopedJourneyMeaningFail {
  if (!draft) {
    return fail('Journey meaning requires a confirmed Review draft.');
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
  const selectedCount = ordered.length;
  if (selectedCount < JOURNEY_SELECTED_MIN || selectedCount > JOURNEY_SELECTED_MAX) {
    return fail(
      `selectedCount must be ${JOURNEY_SELECTED_MIN}–${JOURNEY_SELECTED_MAX}.`
    );
  }

  for (let i = 0; i < ordered.length; i += 1) {
    const step = ordered[i]!;
    if (step.index !== i + 1) {
      return fail(`selectedSteps stepIndex must be contiguous 1..${selectedCount}.`);
    }
    if (
      step.sourceOrder < window.windowStart ||
      step.sourceOrder > window.windowEnd
    ) {
      return fail('sourceOrder outside declared source block.');
    }
    if (!step.publicQuestion.trim() || !step.publicAnswer.trim()) {
      return fail('Each selected step requires publicQuestion and publicAnswer.');
    }
  }

  const orders = ordered.map((s) => s.sourceOrder);
  if (orders.some((o, i) => i > 0 && o <= orders[i - 1]!)) {
    return fail('selectedSteps sourceOrder must be strictly increasing.');
  }

  const windowHash = computeJourneyWindowHash(ordered);
  if (draft.snapshotHash && draft.snapshotHash !== windowHash) {
    return fail('Confirmed snapshot hash does not match selected steps.');
  }

  const sourceBlockHash = computeSourceBlockHash(window.sourceBlockSteps);
  const messages = buildScopedPrepareMessagesFromSteps(ordered);
  if (messages.length !== selectedCount * 2) {
    return fail(
      `Scoped prepare messages must contain exactly ${selectedCount * 2} turns.`
    );
  }

  // Provenance: every selected pair must be in the source block of 8.
  const blockIds = new Set(
    window.sourceBlockSteps.map(
      (p) => `${p.userMessageId}|${p.assistantMessageId}|${p.sourceOrder}`
    )
  );
  for (const step of ordered) {
    const key = `${step.userMessageId}|${step.assistantMessageId}|${step.sourceOrder}`;
    if (!blockIds.has(key)) {
      return fail('Selected step is not a member of the declared source block.');
    }
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
    blockIndex: window.windowIndex,
    blockStart: window.windowStart,
    blockEnd: window.windowEnd,
    windowHash,
    sourceBlockHash,
    scopedInputHash,
    selectedSteps: ordered.map((s) => ({
      stepIndex: s.index,
      sourceOrder: s.sourceOrder,
      sourceUserMessageId: s.userMessageId,
      sourceAssistantMessageId: s.assistantMessageId,
      publicQuestion: s.publicQuestion,
      publicAnswer: s.publicAnswer,
    })),
    sourceBlockSteps: window.sourceBlockSteps.map((s) => ({
      sourceOrder: s.sourceOrder,
      sourceUserMessageId: s.userMessageId,
      sourceAssistantMessageId: s.assistantMessageId,
      publicQuestion: s.publicQuestion,
      publicAnswer: s.publicAnswer,
    })),
  };

  return {
    ok: true,
    window: { ...window, selectedSteps: ordered, sourceBlockHash },
    messages,
    scope,
    windowHash,
    sourceBlockHash,
    scopedInputHash,
    selectedCount,
  };
}
