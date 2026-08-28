'use client';

import { cn } from '@/lib/utils';
import ProfileDefaultAvatar from '@/components/mirror/ayna/ProfileDefaultAvatar';

type Props = {
  displayName: string;
  userId?: string | null;
  avatarUrl?: string | null;
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
  size = 'md',
  className,
  alt,
}: Props) {
  const url = (avatarUrl || '').trim();
  if (url) {
    return (
      <div
        className={cn(
          'bilign-profile-avatar bilign-profile-avatar--has-photo',
          size === 'lg' && 'bilign-profile-avatar--lg',
          size === 'top' && 'saina-profile-avatar saina-profile-avatar--top',
          className
        )}
        data-testid="bilign-profile-avatar"
      >
        <img
          src={url}
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
