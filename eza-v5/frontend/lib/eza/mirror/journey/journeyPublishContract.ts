/**
 * Frontend journey publish contract — UX gate (backend enforces independently).
 *
 * Phase 3.6: when a sealed generation lineage is present on the artifact,
 * publish MUST use that snapshot — never the live Review 8 draft.
 */

import { isMirrorJourneyV1ClientEnabled } from './journeyClientFlag';
import {
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from './journeyGenerationLineage';
import { loadJourneyGenerationArtifact } from './journeyGenerationArtifactStore';
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
  draft?: Review8Draft;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  parentJourneyId: string | null;
  /** Phase 3.6 — sealed generation lineage when publishing a generated artifact. */
  generationLineage?: JourneyGenerationLineage;
  source: 'generation_lineage' | 'review8_draft';
};

export type JourneyPublishContractFail = {
  ok: false;
  code:
    | 'review8_required'
    | 'journey_id_required'
    | 'invalid_steps'
    | 'draft_invalid'
    | 'user_required'
    | 'window_required'
    | 'lineage_required'
    | 'lineage_stale';
  message: string;
};

export type JourneyPublishContractResult =
  | JourneyPublishContractOk
  | JourneyPublishContractFail;

function stepsFromLineage(
  lineage: JourneyGenerationLineage
): Review8SelectedStep[] {
  return lineage.selectedSteps.map((s) => ({
    index: s.stepIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    sourceOrder: s.sourceOrder,
    userMessageId: s.sourceUserMessageId,
    assistantMessageId: s.sourceAssistantMessageId,
    publicQuestion: s.publicQuestion,
    publicAnswer: s.publicAnswer,
  }));
}

/**
 * When client journey flag is on and conversationId is present, require either:
 * - a sealed JourneyGenerationLineage on the generated artifact, OR
 * - a validated confirmed Review 8 draft (pre-generation only).
 */
export function resolveJourneyPublishContract(input: {
  ownerUserId?: string | null;
  conversationId?: string | null;
  draft?: Review8Draft | null;
  /** Prefer sealed lineage from the generated Mirror card. */
  generationLineage?: unknown;
  /** Optional lookup key when card lineage missing but artifact store has it. */
  journeyId?: string | null;
  journeyVersion?: number | null;
  env?: Record<string, string | undefined>;
}): JourneyPublishContractResult | { ok: true; legacy: true } {
  if (!isMirrorJourneyV1ClientEnabled(input.env)) {
    return { ok: true, legacy: true };
  }
  const conversationId = (input.conversationId || '').trim();
  if (!conversationId) {
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

  let lineage: JourneyGenerationLineage | null = null;
  if (isPublishableJourneyGenerationLineage(input.generationLineage)) {
    lineage = input.generationLineage;
  } else if (
    input.journeyId &&
    typeof input.journeyVersion === 'number' &&
    input.journeyVersion >= 1
  ) {
    lineage = loadJourneyGenerationArtifact(
      ownerUserId,
      input.journeyId,
      input.journeyVersion
    );
  }

  if (lineage) {
    if (lineage.sourceConversationId.trim() !== conversationId) {
      return {
        ok: false,
        code: 'lineage_stale',
        message: 'Generation lineage conversation does not match this chat.',
      };
    }
    return {
      ok: true,
      journeyId: lineage.journeyId,
      selectedSteps: stepsFromLineage(lineage),
      windowIndex: lineage.windowIndex,
      windowStart: lineage.windowStart,
      windowEnd: lineage.windowEnd,
      parentJourneyId: lineage.parentJourneyId ?? null,
      generationLineage: lineage,
      source: 'generation_lineage',
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

  // Generated artifact missing — draft alone is insufficient for publish after scene.
  // Callers that already generated must attach lineage; pre-generate UX may still use draft.
  return {
    ok: true,
    journeyId,
    selectedSteps: validated.draft.selectedSteps,
    draft: validated.draft,
    windowIndex,
    windowStart,
    windowEnd,
    parentJourneyId: validated.draft.parentJourneyId ?? null,
    source: 'review8_draft',
  };
}
