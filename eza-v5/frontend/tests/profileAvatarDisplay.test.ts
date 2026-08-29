import { describe, expect, it } from 'vitest';
import {
  appendAvatarCacheBust,
  buildProfileAvatarDisplaySrc,
  resolveProfileAvatarDisplayUrl,
} from '@/lib/eza/profile/avatarDisplayUrl';

describe('avatarDisplayUrl', () => {
  it('appends cache-bust query param', () => {
    expect(appendAvatarCacheBust('https://api.example.com/a.jpg', 42)).toBe(
      'https://api.example.com/a.jpg?v=42'
    );
  });

  it('uses ampersand when url already has query string', () => {
    expect(appendAvatarCacheBust('https://api.example.com/a.jpg?x=1', 9)).toBe(
      'https://api.example.com/a.jpg?x=1&v=9'
    );
  });

  it('rewrites api.ezacore.ai avatar URLs to same-origin path on standalone', () => {
    const prev = global.window;
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'standalone.ezacore.ai', origin: 'https://standalone.ezacore.ai' } },
      configurable: true,
    });
    expect(
      resolveProfileAvatarDisplayUrl(
        'https://api.ezacore.ai/api/public/profile-avatars/11111111-1111-4111-8111-111111111111.jpg'
      )
    ).toBe('/api/public/profile-avatars/11111111-1111-4111-8111-111111111111.jpg');
    Object.defineProperty(global, 'window', { value: prev, configurable: true });
  });

  it('buildProfileAvatarDisplaySrc combines rewrite and cache bust', () => {
    const prev = global.window;
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'standalone.ezacore.ai', origin: 'https://standalone.ezacore.ai' } },
      configurable: true,
    });
    expect(
      buildProfileAvatarDisplaySrc(
        'https://api.ezacore.ai/api/public/profile-avatars/u.jpg',
        7
      )
    ).toBe('/api/public/profile-avatars/u.jpg?v=7');
    Object.defineProperty(global, 'window', { value: prev, configurable: true });
  });
});
