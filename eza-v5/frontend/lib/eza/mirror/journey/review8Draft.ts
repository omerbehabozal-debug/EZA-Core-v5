/**
 * Review 8 draft builders + snapshot integrity (Phase 2 PASS).
 */

import {
  JOURNEY_CANDIDATE_COUNT,
  type CandidatePath,
  type EligibleQaPair,
  type Review8Draft,
  type Review8SelectedStep,
  type Review8StepIndex,
} from './types';
import { sortPairsBySourceOrder } from './proposeCandidate8';

function slugifySeed(value: string, maxLen = 40): string {
  const raw = (value || '')
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return (raw || 'yansi').slice(0, maxLen);
}

export function allocateJourneyId(titleSeed?: string): string {
  const base = slugifySeed(titleSeed || 'yansi');
  const entropy =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${entropy}`.slice(0, 64);
}

export function allocateDraftKey(sourceConversationId: string): string {
  const entropy =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `draft-${(sourceConversationId || 'conv').slice(0, 24)}-${entropy}`.slice(
    0,
    96
  );
}

/** Deterministic snapshot fingerprint for confirmed drafts. */
export function computeReview8SnapshotHash(
  steps: Review8SelectedStep[]
): string {
  const payload = steps
    .map(
      (s) =>
        `${s.index}|${s.userMessageId}|${s.assistantMessageId}|${s.publicQuestion}|${s.publicAnswer}`
    )
    .join('\n');
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function pairsToSelectedSteps(pairs: EligibleQaPair[]): Review8SelectedStep[] {
  const ordered = sortPairsBySourceOrder(pairs);
  if (ordered.length !== JOURNEY_CANDIDATE_COUNT) {
    throw new Error(
      `Review 8 requires exactly ${JOURNEY_CANDIDATE_COUNT} pairs; got ${ordered.length}`
    );
  }
  return ordered.map((pair, i) => ({
    ...pair,
    publicQuestion: pair.publicQuestion.trim(),
    publicAnswer: pair.publicAnswer.trim(),
    index: (i + 1) as Review8StepIndex,
  }));
}

export function reindexSelectedSteps(
  pairs: EligibleQaPair[]
): Review8SelectedStep[] {
  return sortPairsBySourceOrder(pairs).map((pair, i) => ({
    ...pair,
    publicQuestion: pair.publicQuestion.trim(),
    publicAnswer: pair.publicAnswer.trim(),
    index: (i + 1) as Review8StepIndex,
  }));
}

export function buildReview8DraftFromWindow(input: {
  ownerUserId: string;
  sourceConversationId: string;
  windowIndex: number;
  pairs: EligibleQaPair[];
  draftKey: string;
  parentJourneyId?: string | null;
  titleSeed?: string;
}): Review8Draft {
  const ownerUserId = (input.ownerUserId || '').trim();
  if (!ownerUserId) {
    throw new Error('Review 8 draft requires ownerUserId');
  }
  if (input.pairs.length !== JOURNEY_CANDIDATE_COUNT) {
    throw new Error(
      `Window Review 8 requires exactly ${JOURNEY_CANDIDATE_COUNT} pairs`
    );
  }
  const now = new Date().toISOString();
  const startSequence = input.windowIndex * JOURNEY_CANDIDATE_COUNT;
  return {
    ownerUserId,
    draftKey: input.draftKey,
    sourceConversationId: input.sourceConversationId,
    journeyId: null,
    selectedSteps: pairsToSelectedSteps(input.pairs),
    status: 'reviewing',
    updatedAt: now,
    titleSeed: input.titleSeed,
    snapshotHash: null,
    windowIndex: input.windowIndex,
    windowStartSequence: startSequence,
    windowEndSequence: startSequence + JOURNEY_CANDIDATE_COUNT - 1,
    parentJourneyId: input.parentJourneyId ?? null,
  };
}

export function buildReview8Draft(input: {
  ownerUserId: string;
  sourceConversationId: string;
  path: CandidatePath;
  titleSeed?: string;
  draftKey?: string;
}): Review8Draft {
  /** @deprecated Prefer buildReview8DraftFromWindow — CandidatePath is not Journey V1 authority. */
  const ownerUserId = (input.ownerUserId || '').trim();
  if (!ownerUserId) {
    throw new Error('Review 8 draft requires ownerUserId');
  }
  const now = new Date().toISOString();
  return {
    ownerUserId,
    draftKey: input.draftKey || allocateDraftKey(input.sourceConversationId),
    sourceConversationId: input.sourceConversationId,
    journeyId: null,
    selectedSteps: pairsToSelectedSteps(input.path.pairRefs),
    status: 'reviewing',
    updatedAt: now,
    titleSeed: input.titleSeed,
    snapshotHash: null,
  };
}

export type ConfirmReview8Result =
  | { ok: true; draft: Review8Draft }
  | { ok: false; code: 'invalid_step_count' | 'invalid_steps'; message: string };

export function confirmReview8Draft(draft: Review8Draft): ConfirmReview8Result {
  if (draft.selectedSteps.length !== JOURNEY_CANDIDATE_COUNT) {
    return {
      ok: false,
      code: 'invalid_step_count',
      message: `Onay için tam ${JOURNEY_CANDIDATE_COUNT} geçerli soru-cevap gerekir.`,
    };
  }
  for (const step of draft.selectedSteps) {
    if (
      !step.userMessageId ||
      !step.assistantMessageId ||
      !step.publicQuestion.trim() ||
      !step.publicAnswer.trim()
    ) {
      return {
        ok: false,
        code: 'invalid_steps',
        message: 'Her adımda soru ve cevap birlikte olmalıdır.',
      };
    }
  }

  const frozen = reindexSelectedSteps(draft.selectedSteps);
  const journeyId =
    draft.journeyId?.trim() ||
    allocateJourneyId(
      draft.titleSeed || frozen[0]?.publicQuestion || 'yansi'
    );
  const confirmed: Review8Draft = {
    ...draft,
    journeyId,
    status: 'confirmed',
    updatedAt: new Date().toISOString(),
    selectedSteps: frozen,
    snapshotHash: computeReview8SnapshotHash(frozen),
  };
  return { ok: true, draft: confirmed };
}

export function replaceReview8Step(
  draft: Review8Draft,
  index: Review8StepIndex,
  pair: EligibleQaPair
): Review8Draft {
  const without = draft.selectedSteps.filter((s) => s.index !== index);
  const nextPairs: EligibleQaPair[] = [
    ...without,
    {
      ...pair,
      publicQuestion: pair.publicQuestion.trim(),
      publicAnswer: pair.publicAnswer.trim(),
    },
  ];
  return {
    ...draft,
    selectedSteps: reindexSelectedSteps(nextPairs),
    status: 'reviewing',
    snapshotHash: null,
    // Keep journeyId if already allocated, but require re-confirm.
    journeyId: draft.journeyId,
    updatedAt: new Date().toISOString(),
  };
}

export type DraftValidationFailure = {
  ok: false;
  reason:
    | 'missing'
    | 'user_mismatch'
    | 'conversation_mismatch'
    | 'draft_key_mismatch'
    | 'step_count'
    | 'step_shape'
    | 'snapshot_mismatch'
    | 'unconfirmed';
  message: string;
};

export type DraftValidationSuccess = { ok: true; draft: Review8Draft };

export function validateReview8Draft(
  draft: Review8Draft | null | undefined,
  expected: {
    ownerUserId: string;
    sourceConversationId: string;
    draftKey?: string;
    requireConfirmed?: boolean;
  }
): DraftValidationSuccess | DraftValidationFailure {
  if (!draft) {
    return { ok: false, reason: 'missing', message: 'Review 8 taslağı yok.' };
  }
  if ((draft.ownerUserId || '').trim() !== (expected.ownerUserId || '').trim()) {
    return {
      ok: false,
      reason: 'user_mismatch',
      message: 'Taslak başka kullanıcıya ait.',
    };
  }
  if (
    (draft.sourceConversationId || '').trim() !==
    (expected.sourceConversationId || '').trim()
  ) {
    return {
      ok: false,
      reason: 'conversation_mismatch',
      message: 'Taslak başka sohbete ait.',
    };
  }
  if (
    expected.draftKey &&
    (draft.draftKey || '').trim() !== expected.draftKey.trim()
  ) {
    return {
      ok: false,
      reason: 'draft_key_mismatch',
      message: 'Taslak kimliği eşleşmiyor.',
    };
  }
  if (draft.selectedSteps?.length !== JOURNEY_CANDIDATE_COUNT) {
    return {
      ok: false,
      reason: 'step_count',
      message: `Taslakta ${JOURNEY_CANDIDATE_COUNT} adım olmalı.`,
    };
  }
  for (const step of draft.selectedSteps) {
    if (
      !step?.userMessageId ||
      !step?.assistantMessageId ||
      !String(step.publicQuestion || '').trim() ||
      !String(step.publicAnswer || '').trim()
    ) {
      return {
        ok: false,
        reason: 'step_shape',
        message: 'Taslak adımları bozuk.',
      };
    }
  }
  if (expected.requireConfirmed || draft.status === 'confirmed') {
    if (draft.status !== 'confirmed' || !draft.journeyId?.trim()) {
      return {
        ok: false,
        reason: 'unconfirmed',
        message: 'Review 8 henüz onaylanmadı.',
      };
    }
    const expectedHash = computeReview8SnapshotHash(draft.selectedSteps);
    if (!draft.snapshotHash || draft.snapshotHash !== expectedHash) {
      return {
        ok: false,
        reason: 'snapshot_mismatch',
        message: 'Onaylı taslak bütünlüğü bozulmuş.',
      };
    }
  }
  return { ok: true, draft };
}

export function isReview8DraftConfirmed(
  draft: Review8Draft | null | undefined
): boolean {
  if (!draft) return false;
  const result = validateReview8Draft(draft, {
    ownerUserId: draft.ownerUserId,
    sourceConversationId: draft.sourceConversationId,
    requireConfirmed: true,
  });
  return result.ok;
}
