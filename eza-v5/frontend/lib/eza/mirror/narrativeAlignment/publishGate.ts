/**
 * Publish gate: Narrative Alignment with one scene regenerate on FAIL.
 * Never mutates public landing to fit a wrong image.
 */

import { runNarrativeAlignment } from '@/lib/eza/mirror/narrativeAlignment/runNarrativeAlignment';
import type { DetectImageClaimsFn } from '@/lib/eza/mirror/narrativeAlignment/detectImageClaims';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { PublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';
import type {
  NarrativeAlignmentLineage,
  NarrativeAlignmentResult,
} from '@/lib/eza/mirror/narrativeAlignment/types';
import {
  NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
  NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR,
} from '@/lib/eza/mirror/narrativeAlignment/types';

export type RegenerateSceneFn = () => Promise<{
  sceneImageUrl: string;
  sceneAssetId?: string | null;
}>;

export type NarrativeAlignmentPublishGateInput = {
  anchors: MirrorSemanticAnchorsV1;
  interpretation?: Pick<
    MirrorInterpretationV1,
    'title' | 'visualNarrative' | 'interpretationSummary' | 'imageIntent'
  > | null;
  landing: Pick<PublicMirrorLanding, 'publicTitle' | 'publicSummary'>;
  sceneImageUrl: string;
  detectClaims: DetectImageClaimsFn;
  regenerateScene?: RegenerateSceneFn;
  generationId?: string | null;
  interpretationHash?: string | null;
  publicLandingHash?: string | null;
  sceneAssetId?: string | null;
  /** Default false = fail-safe block when vision unavailable (D2 production). */
  allowDegradedPublishWhenUnavailable?: boolean;
};

export type NarrativeAlignmentPublishGateSuccess = {
  ok: true;
  sceneImageUrl: string;
  sceneAssetId?: string | null;
  alignment: NarrativeAlignmentResult;
  observability: NarrativeAlignmentLineage;
  landingSnapshot: { publicTitle: string; publicSummary: string };
  degradedVerification?: boolean;
};

export type NarrativeAlignmentPublishGateFailure = {
  ok: false;
  code:
    | typeof NARRATIVE_ALIGNMENT_PUBLISH_ERROR
    | typeof NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR;
  message: string;
  alignment: NarrativeAlignmentResult;
  observability: NarrativeAlignmentLineage;
  landingSnapshot: { publicTitle: string; publicSummary: string };
  attempts: 1 | 2;
};

export type NarrativeAlignmentPublishGateResult =
  | NarrativeAlignmentPublishGateSuccess
  | NarrativeAlignmentPublishGateFailure;

function sceneAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/mirror-scene-assets\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

const UNAVAILABLE_USER_MESSAGE =
  'Görsel doğrulama şu an kullanılamıyor. Yayınlama güvenli şekilde durduruldu.';
const FAIL_USER_MESSAGE =
  'Görsel ile kart metni aynı hikâyeyi anlatmıyor. Yayınlama durduruldu.';
const FAIL_NO_RETRY_MESSAGE =
  'Görsel ile kart metni aynı hikâyeyi anlatmıyor. Sahne yeniden üretilemedi.';

async function alignOnce(
  input: NarrativeAlignmentPublishGateInput,
  sceneImageUrl: string,
  sceneAssetId: string | null | undefined,
  retryAttempt: 0 | 1
) {
  return runNarrativeAlignment({
    anchors: input.anchors,
    interpretation: input.interpretation,
    landing: input.landing,
    sceneImageUrl,
    detectClaims: input.detectClaims,
    generationId: input.generationId,
    interpretationHash: input.interpretationHash,
    publicLandingHash: input.publicLandingHash,
    sceneAssetId: sceneAssetId ?? sceneAssetIdFromUrl(sceneImageUrl),
    retryAttempt,
  });
}

function unavailableFailure(
  alignment: NarrativeAlignmentResult,
  observability: NarrativeAlignmentLineage,
  landingSnapshot: { publicTitle: string; publicSummary: string },
  attempts: 1 | 2
): NarrativeAlignmentPublishGateFailure {
  return {
    ok: false,
    code: NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR,
    message: UNAVAILABLE_USER_MESSAGE,
    alignment: {
      ...alignment,
      status: 'FAIL',
      verificationState: 'verification_unavailable',
    },
    observability: {
      ...observability,
      alignmentStatus: 'UNAVAILABLE',
      verificationState: 'verification_unavailable',
    },
    landingSnapshot,
    attempts,
  };
}

function degradedSuccess(
  sceneImageUrl: string,
  sceneAssetId: string | null | undefined,
  alignment: NarrativeAlignmentResult,
  observability: NarrativeAlignmentLineage,
  landingSnapshot: { publicTitle: string; publicSummary: string }
): NarrativeAlignmentPublishGateSuccess {
  return {
    ok: true,
    sceneImageUrl,
    sceneAssetId,
    alignment: {
      ...alignment,
      status: 'FAIL',
      verificationState: 'verification_unavailable',
    },
    observability: {
      ...observability,
      alignmentStatus: 'UNAVAILABLE',
      verificationState: 'verification_unavailable',
    },
    landingSnapshot,
    degradedVerification: true,
  };
}

export async function runNarrativeAlignmentPublishGate(
  input: NarrativeAlignmentPublishGateInput
): Promise<NarrativeAlignmentPublishGateResult> {
  const landingSnapshot = {
    publicTitle: input.landing.publicTitle,
    publicSummary: input.landing.publicSummary,
  };

  let first = await alignOnce(
    input,
    input.sceneImageUrl,
    input.sceneAssetId,
    0
  );

  // Short re-detect when vision unavailable before declaring policy outcome.
  if (first.detectionSource === 'unavailable') {
    first = await alignOnce(input, input.sceneImageUrl, input.sceneAssetId, 0);
  }

  if (first.detectionSource === 'unavailable') {
    if (input.allowDegradedPublishWhenUnavailable) {
      return degradedSuccess(
        input.sceneImageUrl,
        input.sceneAssetId ?? sceneAssetIdFromUrl(input.sceneImageUrl),
        first.result,
        first.observability,
        landingSnapshot
      );
    }
    return unavailableFailure(first.result, first.observability, landingSnapshot, 1);
  }

  if (first.result.verificationState === 'verified_pass') {
    return {
      ok: true,
      sceneImageUrl: input.sceneImageUrl,
      sceneAssetId: input.sceneAssetId ?? sceneAssetIdFromUrl(input.sceneImageUrl),
      alignment: first.result,
      observability: first.observability,
      landingSnapshot,
    };
  }

  if (!input.regenerateScene) {
    return {
      ok: false,
      code: NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
      message: FAIL_NO_RETRY_MESSAGE,
      alignment: first.result,
      observability: first.observability,
      landingSnapshot,
      attempts: 1,
    };
  }

  const regenerated = await input.regenerateScene();
  const second = await alignOnce(
    input,
    regenerated.sceneImageUrl,
    regenerated.sceneAssetId,
    1
  );

  if (
    second.landingSnapshot.publicTitle !== landingSnapshot.publicTitle ||
    second.landingSnapshot.publicSummary !== landingSnapshot.publicSummary
  ) {
    return {
      ok: false,
      code: NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
      message: 'Landing metni hizalama sırasında değiştirilemez.',
      alignment: second.result,
      observability: second.observability,
      landingSnapshot,
      attempts: 2,
    };
  }

  if (second.detectionSource === 'unavailable') {
    if (input.allowDegradedPublishWhenUnavailable) {
      return degradedSuccess(
        regenerated.sceneImageUrl,
        regenerated.sceneAssetId ?? sceneAssetIdFromUrl(regenerated.sceneImageUrl),
        second.result,
        second.observability,
        landingSnapshot
      );
    }
    return unavailableFailure(second.result, second.observability, landingSnapshot, 2);
  }

  if (second.result.verificationState === 'verified_pass') {
    return {
      ok: true,
      sceneImageUrl: regenerated.sceneImageUrl,
      sceneAssetId: regenerated.sceneAssetId ?? sceneAssetIdFromUrl(regenerated.sceneImageUrl),
      alignment: second.result,
      observability: second.observability,
      landingSnapshot,
    };
  }

  return {
    ok: false,
    code: NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
    message: FAIL_USER_MESSAGE,
    alignment: second.result,
    observability: second.observability,
    landingSnapshot,
    attempts: 2,
  };
}
