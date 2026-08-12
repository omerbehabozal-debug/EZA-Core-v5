/**
 * Stage 4C — auto-register Mirror to network on creation (share URL guarantee).
 * Phase 0 — D2 Interpretation is canonical publish meaning when present.
 */

import { apiClient } from '@/lib/apiClient';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import type { MirrorCuriosityBundle, MirrorSeed } from '@/lib/eza/mirror-network/types';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorShareIdentity } from '@/lib/eza/mirror-share/types';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';
import { isMirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import {
  interpretationHash,
  mappedPromptHash,
  publishBundleHash,
  type MirrorPublishLineageMeta,
  type MirrorSemanticSource,
} from '@/lib/eza/mirror/mirrorLineageHash';
import {
  assertPublicLandingPublishable,
  buildSafePublicMirrorLandingFallback,
  hashPublicMirrorLanding,
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import {
  MirrorApiContractError,
  validatePublishResponse,
} from '@/lib/eza/mirror/mirrorApiContracts';
import {
  apiImageClaimDetector,
  NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
  runNarrativeAlignmentPublishGate,
  type DetectImageClaimsFn,
  type NarrativeAlignmentLineage,
  type RegenerateSceneFn,
} from '@/lib/eza/mirror/narrativeAlignment';
import { resolveJourneyPublishContract } from '@/lib/eza/mirror/journey';
import { attachEzaSnapshotsToSelectedSteps } from '@/lib/eza/mirror/journey/attachEzaSnapshotsToSelectedSteps';
import { isMirrorJourneyV1ClientEnabled } from '@/lib/eza/mirror/journey/journeyClientFlag';
import {
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import { completeJourneyGenerationLineageSeal } from '@/lib/eza/mirror/journey/completeJourneyGenerationLineageSeal';

export type PublishMirrorToNetworkInput = {
  card: DailyMirrorCardModel;
  conversationId?: string;
  /** Authenticated owner — required for journey Review 8 contract when flag on. */
  ownerUserId?: string | null;
  /** Phase 2: when journey flag on + Review 8 confirmed, publish identity is this slug. */
  journeyId?: string;
  /** Child journey lineage — maps to network parentSlug. */
  parentSlug?: string;
  windowIndex?: number;
  windowStart?: number;
  windowEnd?: number;
  selectedSteps?: Array<{
    stepIndex: number;
    sourceOrder: number;
    sourceUserMessageId: string;
    sourceAssistantMessageId: string;
    publicQuestion: string;
    publicAnswer: string;
    /** Phase 4.2 — interaction EZA for this exact Q/A (optional). */
    ezaSnapshot?: {
      assistantScore?: number | null;
      userScore?: number | null;
      behavioral?: unknown;
    } | null;
    /** @deprecated wire aliases — prefer stepIndex / source* ids */
    index?: number;
    userMessageId?: string;
    assistantMessageId?: string;
  }>;
  sceneImageUrl?: string | null;
  generationId?: string;
  generationAcceptedAt?: number;
  replacesGenerationId?: string;
  forceRepublish?: boolean;
  generationAction?: 'first' | 'update' | 'new_scene';
  /**
   * Narrative Alignment Phase 1.
   * Opt-in: when set (and not skip), gate runs before POST for D2 landings with anchors.
   */
  narrativeAlignment?: {
    detectClaims?: DetectImageClaimsFn;
    regenerateScene?: RegenerateSceneFn;
    skip?: boolean;
    /** Default false — D2 fail-safe blocks when vision unavailable. */
    allowDegradedPublishWhenUnavailable?: boolean;
  };
};

export type PublishMirrorToNetworkSuccess = {
  ok: true;
  slug: string;
  shareUrl: string;
  publicPayload: MirrorNetworkPublicApiResponse;
  semanticSource: MirrorSemanticSource;
  lineage?: MirrorPublishLineageMeta;
  narrativeAlignment?: NarrativeAlignmentLineage;
};

export type PublishMirrorToNetworkFailure = {
  ok: false;
  code: string;
  message: string;
  narrativeAlignment?: NarrativeAlignmentLineage;
};

export type PublishMirrorToNetworkResult =
  | PublishMirrorToNetworkSuccess
  | PublishMirrorToNetworkFailure;

function sceneAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/mirror-scene-assets\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function isMirrorJourneyV1NeedsLineage(
  input: PublishMirrorToNetworkInput
): boolean {
  return (
    isMirrorJourneyV1ClientEnabled() &&
    Boolean(input.conversationId?.trim()) &&
    Boolean(input.ownerUserId?.trim())
  );
}

/**
 * Resolve publish curiosity: D2 public landing wins.
 * Without D2, never interpolate V3 evidence labels into public copy — safe fallback only.
 */
export function resolvePublishCuriosityBundle(card: DailyMirrorCardModel): {
  bundle: MirrorCuriosityBundle;
  semanticSource: MirrorSemanticSource;
} {
  if (isMirrorInterpretationV1(card.mirrorFinalInterpretation)) {
    const semanticSource =
      card.mirrorSemanticSource === 'heuristic_fallback'
        ? 'heuristic_fallback'
        : 'd2_interpretation';
    const built = buildCuriosityFromInterpretation(card.mirrorFinalInterpretation, {
      locale: card.mirrorV3Payload?.curiosityBundle?.seed?.locale,
      semanticSource,
    });
    assertPublicLandingPublishable(built.publicLanding);
    return { bundle: built.bundle, semanticSource };
  }

  const payload = card.mirrorV3Payload;
  if (!payload) {
    throw new Error('mirror_v3_payload_required');
  }

  const existing = payload.curiosityBundle;
  if (
    (existing?.semanticSource === 'd2_interpretation' ||
      existing?.semanticSource === 'heuristic_fallback') &&
    existing.publicLanding?.contractVersion === MIRROR_PUBLIC_LANDING_CONTRACT_VERSION &&
    (existing.publicLanding.semanticSource === 'd2_interpretation' ||
      existing.publicLanding.semanticSource === 'heuristic_fallback')
  ) {
    assertPublicLandingPublishable(existing.publicLanding);
    return {
      bundle: existing,
      semanticSource:
        existing.semanticSource === 'heuristic_fallback'
          ? 'heuristic_fallback'
          : 'd2_interpretation',
    };
  }

  // Fail-closed: no D2 → safe neutral public landing (never seed.subtopics / evidence labels).
  const title = card.headline || payload.mirrorTitle || undefined;
  const publicLanding = buildSafePublicMirrorLandingFallback({ title });
  const seed: MirrorSeed = {
    primaryTopic: publicLanding.publicTitle,
    topicCategory: 'general_curiosity',
    mood: 'discovery',
    subtopics: [],
    curiosityHooks: [publicLanding.continuationContext],
    seedQuestions: ['Bu konuyu kendi yolculuğun için nasıl keşfetmek istersin?'],
    locale: 'tr',
  };
  const bundle: MirrorCuriosityBundle = {
    seed,
    cardTitle: publicLanding.publicTitle,
    coreCuriosity: publicLanding.continuationContext,
    curiosityContext: { text: publicLanding.publicSummary },
    hooks: [publicLanding.continuationContext],
    landingContext: publicLanding.publicSummary,
    seedQuestions: seed.seedQuestions,
    discoverySignals: [publicLanding.publicTitle, 'discovery'],
    collectionTags: ['general-curiosity', 'discovery'],
    semanticSource: 'safe_fallback',
    publicLanding,
  };
  return { bundle, semanticSource: 'safe_fallback' };
}

function buildIntelligencePrivate(
  card: DailyMirrorCardModel,
  lineage: MirrorPublishLineageMeta
) {
  const payload = card.mirrorV3Payload;
  if (!payload) return undefined;

  const directorMeta = card.mirrorDirectorMetadata;
  // Frontend sends only allowlisted Director fields. Backend re-validates and is authority.
  const safeDirector =
    directorMeta && typeof directorMeta === 'object'
      ? {
          directorMode: directorMeta.directorMode,
          directorExecuted: directorMeta.directorExecuted,
          directorAffectedOutput: directorMeta.directorAffectedOutput,
          draftSource: directorMeta.draftSource,
          titleSource: directorMeta.titleSource,
          promptSource: directorMeta.promptSource,
          directorDecision: directorMeta.directorDecision,
          revisionCount: directorMeta.revisionCount,
          fallbackReason: directorMeta.fallbackReason,
          contentHash: directorMeta.contentHash,
          reasonCodes: directorMeta.directorReasonCodes,
          confidence: directorMeta.directorConfidence,
          latency: directorMeta.totalDirectorDurationMs,
          analysisSchemaVersion: directorMeta.analysisSchemaVersion,
          draftSchemaVersion: directorMeta.draftSchemaVersion,
          reviewSchemaVersion: directorMeta.reviewSchemaVersion,
          draftModel: directorMeta.draftModel,
          reviewModel: directorMeta.reviewModel,
        }
      : undefined;

  return {
    mirrorBody: payload.mirrorText,
    topicSummary: payload.topic,
    evidenceLabels: (payload.conversationEvidence ?? []).map((item) => item.label).filter(Boolean),
    behavioralSnapshot: undefined,
    intelligenceBrief: {
      ...(safeDirector ? { mirrorDirector: safeDirector } : {}),
      mirrorLineage: lineage,
    },
  };
}

async function buildPublishBody(
  input: PublishMirrorToNetworkInput,
  alignmentLineage?: NarrativeAlignmentLineage | null
) {
  const {
    card,
    conversationId,
    journeyId,
    parentSlug,
    selectedSteps,
    windowIndex,
    windowStart,
    windowEnd,
    sceneImageUrl,
    generationId,
    generationAcceptedAt,
    replacesGenerationId,
    forceRepublish,
  } = input;
  const payload = card.mirrorV3Payload;
  if (!payload) {
    throw new Error('mirror_v3_payload_required');
  }

  const { bundle: curiosityBundle, semanticSource } = resolvePublishCuriosityBundle(card);
  const publicLanding = curiosityBundle.publicLanding;
  if (!publicLanding) {
    throw new Error('public_landing_required');
  }
  assertPublicLandingPublishable(publicLanding);

  const interpHash = isMirrorInterpretationV1(card.mirrorFinalInterpretation)
    ? await interpretationHash(card.mirrorFinalInterpretation)
    : undefined;
  const mappedHash = card.visual?.prompt
    ? await mappedPromptHash(card.visual.prompt)
    : undefined;
  const publicLandingHash = await hashPublicMirrorLanding(publicLanding);
  const bundleHash = await publishBundleHash({
    cardTitle: curiosityBundle.cardTitle,
    publicTitle: publicLanding.publicTitle,
    publicSummary: publicLanding.publicSummary,
    continuationContext: publicLanding.continuationContext,
    semanticSource,
    contractVersion: publicLanding.contractVersion,
  });

  const lineage: MirrorPublishLineageMeta = {
    semanticSource,
    interpretationHash: interpHash,
    mappedPromptHash: mappedHash,
    publishBundleHash: bundleHash,
    publicLandingHash,
    contentHash: card.mirrorDirectorMetadata?.contentHash ?? null,
    generationId,
    generationAcceptedAt: generationAcceptedAt ?? (generationId ? Date.now() : undefined),
    replacesGenerationId,
    forceRepublish,
    conversationId: conversationId?.trim() || undefined,
    sceneAssetId: sceneAssetIdFromUrl(sceneImageUrl),
    contractVersion: publicLanding.contractVersion,
    ...(alignmentLineage
      ? {
          narrativeAlignment: {
            alignmentVersion: alignmentLineage.alignmentVersion,
            alignmentStatus: alignmentLineage.alignmentStatus,
            verificationState: alignmentLineage.verificationState,
            requiredClaimsHash: alignmentLineage.requiredClaimsHash,
            detectedClaimsHash: alignmentLineage.detectedClaimsHash,
            missingClaims: alignmentLineage.missingClaims,
            retryAttempt: alignmentLineage.retryAttempt,
            anchorsHash: alignmentLineage.anchorsHash,
            generationId: alignmentLineage.generationId,
            interpretationHash: alignmentLineage.interpretationHash,
            publicLandingHash: alignmentLineage.publicLandingHash,
            sceneAssetId: alignmentLineage.sceneAssetId,
          },
        }
      : {}),
  };

  const publishLineage = resolveMirrorPublishLineage({
    conversationId,
    curiosityLineage: curiosityBundle.seed?.lineage,
  });

  const cardTitle = publicLanding.publicTitle || card.headline || payload.mirrorTitle;

  // Journey V1: parent comes only from confirmed window draft (may be null).
  // Proof path: lineageProofToken is authoritative — do not also send archive parentSlug.
  // Legacy Discover without proof: may send resolved tree parentSlug.
  const explicitParentSlug = parentSlug?.trim() || undefined;
  const resolvedParentSlug = journeyId?.trim()
    ? explicitParentSlug
    : publishLineage.lineageProofToken
      ? explicitParentSlug
      : explicitParentSlug || publishLineage.parentSlug || undefined;

  const generationLineage = isPublishableJourneyGenerationLineage(
    card.mirrorJourneyGenerationLineage
  )
    ? (card.mirrorJourneyGenerationLineage as JourneyGenerationLineage)
    : null;

  if (alignmentLineage && generationLineage && lineage.narrativeAlignment) {
    lineage.narrativeAlignment = {
      ...lineage.narrativeAlignment,
      journeyId: generationLineage.journeyId,
      journeyVersion: generationLineage.journeyVersion,
      windowHash: generationLineage.windowHash,
      generationId: generationLineage.generationId,
      publicLandingHash: generationLineage.publicLandingHash,
      sceneAssetId:
        alignmentLineage.sceneAssetId ||
        generationLineage.sceneAssetId ||
        sceneAssetIdFromUrl(sceneImageUrl),
    };
  }

  const journeyLineageFields = generationLineage
    ? {
        journeyVersion: generationLineage.journeyVersion,
        sourceConversationId: generationLineage.sourceConversationId,
        windowHash: generationLineage.windowHash,
        scopedInputHash: generationLineage.scopedInputHash,
        selectedStepsHash: generationLineage.selectedStepsHash,
        interpretationHash: generationLineage.interpretationHash,
        anchorsHash: generationLineage.anchorsHash ?? undefined,
        publicLandingHash: generationLineage.publicLandingHash,
        mappedPromptHash: generationLineage.mappedPromptHash,
        generationId: generationLineage.generationId,
        sceneAssetId:
          generationLineage.sceneAssetId ||
          sceneAssetIdFromUrl(sceneImageUrl) ||
          undefined,
        journeyGenerationLineage: {
          contractVersion: generationLineage.contractVersion,
          journeyId: generationLineage.journeyId,
          journeyVersion: generationLineage.journeyVersion,
          sourceConversationId: generationLineage.sourceConversationId,
          parentJourneyId: generationLineage.parentJourneyId ?? null,
          windowIndex: generationLineage.windowIndex,
          windowStart: generationLineage.windowStart,
          windowEnd: generationLineage.windowEnd,
          windowHash: generationLineage.windowHash,
          scopedInputHash: generationLineage.scopedInputHash,
          selectedStepsHash: generationLineage.selectedStepsHash,
          interpretationHash: generationLineage.interpretationHash,
          anchorsHash: generationLineage.anchorsHash ?? null,
          publicLandingHash: generationLineage.publicLandingHash,
          mappedPromptHash: generationLineage.mappedPromptHash,
          generationId: generationLineage.generationId,
          sceneAssetId:
            generationLineage.sceneAssetId ||
            sceneAssetIdFromUrl(sceneImageUrl) ||
            null,
        },
      }
    : {
        generationId,
        interpretationHash: interpHash,
        mappedPromptHash: mappedHash,
        publicLandingHash,
        sceneAssetId: sceneAssetIdFromUrl(sceneImageUrl) || undefined,
      };

  return {
    body: {
      cardTitle,
      cardDate: card.date,
      conversationId: conversationId?.trim() || undefined,
      journeyId: journeyId?.trim() || undefined,
      windowIndex: typeof windowIndex === 'number' ? windowIndex : undefined,
      windowStart: typeof windowStart === 'number' ? windowStart : undefined,
      windowEnd: typeof windowEnd === 'number' ? windowEnd : undefined,
      selectedSteps: selectedSteps?.length
        ? attachEzaSnapshotsToSelectedSteps(
            selectedSteps.map((s) => ({
              stepIndex: s.stepIndex ?? s.index!,
              sourceOrder: s.sourceOrder,
              sourceUserMessageId: s.sourceUserMessageId ?? s.userMessageId!,
              sourceAssistantMessageId:
                s.sourceAssistantMessageId ?? s.assistantMessageId!,
              publicQuestion: s.publicQuestion,
              publicAnswer: s.publicAnswer,
              ezaSnapshot: s.ezaSnapshot ?? null,
            })),
            { conversationId }
          ).map((s) => ({
            stepIndex: s.stepIndex,
            sourceOrder: s.sourceOrder,
            sourceUserMessageId: s.sourceUserMessageId,
            sourceAssistantMessageId: s.sourceAssistantMessageId,
            publicQuestion: s.publicQuestion,
            publicAnswer: s.publicAnswer,
            ...(s.ezaSnapshot ? { ezaSnapshot: s.ezaSnapshot } : {}),
          }))
        : undefined,
      sceneImageUrl: sceneImageUrl?.trim() || undefined,
      curiosityBundle,
      intelligencePrivate: buildIntelligencePrivate(card, lineage),
      safetyLevel: payload.safetyLevel ?? 'normal',
      lineageProofToken: publishLineage.lineageProofToken,
      guestToken: publishLineage.guestToken,
      // Omit key when absent — proof path must not send archive parentSlug.
      ...(resolvedParentSlug ? { parentSlug: resolvedParentSlug } : {}),
      ...journeyLineageFields,
    },
    semanticSource,
    lineage,
  };
}

function parseApiError(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') {
    return { code: 'publish_failed', message: 'Paylaşım bağlantısı hazırlanamadı.' };
  }
  const row = error as Record<string, unknown>;
  const nested = row.error as Record<string, unknown> | undefined;
  const detail = row.detail as Record<string, unknown> | string | undefined;

  if (detail && typeof detail === 'object') {
    return {
      code: String(detail.code ?? 'publish_failed'),
      message: String(detail.message ?? 'Paylaşım bağlantısı hazırlanamadı.'),
    };
  }

  return {
    code: String(nested?.error_code ?? row.error_code ?? 'publish_failed'),
    message: String(
      nested?.error_message ??
        nested?.message ??
        row.error_message ??
        row.message ??
        'Paylaşım bağlantısı hazırlanamadı.'
    ),
  };
}

export async function publishMirrorToNetwork(
  input: PublishMirrorToNetworkInput
): Promise<PublishMirrorToNetworkResult> {
  try {
    // Seal landing/scene onto lineage before publish when prepare sealed a partial.
    let card = input.card;
    if (card.mirrorJourneyGenerationLineage) {
      card = await completeJourneyGenerationLineageSeal({
        card,
        sceneImageUrl: input.sceneImageUrl,
        generationId: input.generationId,
        ownerUserId: input.ownerUserId,
      });
    }

    const journeyContract = resolveJourneyPublishContract({
      ownerUserId: input.ownerUserId,
      conversationId: input.conversationId,
      generationLineage: card.mirrorJourneyGenerationLineage,
      journeyId: input.journeyId,
      journeyVersion: isPublishableJourneyGenerationLineage(
        card.mirrorJourneyGenerationLineage
      )
        ? card.mirrorJourneyGenerationLineage.journeyVersion
        : undefined,
    });
    if (!('legacy' in journeyContract) && !journeyContract.ok) {
      return {
        ok: false,
        code: journeyContract.code,
        message: journeyContract.message,
      };
    }
    if (journeyContract.ok && !('legacy' in journeyContract)) {
      const fromLineage = journeyContract.source === 'generation_lineage';
      // After a scene is generated, require sealed lineage — never fall back to live draft.
      if (
        !fromLineage &&
        Boolean(input.sceneImageUrl?.trim()) &&
        isMirrorJourneyV1NeedsLineage(input)
      ) {
        return {
          ok: false,
          code: 'lineage_required',
          message:
            'Generated Mirror must publish from its sealed generation lineage. Regenerate after changing the selected 8.',
        };
      }
      input = {
        ...input,
        card,
        journeyId: fromLineage
          ? journeyContract.journeyId
          : input.journeyId?.trim() || journeyContract.journeyId,
        selectedSteps: fromLineage
          ? journeyContract.selectedSteps.map((s) => ({
              stepIndex: s.index,
              sourceOrder: s.sourceOrder,
              sourceUserMessageId: s.userMessageId,
              sourceAssistantMessageId: s.assistantMessageId,
              publicQuestion: s.publicQuestion,
              publicAnswer: s.publicAnswer,
            }))
          : input.selectedSteps?.length
            ? input.selectedSteps
            : journeyContract.selectedSteps.map((s) => ({
                stepIndex: s.index,
                sourceOrder: s.sourceOrder,
                sourceUserMessageId: s.userMessageId,
                sourceAssistantMessageId: s.assistantMessageId,
                publicQuestion: s.publicQuestion,
                publicAnswer: s.publicAnswer,
              })),
        windowIndex: fromLineage
          ? journeyContract.windowIndex
          : typeof input.windowIndex === 'number'
            ? input.windowIndex
            : journeyContract.windowIndex,
        windowStart: fromLineage
          ? journeyContract.windowStart
          : typeof input.windowStart === 'number'
            ? input.windowStart
            : journeyContract.windowStart,
        windowEnd: fromLineage
          ? journeyContract.windowEnd
          : typeof input.windowEnd === 'number'
            ? input.windowEnd
            : journeyContract.windowEnd,
        parentSlug: fromLineage
          ? journeyContract.parentJourneyId?.trim() || undefined
          : input.parentSlug?.trim() ||
            journeyContract.parentJourneyId?.trim() ||
            undefined,
        generationId: fromLineage
          ? journeyContract.generationLineage!.generationId
          : input.generationId,
      };
    } else {
      input = { ...input, card };
    }

    let sceneImageUrl = input.sceneImageUrl;
    let alignmentObs: NarrativeAlignmentLineage | undefined;

    const alignmentOpts = input.narrativeAlignment;
    const shouldAlign =
      Boolean(alignmentOpts) &&
      !alignmentOpts?.skip &&
      Boolean(sceneImageUrl?.trim()) &&
      isMirrorInterpretationV1(input.card.mirrorFinalInterpretation);

    if (shouldAlign && sceneImageUrl) {
      const { bundle } = resolvePublishCuriosityBundle(input.card);
      const landing = bundle.publicLanding;
      const anchors = landing?.semanticAnchors;
      if (landing && anchors) {
        const publicLandingHash = await hashPublicMirrorLanding(landing);
        const interpHash = await interpretationHash(input.card.mirrorFinalInterpretation!);
        const gate = await runNarrativeAlignmentPublishGate({
          anchors,
          interpretation: input.card.mirrorFinalInterpretation,
          landing,
          sceneImageUrl,
          detectClaims: alignmentOpts?.detectClaims ?? apiImageClaimDetector,
          regenerateScene: alignmentOpts?.regenerateScene,
          generationId: input.generationId,
          interpretationHash: interpHash,
          publicLandingHash,
          sceneAssetId: sceneAssetIdFromUrl(sceneImageUrl),
          allowDegradedPublishWhenUnavailable:
            alignmentOpts?.allowDegradedPublishWhenUnavailable === true,
        });
        alignmentObs = gate.observability;
        if (!gate.ok) {
          return {
            ok: false,
            code: gate.code || NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
            message: gate.message,
            narrativeAlignment: alignmentObs,
          };
        }
        // Image may change on retry; landing never mutates.
        sceneImageUrl = gate.sceneImageUrl;
        if (gate.sceneAssetId) {
          alignmentObs = {
            ...alignmentObs,
            sceneAssetId: gate.sceneAssetId,
          };
        }
      }
    }

    const { body, semanticSource, lineage } = await buildPublishBody(
      {
        ...input,
        sceneImageUrl,
      },
      alignmentObs
    );
    const response = await apiClient.post<MirrorNetworkPublicApiResponse>(
      '/api/mirror-network/publish',
      { body, auth: true, timeoutMs: 30_000 }
    );

    if (!response.ok) {
      const parsed = parseApiError(response.error ?? response);
      return { ok: false, ...parsed, narrativeAlignment: alignmentObs };
    }

    const payload = validatePublishResponse(response.data ?? response);

    return {
      ok: true,
      slug: payload.slug,
      shareUrl: payload.shareUrl,
      publicPayload: payload as unknown as MirrorNetworkPublicApiResponse,
      semanticSource,
      lineage,
      narrativeAlignment: alignmentObs,
    };
  } catch (err) {
    if (err instanceof MirrorApiContractError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
      };
    }
    return {
      ok: false,
      code: 'publish_failed',
      message: 'Paylaşım bağlantısı hazırlanamadı.',
    };
  }
}

export function applyShareUrlToCard(
  card: DailyMirrorCardModel,
  shareUrl: string,
  slug?: string,
  landing?: { publicTitle?: string | null; publicSummary?: string | null }
): DailyMirrorCardModel {
  const existing = card.mirrorShare;
  const nextTitle = landing?.publicTitle?.trim() || existing?.publicTitle?.trim() || null;
  const nextSummary =
    landing?.publicSummary?.trim() || existing?.publicSummary?.trim() || null;
  const mirrorShare: MirrorShareIdentity = {
    blueprint: existing?.blueprint ?? {
      shareVoice: 'quiet_editorial_minimal',
      tone: 'editorial',
      invitationStyle: 'own_journey',
    },
    shareVoice: existing?.shareVoice ?? {
      text: '',
      preset: 'quiet_editorial_minimal',
    },
    shareUrl,
    networkSlug: slug ?? existing?.networkSlug ?? null,
    publicTitle: nextTitle,
    publicSummary: nextSummary,
  };

  return { ...card, mirrorShare };
}

export function mergeCachedShareLinkIntoCard(
  card: DailyMirrorCardModel,
  cached:
    | {
        shareUrl: string;
        slug: string;
        publicTitle?: string | null;
        publicSummary?: string | null;
      }
    | null
    | undefined
): DailyMirrorCardModel {
  if (!cached?.shareUrl) return card;
  return applyShareUrlToCard(card, cached.shareUrl, cached.slug, {
    publicTitle: cached.publicTitle,
    publicSummary: cached.publicSummary,
  });
}
