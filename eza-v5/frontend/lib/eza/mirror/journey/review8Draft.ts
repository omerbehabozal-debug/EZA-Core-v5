/**
 * Review draft builders + snapshot integrity (Phase 2 → Phase 3.7: 6–8 selection).
 */

import {
  JOURNEY_CANDIDATE_COUNT,
  JOURNEY_SELECTED_MAX,
  JOURNEY_SELECTED_MIN,
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

/** Deterministic snapshot fingerprint for confirmed selected steps. */
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

/** Stable source-block hash over all 8 pairs (independent of deselection). */
export function computeSourceBlockHash(pairs: EligibleQaPair[]): string {
  const ordered = sortPairsBySourceOrder(pairs);
  const payload = ordered
    .map(
      (s) =>
        `${s.sourceOrder}|${s.userMessageId}|${s.assistantMessageId}|${s.publicQuestion}|${s.publicAnswer}`
    )
    .join('\n');
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `b${(hash >>> 0).toString(16)}`;
}

export async function computeSelectedStepsHash(
  steps: Review8SelectedStep[]
): Promise<string> {
  const rows = [...steps]
    .sort((a, b) => a.index - b.index)
    .map((step) => ({
      stepIndex: step.index,
      sourceOrder: step.sourceOrder,
      sourceUserMessageId: step.userMessageId,
      sourceAssistantMessageId: step.assistantMessageId,
      publicQuestion: step.publicQuestion,
      publicAnswer: step.publicAnswer,
    }));
  const payload = JSON.stringify(rows);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(payload)
    );
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `t${hex.slice(0, 32)}`;
  }
  // Node/test fallback — not used for authority; server recomputes.
  let h = 0;
  for (let i = 0; i < payload.length; i += 1) h = (h * 31 + payload.charCodeAt(i)) >>> 0;
  return `t${h.toString(16).padStart(8, '0').repeat(4).slice(0, 32)}`;
}

export function pairsToSelectedSteps(pairs: EligibleQaPair[]): Review8SelectedStep[] {
  const ordered = sortPairsBySourceOrder(pairs);
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
    throw new Error('Review draft requires ownerUserId');
  }
  if (input.pairs.length !== JOURNEY_CANDIDATE_COUNT) {
    throw new Error(
      `Source block requires exactly ${JOURNEY_CANDIDATE_COUNT} pairs`
    );
  }
  const now = new Date().toISOString();
  const startSequence = input.windowIndex * JOURNEY_CANDIDATE_COUNT;
  const block = sortPairsBySourceOrder(input.pairs).map((p) => ({
    ...p,
    publicQuestion: p.publicQuestion.trim(),
    publicAnswer: p.publicAnswer.trim(),
  }));
  const selected = pairsToSelectedSteps(block);
  return {
    ownerUserId,
    draftKey: input.draftKey,
    sourceConversationId: input.sourceConversationId,
    journeyId: null,
    selectedSteps: selected,
    sourceBlockSteps: block,
    selectedSourceOrders: block.map((p) => p.sourceOrder),
    status: 'reviewing',
    updatedAt: now,
    titleSeed: input.titleSeed,
    snapshotHash: null,
    windowIndex: input.windowIndex,
    windowStartSequence: startSequence,
    windowEndSequence: startSequence + JOURNEY_CANDIDATE_COUNT - 1,
    parentJourneyId: input.parentJourneyId ?? null,
    sourceBlockHash: computeSourceBlockHash(block),
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
    throw new Error('Review draft requires ownerUserId');
  }
  const now = new Date().toISOString();
  const selected = pairsToSelectedSteps(input.path.pairRefs);
  return {
    ownerUserId,
    draftKey: input.draftKey || allocateDraftKey(input.sourceConversationId),
    sourceConversationId: input.sourceConversationId,
    journeyId: null,
    selectedSteps: selected,
    sourceBlockSteps: sortPairsBySourceOrder(input.path.pairRefs),
    selectedSourceOrders: selected.map((s) => s.sourceOrder),
    status: 'reviewing',
    updatedAt: now,
    titleSeed: input.titleSeed,
    snapshotHash: null,
  };
}

export type ConfirmReview8Result =
  | { ok: true; draft: Review8Draft }
  | {
      ok: false;
      code: 'invalid_step_count' | 'invalid_steps' | 'below_minimum';
      message: string;
    };

const MIN_SELECTED_COPY =
  'Yansı oluşturulabilmesi için en az 6 soru seçili olmalı.';

export function confirmReview8Draft(draft: Review8Draft): ConfirmReview8Result {
  const block = draft.sourceBlockSteps?.length
    ? sortPairsBySourceOrder(draft.sourceBlockSteps)
    : sortPairsBySourceOrder(draft.selectedSteps);

  const selectedOrders =
    draft.selectedSourceOrders?.length
      ? [...draft.selectedSourceOrders]
      : draft.selectedSteps.map((s) => s.sourceOrder);

  const uniqueOrders = [...new Set(selectedOrders)].sort((a, b) => a - b);
  if (uniqueOrders.length < JOURNEY_SELECTED_MIN) {
    return {
      ok: false,
      code: 'below_minimum',
      message: MIN_SELECTED_COPY,
    };
  }
  if (uniqueOrders.length > JOURNEY_SELECTED_MAX) {
    return {
      ok: false,
      code: 'invalid_step_count',
      message: `En fazla ${JOURNEY_SELECTED_MAX} soru seçilebilir.`,
    };
  }

  const selectedPairs = uniqueOrders
    .map((order) => block.find((p) => p.sourceOrder === order))
    .filter((p): p is EligibleQaPair => Boolean(p));

  if (selectedPairs.length !== uniqueOrders.length) {
    return {
      ok: false,
      code: 'invalid_steps',
      message: 'Seçilen adımlar kaynak blokta bulunamadı.',
    };
  }

  for (const step of selectedPairs) {
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

  const frozen = reindexSelectedSteps(selectedPairs);
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
    sourceBlockSteps: block,
    selectedSourceOrders: uniqueOrders,
    snapshotHash: computeReview8SnapshotHash(frozen),
    sourceBlockHash: computeSourceBlockHash(block),
  };
  return { ok: true, draft: confirmed };
}

/** Toggle Q+A atomically by sourceOrder. Never auto-repair below 6. */
export function toggleReviewSourceOrder(
  draft: Review8Draft,
  sourceOrder: number
): Review8Draft {
  const block = draft.sourceBlockSteps?.length
    ? draft.sourceBlockSteps
    : draft.selectedSteps;
  if (!block.some((p) => p.sourceOrder === sourceOrder)) {
    return draft;
  }
  const current = new Set(
    draft.selectedSourceOrders?.length
      ? draft.selectedSourceOrders
      : draft.selectedSteps.map((s) => s.sourceOrder)
  );
  if (current.has(sourceOrder)) {
    current.delete(sourceOrder);
  } else {
    current.add(sourceOrder);
  }
  const orders = [...current].sort((a, b) => a - b);
  const selectedPairs = orders
    .map((o) => block.find((p) => p.sourceOrder === o)!)
    .filter(Boolean);
  return {
    ...draft,
    selectedSourceOrders: orders,
    selectedSteps: reindexSelectedSteps(selectedPairs),
    status: 'reviewing',
    snapshotHash: null,
    updatedAt: new Date().toISOString(),
  };
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
    selectedSourceOrders: nextPairs.map((p) => p.sourceOrder).sort((a, b) => a - b),
    status: 'reviewing',
    snapshotHash: null,
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
    return { ok: false, reason: 'missing', message: 'Review taslağı yok.' };
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
  const count = draft.selectedSteps?.length ?? 0;
  if (count < JOURNEY_SELECTED_MIN || count > JOURNEY_SELECTED_MAX) {
    return {
      ok: false,
      reason: 'step_count',
      message: `Taslakta ${JOURNEY_SELECTED_MIN}–${JOURNEY_SELECTED_MAX} adım olmalı.`,
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
        message: 'Review henüz onaylanmadı.',
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

export { MIN_SELECTED_COPY };
