/**
 * Mirror V6 — Narrative Alignment Phase 1 (publish gate).
 * Question: does the image contain the concrete claims the public landing makes?
 */

export const NARRATIVE_ALIGNMENT_VERSION = 'mirror-narrative-alignment-v1' as const;

export type NarrativeClaimType =
  | 'place'
  | 'brand'
  | 'product'
  | 'object'
  | 'landmark'
  | 'setting';

export type NarrativeClaimImportance = 'required' | 'supporting' | 'soft';

export type NarrativeClaim = {
  type: NarrativeClaimType;
  value: string;
  importance: NarrativeClaimImportance;
  /** Normalized key used for matching. */
  key: string;
};

export type DetectedClaim = {
  type: NarrativeClaimType | 'vehicle_brand' | string;
  value: string;
};

export type ExtractedClaims = {
  requiredClaims: NarrativeClaim[];
  supportingClaims: NarrativeClaim[];
  softClaims: string[];
  requiredClaimsHash: string;
};

/** Match outcome of required claims vs detections (internal). */
export type NarrativeAlignmentMatchStatus = 'PASS' | 'FAIL';

/**
 * Production verification state — never collapse unavailable into ordinary PASS.
 * - verified_pass: vision ran; required claims matched
 * - verified_fail: vision ran; required claims missing
 * - verification_unavailable: vision could not run / returned no usable detection
 */
export type NarrativeVerificationState =
  | 'verified_pass'
  | 'verified_fail'
  | 'verification_unavailable';

export type NarrativeAlignmentResult = {
  status: NarrativeAlignmentMatchStatus;
  verificationState: NarrativeVerificationState;
  alignmentVersion: typeof NARRATIVE_ALIGNMENT_VERSION;
  matchedClaims: NarrativeClaim[];
  missingClaims: NarrativeClaim[];
  unsupportedLandingClaims: NarrativeClaim[];
  requiredClaims: NarrativeClaim[];
  supportingClaims: NarrativeClaim[];
  softClaims: string[];
  detectedClaims: DetectedClaim[];
  requiredClaimsHash: string;
  detectedClaimsHash: string;
  retryAttempt: 0 | 1;
  generationId?: string | null;
  interpretationHash?: string | null;
  anchorsHash?: string | null;
  publicLandingHash?: string | null;
  sceneAssetId?: string | null;
};

/** Persistable / loggable lineage blob (no conversation text). */
export type NarrativeAlignmentLineage = {
  generationId?: string | null;
  interpretationHash?: string | null;
  anchorsHash?: string | null;
  publicLandingHash?: string | null;
  sceneAssetId?: string | null;
  alignmentVersion: typeof NARRATIVE_ALIGNMENT_VERSION;
  /** @deprecated Prefer verificationState — kept for older readers as PASS|FAIL|UNAVAILABLE */
  alignmentStatus: 'PASS' | 'FAIL' | 'UNAVAILABLE';
  verificationState: NarrativeVerificationState;
  requiredClaimsHash: string;
  detectedClaimsHash: string;
  missingClaims: string[];
  retryAttempt: 0 | 1;
};

export type NarrativeAlignmentObservability = NarrativeAlignmentLineage;

/** Error codes returned to UI / publish callers. */
export const NARRATIVE_ALIGNMENT_PUBLISH_ERROR = 'narrative_alignment_failed' as const;
export const NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR =
  'narrative_alignment_verification_unavailable' as const;
