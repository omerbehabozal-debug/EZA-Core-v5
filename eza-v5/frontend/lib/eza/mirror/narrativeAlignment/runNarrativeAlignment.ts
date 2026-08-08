/**
 * Run Narrative Alignment once for a scene + landing + anchors.
 */

import { extractHardClaims } from '@/lib/eza/mirror/narrativeAlignment/extractHardClaims';
import { matchClaims, toAlignmentLineage } from '@/lib/eza/mirror/narrativeAlignment/matchClaims';
import type { DetectImageClaimsFn } from '@/lib/eza/mirror/narrativeAlignment/detectImageClaims';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { PublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';
import type {
  NarrativeAlignmentLineage,
  NarrativeAlignmentResult,
} from '@/lib/eza/mirror/narrativeAlignment/types';

export type RunNarrativeAlignmentInput = {
  anchors: MirrorSemanticAnchorsV1;
  interpretation?: Pick<
    MirrorInterpretationV1,
    'title' | 'visualNarrative' | 'interpretationSummary' | 'imageIntent'
  > | null;
  landing: Pick<PublicMirrorLanding, 'publicTitle' | 'publicSummary'>;
  sceneImageUrl: string;
  detectClaims: DetectImageClaimsFn;
  retryAttempt?: 0 | 1;
  generationId?: string | null;
  interpretationHash?: string | null;
  publicLandingHash?: string | null;
  sceneAssetId?: string | null;
};

export type RunNarrativeAlignmentOutput = {
  result: NarrativeAlignmentResult;
  observability: NarrativeAlignmentLineage;
  landingSnapshot: { publicTitle: string; publicSummary: string };
  detectionSource: 'vision_api' | 'injected' | 'unavailable';
};

export async function runNarrativeAlignment(
  input: RunNarrativeAlignmentInput
): Promise<RunNarrativeAlignmentOutput> {
  const landingSnapshot = {
    publicTitle: input.landing.publicTitle,
    publicSummary: input.landing.publicSummary,
  };

  const extracted = extractHardClaims({
    anchors: input.anchors,
    interpretation: input.interpretation,
    landing: input.landing,
  });

  const detection = await input.detectClaims({
    sceneImageUrl: input.sceneImageUrl,
    generationId: input.generationId,
  });

  const unavailable = detection.source === 'unavailable';

  const result = matchClaims({
    extracted,
    detectedClaims: unavailable ? [] : detection.detectedClaims,
    retryAttempt: input.retryAttempt ?? 0,
    verificationState: unavailable ? 'verification_unavailable' : undefined,
    meta: {
      generationId: input.generationId,
      interpretationHash: input.interpretationHash,
      anchorsHash: input.anchors.anchorsHash,
      publicLandingHash: input.publicLandingHash,
      sceneAssetId: input.sceneAssetId,
    },
  });

  const observability = toAlignmentLineage(result);
  if (typeof console !== 'undefined' && console.info) {
    console.info('[narrative-alignment]', { ...observability, source: detection.source });
  }

  return {
    result,
    observability,
    landingSnapshot,
    detectionSource: detection.source,
  };
}
