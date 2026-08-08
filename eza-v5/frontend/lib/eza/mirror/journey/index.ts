/**
 * Mirror Journey Phase 2 — Q/A pairing, Candidate 8, Review 8 draft.
 * RFC: eza-v5/docs/mirror/rfc-journey-identity-review8.md §4–9
 */

export type {
  JourneyMessageLike,
  EligibleQaPair,
  CandidatePath,
  Candidate8Result,
  Review8StepIndex,
  Review8SelectedStep,
  Review8DraftStatus,
  Review8Draft,
} from './types';

export {
  JOURNEY_CANDIDATE_COUNT,
  REVIEW8_DRAFT_STORAGE_KEY,
  MIRROR_JOURNEY_CLIENT_FLAG,
} from './types';

export { extractQaPairs } from './extractQaPairs';
export {
  proposeCandidate8,
  proposeCandidatePaths,
  scorePairForPath,
} from './proposeCandidate8';
export {
  allocateJourneyId,
  buildReview8Draft,
  confirmReview8Draft,
  replaceReview8Step,
  isReview8DraftConfirmed,
} from './review8Draft';
export {
  saveReview8Draft,
  loadReview8Draft,
  loadReview8DraftForConversation,
  clearReview8Draft,
  clearReview8DraftForConversation,
} from './review8DraftStore';
export { isMirrorJourneyV1ClientEnabled } from './journeyClientFlag';
