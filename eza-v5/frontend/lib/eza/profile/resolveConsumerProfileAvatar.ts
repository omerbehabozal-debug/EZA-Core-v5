/**
 * Resolve profile avatar for any consumer surface (header, hero, Yansı author, profile).
 * Self user always wins from AuthContext; other users use server/public authority.
 */

import {
  extractProfileAvatarCanonicalPath,
  extractUserIdFromProfileAvatarPath,
} from '@/lib/eza/profile/avatarDisplayUrl';
import {
  normalizeAvatarRevision,
  type AvatarAuthority,
} from '@/lib/eza/profile/authoritativeAvatar';

export type ResolvedConsumerProfileAvatar = {
  url: string | null;
  revision: number | undefined;
};

export type ProfileAvatarConsumerInput = {
  subjectUserId?: string | null;
  snapshotUrl?: string | null;
  snapshotRevision?: number | string | null;
  /** Server-provided public profile avatar (author profile API, etc.). */
  publicAvatarUrl?: string | null;
  publicAvatarRevision?: number | string | null;
  authUser?: (AvatarAuthority & { user_id?: string | null }) | null;
};

function revisionToken(
  revision?: number | string | null
): number | undefined {
  const normalized = normalizeAvatarRevision(revision);
  return normalized > 0 ? normalized : undefined;
}

function snapshotBelongsToSubject(
  snapshotUrl: string,
  subjectUserId: string
): boolean {
  const ownerId = extractUserIdFromProfileAvatarPath(snapshotUrl);
  if (!ownerId) return true;
  return ownerId === subjectUserId.trim().toLowerCase();
}

function resolveFromAuthorityFields(input: {
  url?: string | null;
  revision?: number | string | null;
}): ResolvedConsumerProfileAvatar | null {
  const canonical = input.url ? extractProfileAvatarCanonicalPath(input.url) : null;
  const url = canonical || (input.url || '').trim() || null;
  if (!url) return null;
  return { url, revision: revisionToken(input.revision) };
}

/**
 * Current authenticated user's avatar — always from AuthContext authority.
 */
export function resolveSelfProfileAvatar(
  authUser?: AvatarAuthority | null
): ResolvedConsumerProfileAvatar {
  const url = (authUser?.public_avatar_url || '').trim() || null;
  return {
    url,
    revision: revisionToken(authUser?.public_avatar_revision),
  };
}

/**
 * Resolve avatar for a subject user at render time.
 * Self rule: authUser.public_avatar_* overrides any snapshot.
 * Other users: public authority → valid snapshot → grapheme (null url).
 */
export function resolveConsumerProfileAvatar(
  input: ProfileAvatarConsumerInput
): ResolvedConsumerProfileAvatar {
  const subjectId = (input.subjectUserId || '').trim();
  const authId = (input.authUser?.user_id || '').trim();

  if (subjectId && authId && subjectId === authId) {
    return resolveSelfProfileAvatar(input.authUser);
  }

  const fromPublic = resolveFromAuthorityFields({
    url: input.publicAvatarUrl,
    revision: input.publicAvatarRevision,
  });
  if (fromPublic) return fromPublic;

  const snapshot = (input.snapshotUrl || '').trim();
  if (snapshot) {
    if (subjectId && !snapshotBelongsToSubject(snapshot, subjectId)) {
      return { url: null, revision: undefined };
    }
    const fromSnapshot = resolveFromAuthorityFields({
      url: snapshot,
      revision: input.snapshotRevision,
    });
    if (fromSnapshot) return fromSnapshot;
    if (!extractProfileAvatarCanonicalPath(snapshot)) {
      return { url: snapshot, revision: undefined };
    }
  }

  return { url: null, revision: undefined };
}
