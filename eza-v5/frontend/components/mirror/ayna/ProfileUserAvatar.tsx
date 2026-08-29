'use client';

import { cn } from '@/lib/utils';
import { appendAvatarCacheBust } from '@/lib/eza/profile/avatarDisplayUrl';
import ProfileDefaultAvatar from '@/components/mirror/ayna/ProfileDefaultAvatar';

type Props = {
  displayName: string;
  userId?: string | null;
  avatarUrl?: string | null;
  /** Bust browser cache when the same durable avatar URL is replaced. */
  cacheBust?: number | string;
  size?: 'md' | 'lg' | 'top';
  className?: string;
  alt?: string;
};

/**
 * Profile avatar — photo when available, otherwise grapheme fallback.
 */
export default function ProfileUserAvatar({
  displayName,
  userId,
  avatarUrl,
  cacheBust,
  size = 'md',
  className,
  alt,
}: Props) {
  const url = (avatarUrl || '').trim();
  if (url) {
    const src = cacheBust != null ? appendAvatarCacheBust(url, cacheBust) : url;
    return (
      <div
        className={cn(
          'bilign-profile-avatar bilign-profile-avatar--has-photo',
          size === 'lg' && 'bilign-profile-avatar--lg bilign-profile-avatar--panel',
          size === 'top' && 'saina-profile-avatar saina-profile-avatar--top',
          className
        )}
        data-testid="bilign-profile-avatar"
      >
        <img
          src={src}
          alt={alt || displayName || 'Profil fotoğrafı'}
          className="bilign-profile-avatar__photo"
          data-testid="bilign-profile-avatar-photo"
        />
      </div>
    );
  }

  return (
    <ProfileDefaultAvatar
      displayName={displayName}
      userId={userId}
      size={size === 'top' ? 'md' : size}
      className={cn(size === 'top' && 'saina-profile-avatar saina-profile-avatar--top', className)}
    />
  );
}
