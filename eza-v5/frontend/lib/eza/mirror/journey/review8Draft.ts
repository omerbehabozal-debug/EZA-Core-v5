/**
 * Review 8 draft builders — freeze selected Q/A + allocate journeyId on confirm.
 */

import {
  JOURNEY_CANDIDATE_COUNT,
  type CandidatePath,
  type EligibleQaPair,
  type Review8Draft,
  type Review8SelectedStep,
  type Review8StepIndex,
} from './types';

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

/** Public journeyId (= network slug). Stable-ish from title + short entropy. */
export function allocateJourneyId(titleSeed?: string): string {
  const base = slugifySeed(titleSeed || 'yansi');
  const entropy =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${entropy}`.slice(0, 64);
}

export function pairsToSelectedSteps(pairs: EligibleQaPair[]): Review8SelectedStep[] {
  if (pairs.length !== JOURNEY_CANDIDATE_COUNT) {
    throw new Error(
      `Review 8 requires exactly ${JOURNEY_CANDIDATE_COUNT} pairs; got ${pairs.length}`
    );
  }
  return pairs.map((pair, i) => ({
    ...pair,
    // Freeze by value (already plain strings on EligibleQaPair)
    publicQuestion: pair.publicQuestion.trim(),
    publicAnswer: pair.publicAnswer.trim(),
    index: (i + 1) as Review8StepIndex,
  }));
}

export function buildReview8Draft(input: {
  sourceConversationId: string;
  path: CandidatePath;
  titleSeed?: string;
  draftKey?: string;
}): Review8Draft {
  const now = new Date().toISOString();
  return {
    draftKey:
      input.draftKey ||
      `draft-${input.sourceConversationId}-${input.path.pathId}`.slice(0, 96),
    sourceConversationId: input.sourceConversationId,
    journeyId: null,
    selectedSteps: pairsToSelectedSteps(input.path.pairRefs),
    status: 'reviewing',
    updatedAt: now,
    titleSeed: input.titleSeed,
  };
}

/** Confirm freezes steps and allocates journeyId (idempotent if already confirmed). */
export function confirmReview8Draft(draft: Review8Draft): Review8Draft {
  if (draft.selectedSteps.length !== JOURNEY_CANDIDATE_COUNT) {
    throw new Error(
      `Cannot confirm Review 8: need ${JOURNEY_CANDIDATE_COUNT} steps, got ${draft.selectedSteps.length}`
    );
  }
  const journeyId =
    draft.journeyId?.trim() ||
    allocateJourneyId(
      draft.titleSeed || draft.selectedSteps[0]?.publicQuestion || 'yansi'
    );
  return {
    ...draft,
    journeyId,
    status: 'confirmed',
    updatedAt: new Date().toISOString(),
    selectedSteps: draft.selectedSteps.map((s) => ({
      ...s,
      publicQuestion: s.publicQuestion.trim(),
      publicAnswer: s.publicAnswer.trim(),
    })),
  };
}

export function replaceReview8Step(
  draft: Review8Draft,
  index: Review8StepIndex,
  pair: EligibleQaPair
): Review8Draft {
  const next = draft.selectedSteps.map((step) =>
    step.index === index
      ? {
          ...pair,
          publicQuestion: pair.publicQuestion.trim(),
          publicAnswer: pair.publicAnswer.trim(),
          index,
        }
      : step
  );
  return {
    ...draft,
    selectedSteps: next,
    status: draft.status === 'confirmed' ? 'reviewing' : draft.status,
    journeyId: draft.status === 'confirmed' ? draft.journeyId : draft.journeyId,
    updatedAt: new Date().toISOString(),
  };
}

export function isReview8DraftConfirmed(draft: Review8Draft | null | undefined): boolean {
  return Boolean(
    draft &&
      draft.status === 'confirmed' &&
      draft.journeyId &&
      draft.selectedSteps.length === JOURNEY_CANDIDATE_COUNT
  );
}
