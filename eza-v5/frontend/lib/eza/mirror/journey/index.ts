/**
 * Mirror Journey — deterministic 8-question windows (product model reset).
 * Candidate 8 / topic clustering are NOT Journey V1 authority.
 */

export type {
  JourneyMessageLike,
  JourneyMessageRole,
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

export {
  extractQaPairs,
  resolveJourneyMessageRole,
  isEligiblePairingMessage,
  isLowInformationQuestion,
} from './extractQaPairs';

/** @deprecated Not Journey V1 authority — kept for tests/legacy helpers only. */
export {
  proposeCandidate8,
  proposeCandidatePaths,
  scorePairForPath,
  sortPairsBySourceOrder,
  dedupeNearDuplicatePairs,
  areNearDuplicateQuestions,
} from './proposeCandidate8';

export {
  JOURNEY_WINDOW_SIZE,
  JOURNEY_CONVERSATION_MAX_PAIRS,
  JOURNEY_MAX_PUBLISHABLE_WINDOWS,
  syncJourneyConversationState,
  createEmptyJourneyConversationState,
  getAwaitingDecisionWindow,
  skipJourneyWindow,
  markJourneyWindowReviewing,
  reopenJourneyWindowDecision,
  confirmJourneyWindow,
  markJourneyWindowReady,
  resolveParentJourneyId,
  pairsForWindow,
  isFullWindow,
  windowRange,
  canSendMoreJourneyQuestions,
  listPublishedJourneyChain,
  allocateWindowDraftKey,
  countAcceptedEligibleUserQuestions,
  canAcceptAnotherJourneyQuestion,
  type JourneyWindowStatus,
  type JourneyWindowRecord,
  type JourneyConversationState,
} from './journeyWindows';

export {
  loadJourneyConversationState,
  saveJourneyConversationState,
  clearJourneyConversationState,
  clearAllJourneyConversationStates,
  ensureJourneyConversationState,
  JOURNEY_WINDOW_STATE_STORAGE_KEY,
  type SaveJourneyStateResult,
} from './journeyWindowStore';

export {
  allocateJourneyId,
  allocateDraftKey,
  buildReview8Draft,
  buildReview8DraftFromWindow,
  confirmReview8Draft,
  replaceReview8Step,
  isReview8DraftConfirmed,
  validateReview8Draft,
  computeReview8SnapshotHash,
  reindexSelectedSteps,
  pairsToSelectedSteps,
} from './review8Draft';

export {
  saveReview8Draft,
  loadReview8Draft,
  loadActiveReview8Draft,
  loadReview8DraftForConversation,
  listReview8DraftsForConversation,
  setActiveReview8DraftKey,
  clearReview8Draft,
  clearReview8DraftsForUser,
  clearAllReview8Drafts,
} from './review8DraftStore';

export {
  JOURNEY_SEMANTIC_SCOPE_V1,
  computeJourneyWindowHash,
  computeScopedJourneyInputHash,
  buildScopedPrepareMessagesFromSteps,
  confirmedJourneyWindowFromDraft,
  resolveScopedJourneyMeaning,
  type ConfirmedJourneyWindow,
  type JourneySemanticScopePayload,
  type ScopedJourneyMeaningOk,
  type ScopedJourneyMeaningFail,
} from './scopedJourneyMeaning';

export { isMirrorJourneyV1ClientEnabled } from './journeyClientFlag';
export {
  resolveJourneyPublishContract,
  type JourneyPublishContractResult,
} from './journeyPublishContract';
