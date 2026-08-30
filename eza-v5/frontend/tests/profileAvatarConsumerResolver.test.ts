import { describe, expect, it } from 'vitest';
import {
  extractUserIdFromProfileAvatarPath,
  PROFILE_AVATAR_PUBLIC_PREFIX,
} from '@/lib/eza/profile/avatarDisplayUrl';
import {
  resolveConsumerProfileAvatar,
  resolveSelfProfileAvatar,
} from '@/lib/eza/profile/resolveConsumerProfileAvatar';

const USER_A = 'a681c910-0000-4000-8000-000000000001';
const USER_B = 'b681c910-0000-4000-8000-000000000002';
const AVATAR_A = `${PROFILE_AVATAR_PUBLIC_PREFIX}${USER_A}.jpg`;
const AVATAR_B = `${PROFILE_AVATAR_PUBLIC_PREFIX}${USER_B}.jpg`;
const STALE_A = `http://localhost:8000${AVATAR_A}`;

describe('resolveConsumerProfileAvatar', () => {
  it('self user always uses AuthContext authority over snapshot', () => {
    const resolved = resolveConsumerProfileAvatar({
      subjectUserId: USER_A,
      snapshotUrl: STALE_A,
      snapshotRevision: 2,
      authUser: {
        user_id: USER_A,
        public_avatar_url: AVATAR_B,
        public_avatar_revision: 5,
      },
    });
    expect(resolved.url).toBe(AVATAR_B);
    expect(resolved.revision).toBe(5);
  });

  it('other user uses public authority over stale self snapshot', () => {
    const resolved = resolveConsumerProfileAvatar({
      subjectUserId: USER_B,
      snapshotUrl: AVATAR_A,
      snapshotRevision: 4,
      publicAvatarUrl: AVATAR_B,
      publicAvatarRevision: 3,
      authUser: {
        user_id: USER_A,
        public_avatar_url: AVATAR_A,
        public_avatar_revision: 9,
      },
    });
    expect(resolved.url).toBe(AVATAR_B);
    expect(resolved.revision).toBe(3);
  });

  it('rejects snapshot that belongs to a different user', () => {
    const resolved = resolveConsumerProfileAvatar({
      subjectUserId: USER_B,
      snapshotUrl: AVATAR_A,
      snapshotRevision: 4,
      authUser: {
        user_id: USER_A,
        public_avatar_url: AVATAR_A,
        public_avatar_revision: 9,
      },
    });
    expect(resolved.url).toBeNull();
  });

  it('resolveSelfProfileAvatar omits revision when zero', () => {
    expect(
      resolveSelfProfileAvatar({
        public_avatar_url: AVATAR_A,
        public_avatar_revision: 0,
      })
    ).toEqual({ url: AVATAR_A, revision: undefined });
  });
});

describe('extractUserIdFromProfileAvatarPath', () => {
  it('extracts uuid from canonical path', () => {
    expect(extractUserIdFromProfileAvatarPath(AVATAR_A)).toBe(USER_A);
  });
});
