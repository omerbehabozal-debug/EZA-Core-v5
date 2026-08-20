'use client';

import { cn } from '@/lib/utils';
import {
  avatarTintFromPublicUserId,
  resolvePublicAvatarGrapheme,
} from '@/lib/eza/mirror/publicIdentity';

type Props = {
  displayName: string;
  userId?: string | null;
  size?: 'md' | 'lg';
  className?: string;
};

/**
 * Phase 8.5B — default circular avatar. Never email-derived. No upload.
 */
export default function ProfileDefaultAvatar({
  displayName,
  userId,
  size = 'md',
  className,
}: Props) {
  const grapheme = resolvePublicAvatarGrapheme(displayName);
  const tint = avatarTintFromPublicUserId(userId);

  return (
    <div
      className={cn(
        'bilign-profile-avatar',
        size === 'lg' && 'bilign-profile-avatar--lg',
        className
      )}
      style={{ backgroundColor: tint }}
      aria-hidden
      data-testid="bilign-profile-avatar"
    >
      <span className="bilign-profile-avatar__glyph">{grapheme}</span>
    </div>
  );
}
