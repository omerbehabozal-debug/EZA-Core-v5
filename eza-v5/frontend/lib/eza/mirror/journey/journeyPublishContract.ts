/**
 * Frontend journey publish contract — UX gate (backend enforces independently).
 */

import { isMirrorJourneyV1ClientEnabled } from './journeyClientFlag';
import {
  isReview8DraftConfirmed,
  validateReview8Draft,
} from './review8Draft';
import { loadActiveReview8Draft } from './review8DraftStore';
import {
  JOURNEY_CANDIDATE_COUNT,
  type Review8Draft,
  type Review8SelectedStep,
} from './types';

export type JourneyPublishContractOk = {
  ok: true;
  journeyId: string;
  selectedSteps: Review8SelectedStep[];
  draft: Review8Draft;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  parentJourneyId: string | null;
};

export type JourneyPublishContractFail = {
  ok: false;
  code:
    | 'review8_required'
    | 'journey_id_required'
    | 'invalid_steps'
    | 'draft_invalid'
    | 'user_required'
    | 'window_required';
  message: string;
};

export type JourneyPublishContractResult =
  | JourneyPublishContractOk
  | JourneyPublishContractFail;

/**
 * When client journey flag is on and conversationId is present, require a
 * validated confirmed Review 8 draft. Flag off → no journey contract (legacy).
 */
export function resolveJourneyPublishContract(input: {
  ownerUserId?: string | null;
  conversationId?: string | null;
  draft?: Review8Draft | null;
  env?: Record<string, string | undefined>;
}): JourneyPublishContractResult | { ok: true; legacy: true } {
  if (!isMirrorJourneyV1ClientEnabled(input.env)) {
    return { ok: true, legacy: true };
  }
  const conversationId = (input.conversationId || '').trim();
  if (!conversationId) {
    // Non-conversation intentional legacy / isolated product path.
    return { ok: true, legacy: true };
  }
  const ownerUserId = (input.ownerUserId || '').trim();
  if (!ownerUserId) {
    return {
      ok: false,
      code: 'user_required',
      message: 'Journey publish requires authenticated user.',
    };
  }

  const draft =
    input.draft ??
    loadActiveReview8Draft(ownerUserId, conversationId);

  const validated = validateReview8Draft(draft, {
    ownerUserId,
    sourceConversationId: conversationId,
    requireConfirmed: true,
  });
  if (!validated.ok) {
    if (draft && !isReview8DraftConfirmed(draft)) {
      return {
        ok: false,
        code: 'review8_required',
        message: 'Önce Review 8 ile 8 soruyu onaylayın.',
      };
    }
    return {
      ok: false,
      code: 'draft_invalid',
      message: validated.message,
    };
  }

  const journeyId = validated.draft.journeyId?.trim();
  if (!journeyId) {
    return {
      ok: false,
      code: 'journey_id_required',
      message: 'Onaylı Review 8 journeyId içermiyor.',
    };
  }
  if (validated.draft.selectedSteps.length !== JOURNEY_CANDIDATE_COUNT) {
    return {
      ok: false,
      code: 'invalid_steps',
      message: `Tam ${JOURNEY_CANDIDATE_COUNT} soru-cevap gerekli.`,
    };
  }

  const windowIndex = validated.draft.windowIndex;
  const windowStart = validated.draft.windowStartSequence;
  const windowEnd = validated.draft.windowEndSequence;
  if (
    typeof windowIndex !== 'number' ||
    typeof windowStart !== 'number' ||
    typeof windowEnd !== 'number'
  ) {
    return {
      ok: false,
      code: 'window_required',
      message: 'Onaylı Yansı pencere kimliği eksik.',
    };
  }

  return {
    ok: true,
    journeyId,
    selectedSteps: validated.draft.selectedSteps,
    draft: validated.draft,
    windowIndex,
    windowStart,
    windowEnd,
    parentJourneyId: validated.draft.parentJourneyId ?? null,
  };
}
