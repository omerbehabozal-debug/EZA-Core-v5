/**
 * Mirror Journey — deterministic source-block windows (Phase 3.7).
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
  JOURNEY_SELECTED_MIN,
  JOURNEY_SELECTED_MAX,
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
  JOURNEY_SOURCE_BLOCK_SIZE,
  JOURNEY_CONVERSATION_MAX_PAIRS,
  JOURNEY_MAX_PUBLISHABLE_WINDOWS,
  syncJourneyConversationState,
  createEmptyJourneyConversationState,
  getAwaitingDecisionWindow,
  skipJourneyWindow,
  enterPrivateChatMode,
  markJourneyWindowReviewing,
  reopenJourneyWindowDecision,
  confirmJourneyWindow,
  markJourneyWindowReady,
  markJourneyWindowFailed,
  resolveParentJourneyId,
  pairsForWindow,
  isFullWindow,
  windowRange,
  blockRange,
  canSendMoreJourneyQuestions,
  listPublishedJourneyChain,
  allocateWindowDraftKey,
  countAcceptedEligibleUserQuestions,
  canAcceptAnotherJourneyQuestion,
  isPrivateChatMode,
  type JourneyMode,
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
  toggleReviewSourceOrder,
  isReview8DraftConfirmed,
  validateReview8Draft,
  computeReview8SnapshotHash,
  computeSourceBlockHash,
  reindexSelectedSteps,
  pairsToSelectedSteps,
  MIN_SELECTED_COPY,
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

export {
  canReuseMappedPromptForJourney,
  readJourneyPromptLineage,
  JOURNEY_MAPPER_VERSION_V5,
  type MirrorJourneyPromptLineage,
} from './canReuseMappedPromptForJourney';

export {
  JOURNEY_GENERATION_LINEAGE_VERSION,
  isPublishableJourneyGenerationLineage,
  readJourneyGenerationLineage,
  sealJourneyGenerationLineage,
  cloneJourneyGenerationLineage,
  type JourneyGenerationLineage,
  type JourneyGenerationLineagePartial,
  type JourneyGenerationLineageSelectedStep,
} from './journeyGenerationLineage';

export {
  saveJourneyGenerationArtifact,
  loadJourneyGenerationArtifact,
  listJourneyGenerationArtifactsForConversation,
  clearJourneyGenerationArtifactsForUser,
  JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY,
} from './journeyGenerationArtifactStore';

export {
  type MirrorJourneyArtifactStatus,
  type MirrorJourneyArtifactPublish,
  type MirrorJourneyArtifact,
  cloneMirrorJourneyArtifact,
  isMirrorJourneyArtifact,
  artifactIdentityKey,
  buildGeneratingMirrorJourneyArtifact,
  buildReadyMirrorJourneyArtifactFromLineage,
  applyPublishSuccessToArtifact,
  applyPublishFailureToArtifact,
  applyGenerationFailureToArtifact,
} from './mirrorJourneyArtifact';

export {
  listJourneyArtifactsForConversation,
  listMirrorJourneyArtifactsForConversation,
  loadMirrorJourneyArtifact,
  saveMirrorJourneyArtifact,
  upsertMirrorJourneyArtifact,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  markMirrorJourneyArtifactPublished,
  markMirrorJourneyArtifactPublishFailed,
  markMirrorJourneyArtifactFailed,
  patchMirrorJourneyArtifactMetrics,
  clearMirrorJourneyArtifactsForUser,
  clearAllMirrorJourneyArtifactsForTests,
  subscribeMirrorJourneyArtifactStore,
  MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY,
  type SaveMirrorJourneyArtifactResult,
} from './mirrorJourneyArtifactStore';

export {
  resolveJourneyArtifactShareIdentity,
  previewFieldsFromArtifact,
} from './resolveJourneyArtifactShareIdentity';

export { completeJourneyGenerationLineageSeal } from './completeJourneyGenerationLineageSeal';

export {
  buildPublishCardFromArtifact,
  artifactMatchesLiveCard,
} from './buildPublishCardFromArtifact';

export {
  type MirrorJourneySharePayload,
  resolveMirrorJourneySharePayload,
  withJourneySharePublishIdentity,
  publicPreviewFromJourneySharePayload,
  resolveJourneyShareCaption,
  buildShareCardFromJourneyPayload,
  isSameJourneyShareSession,
} from './resolveMirrorJourneySharePayload';

export {
  resolveAuthorDisplayName,
  formatParentLineageLabel,
} from './aynaAuthorDisplay';

export { isMirrorJourneyV1ClientEnabled } from './journeyClientFlag';
export {
  resolveJourneyPublishContract,
  type JourneyPublishContractResult,
} from './journeyPublishContract';

export {
  hydratePublishedJourneysFromServer,
  fetchFrozenJourneyArtifact,
  type OwnerPublishedJourneyServerItem,
  type OwnerPublishedJourneysResponse,
} from './hydratePublishedJourneysFromServer';

export {
  attachEzaSnapshotsToSelectedSteps,
  type FrozenStepEzaSnapshotInput,
  type JourneyPublishStepWithOptionalEza,
} from './attachEzaSnapshotsToSelectedSteps';
