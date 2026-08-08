/**
 * Match required hard claims against lightweight vision detections.
 */

import { djb2Hex } from '@/lib/eza/mirror/mirrorLineageHash';
import { claimsEquivalent, claimKey } from '@/lib/eza/mirror/narrativeAlignment/aliases';
import type {
  DetectedClaim,
  ExtractedClaims,
  NarrativeAlignmentLineage,
  NarrativeAlignmentResult,
  NarrativeClaim,
  NarrativeVerificationState,
} from '@/lib/eza/mirror/narrativeAlignment/types';
import { NARRATIVE_ALIGNMENT_VERSION } from '@/lib/eza/mirror/narrativeAlignment/types';

function detectedMatchesClaim(detected: DetectedClaim[], claim: NarrativeClaim): boolean {
  return detected.some((d) => claimsEquivalent(d.value, claim.value));
}

export type MatchClaimsInput = {
  extracted: ExtractedClaims;
  detectedClaims: DetectedClaim[];
  landingOnlyHardClaims?: NarrativeClaim[];
  retryAttempt?: 0 | 1;
  verificationState?: NarrativeVerificationState;
  meta?: Partial<
    Pick<
      NarrativeAlignmentResult,
      | 'generationId'
      | 'interpretationHash'
      | 'anchorsHash'
      | 'publicLandingHash'
      | 'sceneAssetId'
    >
  >;
};

export function matchClaims(input: MatchClaimsInput): NarrativeAlignmentResult {
  const { extracted, detectedClaims } = input;
  const retryAttempt = input.retryAttempt ?? 0;

  const matchedClaims: NarrativeClaim[] = [];
  const missingClaims: NarrativeClaim[] = [];

  for (const claim of extracted.requiredClaims) {
    if (detectedMatchesClaim(detectedClaims, claim)) {
      matchedClaims.push(claim);
    } else {
      missingClaims.push(claim);
    }
  }

  const unsupportedLandingClaims: NarrativeClaim[] = [];
  for (const claim of input.landingOnlyHardClaims ?? []) {
    if (!detectedMatchesClaim(detectedClaims, claim)) {
      unsupportedLandingClaims.push(claim);
    }
  }

  const detectedClaimsHash = djb2Hex(
    JSON.stringify(
      detectedClaims
        .map((d) => ({ t: d.type, k: claimKey(d.value) }))
        .sort((a, b) => `${a.t}:${a.k}`.localeCompare(`${b.t}:${b.k}`))
    )
  );

  const matchPass =
    missingClaims.length === 0 && unsupportedLandingClaims.length === 0;

  let verificationState: NarrativeVerificationState =
    input.verificationState ?? (matchPass ? 'verified_pass' : 'verified_fail');

  if (input.verificationState === 'verification_unavailable') {
    verificationState = 'verification_unavailable';
  }

  const status =
    verificationState === 'verification_unavailable'
      ? 'FAIL'
      : matchPass
        ? 'PASS'
        : 'FAIL';

  return {
    status,
    verificationState,
    alignmentVersion: NARRATIVE_ALIGNMENT_VERSION,
    matchedClaims,
    missingClaims,
    unsupportedLandingClaims,
    requiredClaims: extracted.requiredClaims,
    supportingClaims: extracted.supportingClaims,
    softClaims: extracted.softClaims,
    detectedClaims,
    requiredClaimsHash: extracted.requiredClaimsHash,
    detectedClaimsHash,
    retryAttempt,
    ...input.meta,
  };
}

export function toAlignmentLineage(
  result: NarrativeAlignmentResult
): NarrativeAlignmentLineage {
  const alignmentStatus: NarrativeAlignmentLineage['alignmentStatus'] =
    result.verificationState === 'verification_unavailable'
      ? 'UNAVAILABLE'
      : result.verificationState === 'verified_pass'
        ? 'PASS'
        : 'FAIL';

  return {
    generationId: result.generationId,
    interpretationHash: result.interpretationHash,
    anchorsHash: result.anchorsHash,
    publicLandingHash: result.publicLandingHash,
    sceneAssetId: result.sceneAssetId,
    alignmentVersion: result.alignmentVersion,
    alignmentStatus,
    verificationState: result.verificationState,
    requiredClaimsHash: result.requiredClaimsHash,
    detectedClaimsHash: result.detectedClaimsHash,
    missingClaims: result.missingClaims.map((c) => `${c.type}:${c.value}`),
    retryAttempt: result.retryAttempt,
  };
}

/** @deprecated Use toAlignmentLineage */
export function toAlignmentObservability(
  result: NarrativeAlignmentResult
): NarrativeAlignmentLineage {
  return toAlignmentLineage(result);
}
