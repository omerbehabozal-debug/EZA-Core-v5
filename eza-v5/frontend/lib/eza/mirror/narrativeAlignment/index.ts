export type {
  DetectedClaim,
  ExtractedClaims,
  NarrativeAlignmentLineage,
  NarrativeAlignmentMatchStatus,
  NarrativeAlignmentObservability,
  NarrativeAlignmentResult,
  NarrativeClaim,
  NarrativeClaimImportance,
  NarrativeClaimType,
  NarrativeVerificationState,
} from '@/lib/eza/mirror/narrativeAlignment/types';
export {
  NARRATIVE_ALIGNMENT_VERSION,
  NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
  NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR,
} from '@/lib/eza/mirror/narrativeAlignment/types';
export {
  claimKey,
  claimsEquivalent,
  normalizeClaimText,
  CLAIM_ALIAS_GROUPS,
} from '@/lib/eza/mirror/narrativeAlignment/aliases';
export {
  extractHardClaims,
  type ExtractHardClaimsInput,
} from '@/lib/eza/mirror/narrativeAlignment/extractHardClaims';
export {
  matchClaims,
  toAlignmentLineage,
  toAlignmentObservability,
} from '@/lib/eza/mirror/narrativeAlignment/matchClaims';
export {
  runNarrativeAlignment,
  type RunNarrativeAlignmentInput,
  type RunNarrativeAlignmentOutput,
} from '@/lib/eza/mirror/narrativeAlignment/runNarrativeAlignment';
export {
  runNarrativeAlignmentPublishGate,
  type NarrativeAlignmentPublishGateInput,
  type NarrativeAlignmentPublishGateResult,
  type RegenerateSceneFn,
} from '@/lib/eza/mirror/narrativeAlignment/publishGate';
export {
  apiImageClaimDetector,
  createInjectedClaimDetector,
  emptyImageClaimDetector,
  type DetectImageClaimsFn,
  type DetectImageClaimsInput,
  type DetectImageClaimsResult,
} from '@/lib/eza/mirror/narrativeAlignment/detectImageClaims';
export {
  createAlignmentSceneRegenerator,
  type CreateAlignmentSceneRegeneratorInput,
} from '@/lib/eza/mirror/narrativeAlignment/createAlignmentSceneRegenerator';
