'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  resolveConsumerProfileAvatar,
  type ProfileAvatarConsumerInput,
  type ResolvedConsumerProfileAvatar,
} from '@/lib/eza/profile/resolveConsumerProfileAvatar';

export function useResolvedProfileAvatar(
  input: Omit<ProfileAvatarConsumerInput, 'authUser'>
): ResolvedConsumerProfileAvatar {
  const { user } = useAuth();
  return useMemo(
    () =>
      resolveConsumerProfileAvatar({
        ...input,
        authUser: user,
      }),
    [
      input.subjectUserId,
      input.snapshotUrl,
      input.snapshotRevision,
      input.publicAvatarUrl,
      input.publicAvatarRevision,
      user?.user_id,
      user?.public_avatar_url,
      user?.public_avatar_revision,
    ]
  );
}
