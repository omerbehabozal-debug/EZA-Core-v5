/**
 * Stage 04C — map sealed V2 public DTO → PublicFrozenJourneyArtifact for
 * MirrorFrozenReplay / YansiDesktopExperience. Does not run V1 6–8 parser.
 */

import {
  businessMediaUrl,
  type PublicBusinessBlock,
  type PublicBusinessMedia,
} from '@/lib/eza/mirror/journey/businessMedia';
import type {
  YansiV2PublicPublication,
  YansiV2PublicTurnMedia,
} from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import type {
  PublicFrozenJourneyArtifact,
  PublicFrozenJourneyStep,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';

function mediaToBlock(item: YansiV2PublicTurnMedia): PublicBusinessBlock | null {
  if (item.type === 'image' && item.contentPath) {
    return {
      type: 'image',
      assetId: item.assetId,
      title: item.title,
      contentPath: item.contentPath,
    };
  }
  if (item.type === 'video' && item.href) {
    return {
      type: 'video',
      assetId: item.assetId,
      title: item.title,
      href: item.href,
    };
  }
  return null;
}

function authorUserIdFor(publication: YansiV2PublicPublication): string {
  if (publication.businessPublisher?.businessId) {
    return publication.businessPublisher.businessId;
  }
  // Stable opaque placeholder — never invent private user ids from client payload.
  return `v2:${publication.slug}`;
}

export function mapV2PublicToFrozenArtifact(
  publication: YansiV2PublicPublication
): PublicFrozenJourneyArtifact | null {
  const slug = publication.slug.trim().toLowerCase();
  if (!slug) return null;
  const journeyVersion = publication.publicationVersion;
  if (!Number.isInteger(journeyVersion) || journeyVersion < 1) return null;

  if (publication.contentKind === 'image') {
    const media = 'media' in publication.public ? publication.public.media : null;
    if (!media?.contentPath) return null;
    const mediaTitle = media.title?.trim() || null;
    const title =
      publication.title?.trim() || mediaTitle || slug;
    const coverBlock: PublicBusinessBlock = {
      type: 'image',
      assetId: media.assetId,
      title: mediaTitle || title,
      contentPath: media.contentPath,
    };
    const businessMedia: PublicBusinessMedia = {
      cover: coverBlock,
      steps: [],
    };
    return {
      slug,
      journeyId: slug,
      journeyVersion,
      publicTitle: title,
      publicSummary: publication.summary?.trim() || null,
      sceneImageUrl: businessMediaUrl(media.contentPath),
      authorUserId: authorUserIdFor(publication),
      selectedCount: 0,
      steps: [],
      replayReady: true,
      sourceKind: 'v2_publication',
      contentKind: 'image',
      // Stage 04D: V2 public /answer supports image publications (sealed bundle).
      liveContinuationAvailable: true,
      ...(publication.businessPublisher
        ? { businessPublisher: publication.businessPublisher }
        : {}),
      businessMedia,
    };
  }

  const dto =
    'conversation' in publication.public ? publication.public : null;
  if (!dto) return null;
  const { conversation, cover } = dto;
  const steps: PublicFrozenJourneyStep[] = conversation.turns.map((turn) => ({
    stepIndex: turn.stepIndex,
    publicQuestion: turn.question,
    publicAnswer: turn.answer,
  }));
  if (steps.length < 1 || steps.length > 8) return null;

  const stepMedia: PublicBusinessBlock[][] = conversation.turns.map((turn) =>
    turn.media
      .map((item) => mediaToBlock(item))
      .filter((item): item is PublicBusinessBlock => item != null)
  );

  const coverBlock =
    cover != null
      ? ({
          type: 'image' as const,
          assetId: cover.assetId,
          title: cover.title,
          contentPath: cover.contentPath,
        } satisfies PublicBusinessBlock)
      : null;

  const hasMedia =
    coverBlock != null || stepMedia.some((blocks) => blocks.length > 0);
  const businessMedia: PublicBusinessMedia | undefined = hasMedia
    ? {
        cover:
          coverBlock &&
          (coverBlock.type === 'image' || coverBlock.type === 'video')
            ? coverBlock
            : null,
        steps: stepMedia,
      }
    : undefined;

  const sceneImageUrl = coverBlock?.contentPath
    ? businessMediaUrl(coverBlock.contentPath)
    : null;

  // Prefer durable card title; cover.title was sealed as (asset title || draft title).
  const publicTitle =
    publication.title?.trim() ||
    coverBlock?.title?.trim() ||
    null;
  const publicSummary =
    publication.summary?.trim() ||
    conversation.curiosityQuestion ||
    null;

  return {
    slug,
    journeyId: slug,
    journeyVersion,
    publicTitle,
    publicSummary,
    sceneImageUrl,
    authorUserId: authorUserIdFor(publication),
    selectedCount: steps.length,
    steps,
    replayReady: true,
    sourceKind: 'v2_publication',
    contentKind: publication.contentKind,
    // Stage 04D: in-place composer → POST .../v2/public/{slug}/answer (not V1 /sohbet).
    liveContinuationAvailable: true,
    ...(publication.businessPublisher
      ? { businessPublisher: publication.businessPublisher }
      : {}),
    ...(businessMedia ? { businessMedia } : {}),
  };
}
