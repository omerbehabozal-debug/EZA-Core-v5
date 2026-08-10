/**
 * Phase 3.8.1 — artifact-scoped Journey share payload.
 *
 * Share identity/content is frozen from MirrorJourneyArtifact + journey share
 * identity. Never from generatedDailyCard / latest Journey / live publicPreview.
 */

import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { resolveJourneyArtifactShareIdentity } from '@/lib/eza/mirror/journey/resolveJourneyArtifactShareIdentity';
import type { MirrorPublicPreviewContent } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';
import { buildShareVoice } from '@/lib/eza/mirror-share/buildShareVoice';
import { buildInstagramShareCaptionFromBlueprint } from '@/lib/eza/mirror-share/builders/instagram';
import type { MirrorCuriosityPipeline } from '@/lib/eza/mirror-network/types';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type MirrorJourneySharePayload = {
  journeyId: string;
  journeyVersion: number;
  generationId: string;
  sourceConversationId: string;

  sceneImageUrl: string | null;
  sceneAssetId: string | null;

  publicTitle: string;
  publicSummary: string;
  continuationContext: string | null;

  slug: string | null;
  shareUrl: string | null;

  authorUserId: string | null;
  authorDisplayName: string | null;
  parentAuthorDisplayName: string | null;
  parentSlug: string | null;

  /** ISO timestamp when this share session was frozen. */
  frozenAt: string;
};

export function resolveMirrorJourneySharePayload(input: {
  artifact: MirrorJourneyArtifact;
  ownerUserId?: string | null;
  /** Only for identity resolution — never conversation-latest fallback. */
  conversationId?: string | null;
}): MirrorJourneySharePayload {
  const { artifact } = input;
  const identity = resolveJourneyArtifactShareIdentity({
    ownerUserId: input.ownerUserId,
    journeyId: artifact.journeyId,
    journeyVersion: artifact.journeyVersion,
    conversationId: input.conversationId,
    allowConversationLegacyFallback: false,
  });

  const title =
    artifact.publicTitle?.trim() ||
    identity?.publicTitle?.trim() ||
    'Yansı';
  const summary =
    artifact.publicSummary?.trim() ||
    identity?.publicSummary?.trim() ||
    '';

  return {
    journeyId: artifact.journeyId,
    journeyVersion: artifact.journeyVersion,
    generationId: artifact.generationId,
    sourceConversationId: artifact.sourceConversationId,
    sceneImageUrl:
      artifact.sceneImageUrl?.trim() ||
      identity?.sceneImageUrl?.trim() ||
      null,
    sceneAssetId: artifact.sceneAssetId?.trim() || null,
    publicTitle: title,
    publicSummary: summary,
    continuationContext: artifact.continuationContext?.trim() || null,
    slug: identity?.slug?.trim() || artifact.publish.slug?.trim() || null,
    shareUrl:
      identity?.shareUrl?.trim() || artifact.publish.shareUrl?.trim() || null,
    authorUserId: artifact.authorUserId?.trim() || null,
    authorDisplayName: artifact.authorDisplayName?.trim() || null,
    parentAuthorDisplayName: artifact.parentAuthorDisplayName?.trim() || null,
    parentSlug: artifact.parentSlug?.trim() || null,
    frozenAt: new Date().toISOString(),
  };
}

/** Merge publish identity into an already-frozen share session (same journey only). */
export function withJourneySharePublishIdentity(
  payload: MirrorJourneySharePayload,
  input: { slug: string; shareUrl: string; journeyId: string; journeyVersion: number }
): MirrorJourneySharePayload {
  if (
    payload.journeyId !== input.journeyId.trim().toLowerCase() ||
    payload.journeyVersion !== input.journeyVersion
  ) {
    return payload;
  }
  return {
    ...payload,
    slug: input.slug.trim(),
    shareUrl: input.shareUrl.trim(),
  };
}

export function publicPreviewFromJourneySharePayload(
  payload: MirrorJourneySharePayload
): MirrorPublicPreviewContent {
  return {
    title: payload.publicTitle,
    summary: payload.publicSummary,
    sceneImageUrl: payload.sceneImageUrl,
  };
}

function journeySharePipeline(payload: MirrorJourneySharePayload): MirrorCuriosityPipeline {
  const topic = 'general_curiosity' as StoryTopicId;
  return {
    seed: {
      primaryTopic: payload.publicTitle,
      topicCategory: topic,
      mood: 'discovery',
      subtopics: [],
      curiosityHooks: payload.continuationContext
        ? [payload.continuationContext]
        : [],
      seedQuestions: [],
      locale: 'tr',
    },
    cardTitle: payload.publicTitle,
    coreCuriosity: payload.continuationContext || payload.publicSummary,
    curiosityContext: { text: payload.publicSummary },
    hooks: payload.continuationContext ? [payload.continuationContext] : [],
    landingContext: payload.publicSummary,
    seedQuestions: [],
    discoverySignals: [payload.publicTitle],
    collectionTags: ['general-curiosity'],
    semanticSource: 'safe_fallback',
  };
}

/** Caption from frozen artifact fields only — no live card / evidence blob. */
export function resolveJourneyShareCaption(
  payload: MirrorJourneySharePayload
): string {
  const pipeline = journeySharePipeline(payload);
  const blob = `${payload.publicTitle} ${payload.publicSummary}`.toLowerCase();
  const shareVoice = buildShareVoice(pipeline.seed, blob);
  const blueprint = buildShareBlueprint(pipeline, blob);
  return buildInstagramShareCaptionFromBlueprint(
    blueprint,
    shareVoice.text,
    payload.shareUrl
  );
}

/**
 * Minimal DailyMirrorCardModel for export/share APIs that still accept a card.
 * Identity fields are exclusively from the frozen Journey payload.
 */
export function buildShareCardFromJourneyPayload(
  payload: MirrorJourneySharePayload
): DailyMirrorCardModel {
  const pipeline = journeySharePipeline(payload);
  const blob = `${payload.publicTitle} ${payload.publicSummary}`.toLowerCase();
  const shareVoice = buildShareVoice(pipeline.seed, blob);
  const blueprint = buildShareBlueprint(pipeline, blob);
  return {
    date: payload.frozenAt.slice(0, 10),
    dayLabel: '',
    headline: payload.publicTitle,
    characterName: '',
    personaFamilyId: 'balanced_calm',
    shortInsight: payload.publicSummary,
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: '',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    dailyThemeTitle: payload.publicTitle,
    mirrorShare: {
      blueprint,
      shareVoice,
      shareUrl: payload.shareUrl,
      networkSlug: payload.slug,
      publicTitle: payload.publicTitle,
      publicSummary: payload.publicSummary,
    },
    mirrorJourneyGenerationLineage: {
      journeyId: payload.journeyId,
      journeyVersion: payload.journeyVersion,
      generationId: payload.generationId,
      sourceConversationId: payload.sourceConversationId,
      sceneAssetId: payload.sceneAssetId,
    },
  };
}

export function isSameJourneyShareSession(
  payload: MirrorJourneySharePayload | null | undefined,
  journeyId: string,
  journeyVersion: number
): boolean {
  if (!payload) return false;
  return (
    payload.journeyId === journeyId.trim().toLowerCase() &&
    payload.journeyVersion === journeyVersion
  );
}
