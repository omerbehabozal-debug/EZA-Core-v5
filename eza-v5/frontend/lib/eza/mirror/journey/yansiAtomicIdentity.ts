/**
 * Atomic public Yansı identity — title, image, conversation, and artifact
 * must resolve from one sealed tuple. Never "latest" / sidebar / cache.
 */

import { canonicalMirrorSceneAssetIdFromUrl } from '@/lib/eza/mirror/sceneAssetIdentity';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

export type YansiAtomicIdentityTuple = {
  slug: string;
  yansiId: string;
  publicationId: string | null;
  artifactId: string | null;
  generationId: string | null;
  imageAssetId: string | null;
  imageUrl: string | null;
  sourceConversationId: string | null;
  publicTitle: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const next = (value || '').trim();
  return next ? next : null;
}

export function readYansiAtomicIdentity(
  artifact: PublicFrozenJourneyArtifact
): YansiAtomicIdentityTuple {
  const slug = artifact.slug.trim().toLowerCase();
  const yansiId = (artifact.journeyId || slug).trim().toLowerCase();
  const artifactId = trimOrNull(artifact.artifactId);
  const imageUrl = trimOrNull(artifact.sceneImageUrl);
  const sealedAsset = trimOrNull(artifact.sceneAssetId);
  const urlAsset = canonicalMirrorSceneAssetIdFromUrl(imageUrl);
  return {
    slug,
    yansiId,
    publicationId: artifactId,
    artifactId,
    generationId: trimOrNull(artifact.generationId),
    imageAssetId: sealedAsset || urlAsset || null,
    imageUrl,
    sourceConversationId: trimOrNull(artifact.sourceConversationId),
    publicTitle: trimOrNull(artifact.publicTitle),
  };
}

export function yansiIdentityMismatch(
  artifact: PublicFrozenJourneyArtifact,
  rendered: {
    expectedSlug?: string | null;
    renderedTitle?: string | null;
    renderedSceneUrl?: string | null;
  }
): string | null {
  const tuple = readYansiAtomicIdentity(artifact);
  const expectedSlug = trimOrNull(rendered.expectedSlug)?.toLowerCase();
  if (expectedSlug && expectedSlug !== tuple.slug) {
    return `slug_mismatch:${expectedSlug}!=${tuple.slug}`;
  }
  const renderedTitle = trimOrNull(rendered.renderedTitle);
  if (renderedTitle && tuple.publicTitle && renderedTitle !== tuple.publicTitle) {
    return `title_mismatch`;
  }
  const renderedScene = trimOrNull(rendered.renderedSceneUrl);
  if (renderedScene && tuple.imageUrl && renderedScene !== tuple.imageUrl) {
    return `scene_mismatch`;
  }
  if (tuple.imageUrl && tuple.imageAssetId) {
    const fromUrl = canonicalMirrorSceneAssetIdFromUrl(tuple.imageUrl);
    if (fromUrl && fromUrl !== tuple.imageAssetId) {
      return `scene_asset_mismatch:${fromUrl}!=${tuple.imageAssetId}`;
    }
  }
  return null;
}

export function assertYansiAtomicIdentity(
  artifact: PublicFrozenJourneyArtifact,
  rendered: {
    expectedSlug?: string | null;
    renderedTitle?: string | null;
    renderedSceneUrl?: string | null;
  } = {}
): YansiAtomicIdentityTuple {
  const tuple = readYansiAtomicIdentity(artifact);
  const mismatch = yansiIdentityMismatch(artifact, rendered);
  if (mismatch) {
    const error = new Error(`yansi_atomic_identity:${mismatch}`);
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }
  }
  return tuple;
}

export function logYansiAtomicIdentity(tuple: YansiAtomicIdentityTuple): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  console.info('[yansi-identity]', {
    slug: tuple.slug,
    yansiId: tuple.yansiId,
    publicationId: tuple.publicationId,
    artifactId: tuple.artifactId,
    generationId: tuple.generationId,
    imageAssetId: tuple.imageAssetId,
    imageUrl: tuple.imageUrl,
    sourceConversationId: tuple.sourceConversationId,
  });
}
