import { describe, expect, it } from 'vitest';
import {
  mergeAvatarAuthorityFields,
  normalizeAvatarRevision,
  resolveAuthenticatedAvatarDisplay,
  shouldAcceptIncomingAvatarRevision,
} from '@/lib/eza/profile/authoritativeAvatar';

const BASE_URL = 'https://api.example.com/api/public/profile-avatars/user.jpg';

describe('authoritativeAvatar', () => {
  it('rejects stale incoming avatar revision', () => {
    expect(shouldAcceptIncomingAvatarRevision(5, 4)).toBe(false);
    expect(shouldAcceptIncomingAvatarRevision(5, 5)).toBe(true);
    expect(shouldAcceptIncomingAvatarRevision(5, 6)).toBe(true);
  });

  it('mergeAvatarAuthorityFields keeps newer avatar when stale /me arrives', () => {
    const current = {
      public_avatar_url: BASE_URL,
      public_avatar_revision: 5,
      email: 'a@example.com',
    };
    const merged = mergeAvatarAuthorityFields(current, {
      public_avatar_url: BASE_URL,
      public_avatar_revision: 4,
    });
    expect(merged.public_avatar_revision).toBe(5);
    expect(merged.email).toBe('a@example.com');
  });

  it('mergeAvatarAuthorityFields accepts newer avatar revision', () => {
    const merged = mergeAvatarAuthorityFields(
      { public_avatar_url: BASE_URL, public_avatar_revision: 4 },
      { public_avatar_url: BASE_URL, public_avatar_revision: 5 }
    );
    expect(merged.public_avatar_revision).toBe(5);
  });

  it('resolveAuthenticatedAvatarDisplay prefers editing preview', () => {
    const resolved = resolveAuthenticatedAvatarDisplay({
      draft: { mode: 'replace', previewUrl: 'blob:preview-b' },
      user: { public_avatar_url: BASE_URL, public_avatar_revision: 4 },
    });
    expect(resolved.url).toBe('blob:preview-b');
    expect(resolved.revision).toBeUndefined();
  });

  it('resolveAuthenticatedAvatarDisplay uses server avatar when draft is keep', () => {
    const resolved = resolveAuthenticatedAvatarDisplay({
      draft: { mode: 'keep' },
      user: { public_avatar_url: BASE_URL, public_avatar_revision: 5 },
    });
    expect(resolved.url).toBe(BASE_URL);
    expect(resolved.revision).toBe(5);
  });

  it('normalizeAvatarRevision coerces invalid values to zero', () => {
    expect(normalizeAvatarRevision(undefined)).toBe(0);
    expect(normalizeAvatarRevision(null)).toBe(0);
    expect(normalizeAvatarRevision('5')).toBe(5);
  });
});
