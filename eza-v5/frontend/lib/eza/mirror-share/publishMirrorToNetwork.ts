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

export type PublishMirrorToNetworkInput = {
  card: DailyMirrorCardModel;
  conversationId?: string;
  sceneImageUrl?: string | null;
  generationId?: string;
  generationAction?: 'first' | 'update' | 'new_scene';
};

export type PublishMirrorToNetworkSuccess = {
  ok: true;
  slug: string;
  shareUrl: string;
  publicPayload: MirrorNetworkPublicApiResponse;
  semanticSource: MirrorSemanticSource;
  lineage?: MirrorPublishLineageMeta;
};

export type PublishMirrorToNetworkFailure = {
  ok: false;
  code: string;
  message: string;
};

export type PublishMirrorToNetworkResult =
  | PublishMirrorToNetworkSuccess
  | PublishMirrorToNetworkFailure;

function sceneAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/mirror-scene-assets\/([^/?#]+)/i);
  return match?.[1] ?? null;
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
    const built = buildCuriosityFromInterpretation(card.mirrorFinalInterpretation);
    assertPublicLandingPublishable(built.publicLanding);
    return { bundle: built.bundle, semanticSource: 'd2_interpretation' };
  }

  const payload = card.mirrorV3Payload;
  if (!payload) {
    throw new Error('mirror_v3_payload_required');
  }

  const existing = payload.curiosityBundle;
  if (
    existing?.semanticSource === 'd2_interpretation' &&
    existing.publicLanding?.contractVersion === MIRROR_PUBLIC_LANDING_CONTRACT_VERSION &&
    existing.publicLanding.semanticSource === 'd2_interpretation'
  ) {
    assertPublicLandingPublishable(existing.publicLanding);
    return { bundle: existing, semanticSource: 'd2_interpretation' };
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

async function buildPublishBody(input: PublishMirrorToNetworkInput) {
  const { card, conversationId, sceneImageUrl, generationId } = input;
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
    conversationId: conversationId?.trim() || undefined,
    sceneAssetId: sceneAssetIdFromUrl(sceneImageUrl),
    contractVersion: publicLanding.contractVersion,
  };

  const publishLineage = resolveMirrorPublishLineage({
    conversationId,
    curiosityLineage: curiosityBundle.seed?.lineage,
  });

  const cardTitle = publicLanding.publicTitle || card.headline || payload.mirrorTitle;

  return {
    body: {
      cardTitle,
      cardDate: card.date,
      conversationId: conversationId?.trim() || undefined,
      sceneImageUrl: sceneImageUrl?.trim() || undefined,
      curiosityBundle,
      intelligencePrivate: buildIntelligencePrivate(card, lineage),
      safetyLevel: payload.safetyLevel ?? 'normal',
      lineageProofToken: publishLineage.lineageProofToken,
      guestToken: publishLineage.guestToken,
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
    const { body, semanticSource, lineage } = await buildPublishBody(input);
    const response = await apiClient.post<MirrorNetworkPublicApiResponse>(
      '/api/mirror-network/publish',
      { body, auth: true, timeoutMs: 30_000 }
    );

    if (!response.ok) {
      const parsed = parseApiError(response.error ?? response);
      return { ok: false, ...parsed };
    }

    const payload = (response.data ?? response) as MirrorNetworkPublicApiResponse;
    if (!payload.shareUrl || !payload.slug) {
      return {
        ok: false,
        code: 'publish_failed',
        message: 'Paylaşım bağlantısı hazırlanamadı.',
      };
    }

    return {
      ok: true,
      slug: payload.slug,
      shareUrl: payload.shareUrl,
      publicPayload: payload,
      semanticSource,
      lineage,
    };
  } catch {
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
  slug?: string
): DailyMirrorCardModel {
  const existing = card.mirrorShare;
  if (!existing) return card;

  const mirrorShare: MirrorShareIdentity = {
    ...existing,
    shareUrl,
    networkSlug: slug ?? existing.networkSlug ?? null,
  };

  return { ...card, mirrorShare };
}

export function mergeCachedShareLinkIntoCard(
  card: DailyMirrorCardModel,
  cached: { shareUrl: string; slug: string } | null | undefined
): DailyMirrorCardModel {
  if (!cached?.shareUrl) return card;
  return applyShareUrlToCard(card, cached.shareUrl, cached.slug);
}
