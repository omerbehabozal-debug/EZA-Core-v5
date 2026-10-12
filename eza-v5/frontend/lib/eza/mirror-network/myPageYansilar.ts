import type { DiscoverMirror } from './fetchDiscoverMirrors';
import type { AuthorPublishedYansiItem, OwnerProfileYansiResponse } from './fetchAuthorPublished';
import type { SavedYansiListItem } from './yansiSaveApi';

export function isActiveOwnerPublication(item: AuthorPublishedYansiItem): boolean {
  return Boolean(item.publishedAt && item.safetyStatus === 'open' &&
    (item.visibility === 'public' || item.visibility === 'unlisted'));
}

export function ownerPublicationCard(item: AuthorPublishedYansiItem, owner: OwnerProfileYansiResponse): DiscoverMirror {
  return { slug: item.slug, title: item.publicTitle, description: item.publicSummary,
    sceneImageUrl: item.sceneImageUrl ?? null, yansiCount: 0, journeyVersion: item.journeyVersion,
    experienceStartedCount: item.experienceStartedCount, directChildYansiCount: item.directChildYansiCount,
    authorDisplayName: owner.displayName, publicAvatarUrl: owner.publicAvatarUrl,
    publicAvatarRevision: owner.publicAvatarRevision, publicHonorific: owner.publicHonorific };
}

export function savedPublicationCard(item: SavedYansiListItem): DiscoverMirror | null {
  if (item.availability !== 'available' || !item.publicTitle?.trim()) return null;
  return { slug: item.slug, title: item.publicTitle, sceneImageUrl: item.sceneImageUrl ?? null,
    yansiCount: 0, journeyVersion: item.journeyVersion, authorDisplayName: item.authorDisplayName,
    publicAvatarUrl: item.publicAvatarUrl, publicHonorific: item.publicHonorific };
}
