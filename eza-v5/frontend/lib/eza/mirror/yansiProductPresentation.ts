/**
 * Canonical Yansı product fields — shared authority for Ayna preview + Discover.
 * Exact artifact / sealed landing only. Never conversation-level fallbacks.
 */

export type YansiProductFields = {
  title: string;
  summary: string | null;
  sceneImageUrl: string | null;
};

type ArtifactLike = {
  publicTitle?: string | null;
  publicSummary?: string | null;
  sceneImageUrl?: string | null;
  sealedPublicLanding?: {
    publicTitle?: string | null;
    publicSummary?: string | null;
  } | null;
  status?: string | null;
};

type DiscoverLike = {
  title?: string | null;
  description?: string | null;
  publicTitle?: string | null;
  publicSummary?: string | null;
  sceneImageUrl?: string | null;
};

/** Resolve product fields from a journey artifact / preparation. */
export function resolveYansiProductFromArtifact(
  artifact: ArtifactLike
): YansiProductFields {
  const title =
    artifact.publicTitle?.trim() ||
    artifact.sealedPublicLanding?.publicTitle?.trim() ||
    (artifact.status === 'generating' ? 'Yansı hazırlanıyor' : 'Yansı');
  const summary =
    artifact.publicSummary?.trim() ||
    artifact.sealedPublicLanding?.publicSummary?.trim() ||
    null;
  const sceneImageUrl = artifact.sceneImageUrl?.trim() || null;
  return { title, summary, sceneImageUrl };
}

/** Resolve product fields from a Discover feed item (published artifact projection). */
export function resolveYansiProductFromDiscoverItem(
  item: DiscoverLike
): YansiProductFields {
  const title =
    item.publicTitle?.trim() ||
    item.title?.trim() ||
    'Yansı';
  const summary =
    item.publicSummary?.trim() ||
    item.description?.trim() ||
    null;
  const sceneImageUrl = item.sceneImageUrl?.trim() || null;
  return { title, summary, sceneImageUrl };
}
