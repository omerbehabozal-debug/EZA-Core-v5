/**
 * Server-authoritative profile avatar resolution and revision ordering.
 */

export type AvatarAuthority = {
  public_avatar_url?: string | null;
  public_avatar_revision?: number | null;
};

export type AvatarDraftState =
  | { mode: 'keep' }
  | { mode: 'replace'; previewUrl: string }
  | { mode: 'clear' };

export function normalizeAvatarRevision(revision?: number | string | null): number {
  if (revision == null) return 0;
  const numeric = typeof revision === 'number' ? revision : Number(revision);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function shouldAcceptIncomingAvatarRevision(
  currentRevision: number,
  incomingRevision: number
): boolean {
  return incomingRevision >= currentRevision;
}

export function mergeAvatarAuthorityFields<T extends AvatarAuthority>(
  current: T,
  incoming: Partial<AvatarAuthority>
): T {
  const incomingHasAvatarFields =
    incoming.public_avatar_url !== undefined ||
    incoming.public_avatar_revision !== undefined;
  if (!incomingHasAvatarFields) {
    return current;
  }

  const currentRev = normalizeAvatarRevision(current.public_avatar_revision);
  const incomingRev = normalizeAvatarRevision(
    incoming.public_avatar_revision ?? currentRev
  );

  if (!shouldAcceptIncomingAvatarRevision(currentRev, incomingRev)) {
    return current;
  }

  return {
    ...current,
    ...(incoming.public_avatar_url !== undefined
      ? { public_avatar_url: incoming.public_avatar_url }
      : {}),
    public_avatar_revision: incomingRev,
  };
}

export function resolveAuthenticatedAvatarDisplay(input: {
  draft: AvatarDraftState;
  user: AvatarAuthority | null | undefined;
}): { url: string | null; revision: number | undefined } {
  const { draft, user } = input;

  if (draft.mode === 'replace') {
    return { url: draft.previewUrl, revision: undefined };
  }
  if (draft.mode === 'clear') {
    return { url: null, revision: undefined };
  }

  const url = (user?.public_avatar_url || '').trim() || null;
  const revision = normalizeAvatarRevision(user?.public_avatar_revision);
  return {
    url,
    revision: revision > 0 ? revision : undefined,
  };
}
