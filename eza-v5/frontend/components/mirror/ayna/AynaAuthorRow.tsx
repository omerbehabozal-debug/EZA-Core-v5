'use client';

import { cn } from '@/lib/utils';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { useResolvedProfileAvatar } from '@/hooks/useResolvedProfileAvatar';

export type AynaAuthorRowProps = {
  displayName: string;
  authorUserId?: string | null;
  /** Legacy conversation/Yansı snapshot — overridden for current self at render. */
  avatarUrl?: string | null;
  avatarRevision?: number | string | null;
  /** Server public profile authority (author profile API). */
  publicAvatarUrl?: string | null;
  publicAvatarRevision?: number | string | null;
  honorific?: string | null;
  onOpenProfile?: () => void;
  className?: string;
};

/**
 * Current Yansı author — navigates to that person's published Yansılar.
 */
export default function AynaAuthorRow({
  displayName,
  authorUserId = null,
  avatarUrl,
  avatarRevision,
  publicAvatarUrl,
  publicAvatarRevision,
  honorific = null,
  onOpenProfile,
  className,
}: AynaAuthorRowProps) {
  const resolved = useResolvedProfileAvatar({
    subjectUserId: authorUserId,
    snapshotUrl: avatarUrl,
    snapshotRevision: avatarRevision,
    publicAvatarUrl,
    publicAvatarRevision,
  });
  const interactive = typeof onOpenProfile === 'function';
  const showHonorific = Boolean(honorific);

  const inner = (
    <>
      <ProfileUserAvatar
        displayName={displayName}
        userId={authorUserId}
        avatarUrl={resolved.url}
        cacheBust={resolved.revision}
        size="sm"
        className="ayna-author-row__avatar"
      />
      <span className="min-w-0 truncate text-[12px] font-medium tracking-tight text-[rgba(246,244,239,0.92)]">
        {displayName}
      </span>
      {showHonorific ? <HonorificMarker honorific={honorific} size="sm" /> : null}
    </>
  );

  if (!interactive) {
    return (
      <div
        className={cn('flex items-center gap-2', className)}
        data-testid="ayna-author-row"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg text-left transition-colors',
        'hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(231,180,91,0.45)]',
        className
      )}
      onClick={onOpenProfile}
      data-testid="ayna-author-row"
      aria-label={`${displayName} profilini aç`}
    >
      {inner}
    </button>
  );
}
