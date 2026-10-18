'use client';

import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { resolveSelfProfileAvatar } from '@/lib/eza/profile/resolveConsumerProfileAvatar';
import {
  resolveAuthUserDisplayName,
  resolveAuthUserInitial,
} from '@/lib/eza/sainaIdentity';

type AuthUserLike = {
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  public_display_name?: string | null;
  public_avatar_url?: string | null;
  public_avatar_revision?: number;
} | null | undefined;

type Props = {
  user: AuthUserLike;
  /** Extra class on the outer chip (defaults to biz-account-avatar). */
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Shared BiligN account mark for Business / Platform Admin chrome.
 * Always mirrors AuthContext public profile name + avatar (not brand contact_name).
 */
export default function SainaAuthAccountMark({ user, className, size = 'sm' }: Props) {
  const displayName = resolveAuthUserDisplayName(user);
  const initial = resolveAuthUserInitial(user);
  const avatar = resolveSelfProfileAvatar(user ?? null);
  const cls = className || 'biz-account-avatar';

  if (!avatar.url) {
    return (
      <span className={cls} aria-hidden>
        {initial}
      </span>
    );
  }

  return (
    <span className={`${cls} biz-account-avatar--photo`} aria-hidden>
      <ProfileUserAvatar
        displayName={displayName}
        userId={user?.user_id}
        avatarUrl={avatar.url}
        cacheBust={avatar.revision}
        size={size}
      />
    </span>
  );
}
