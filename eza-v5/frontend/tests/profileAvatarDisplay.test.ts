import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendAvatarCacheBust,
  buildProfileAvatarDisplaySrc,
  extractProfileAvatarCanonicalPath,
  resolveProfileAvatarDisplayUrl,
} from '@/lib/eza/profile/avatarDisplayUrl';

const USER_FILE = '11111111-1111-4111-8111-111111111111.jpg';

function mockWindow(hostname: string, origin?: string) {
  const prev = global.window;
  Object.defineProperty(global, 'window', {
    value: {
      location: {
        hostname,
        origin: origin ?? `https://${hostname}`,
      },
    },
    configurable: true,
  });
  return () => {
    Object.defineProperty(global, 'window', { value: prev, configurable: true });
  };
}

describe('avatarDisplayUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('extracts canonical path from relative, localhost, and production API URLs', () => {
    const canonical = `/api/public/profile-avatars/${USER_FILE}`;
    expect(extractProfileAvatarCanonicalPath(canonical)).toBe(canonical);
    expect(
      extractProfileAvatarCanonicalPath(
        `http://localhost:8000/api/public/profile-avatars/${USER_FILE}`
      )
    ).toBe(canonical);
    expect(
      extractProfileAvatarCanonicalPath(
        `https://api.ezacore.ai/api/public/profile-avatars/${USER_FILE}`
      )
    ).toBe(canonical);
    expect(
      extractProfileAvatarCanonicalPath('https://evil.example.com/not-avatar.jpg')
    ).toBeNull();
  });

  it('rewrites relative path to same-origin on hosted standalone', () => {
    const restore = mockWindow('standalone.ezacore.ai');
    expect(
      resolveProfileAvatarDisplayUrl(`/api/public/profile-avatars/${USER_FILE}`)
    ).toBe(`/api/public/profile-avatars/${USER_FILE}`);
    restore();
  });

  it('rewrites legacy localhost absolute URL to same-origin on hosted standalone', () => {
    const restore = mockWindow('standalone.ezacore.ai');
    expect(
      resolveProfileAvatarDisplayUrl(
        `http://localhost:8000/api/public/profile-avatars/${USER_FILE}`
      )
    ).toBe(`/api/public/profile-avatars/${USER_FILE}`);
    restore();
  });

  it('rewrites production API absolute URL to same-origin on hosted standalone', () => {
    const restore = mockWindow('standalone.ezacore.ai');
    expect(
      resolveProfileAvatarDisplayUrl(
        `https://api.ezacore.ai/api/public/profile-avatars/${USER_FILE}`
      )
    ).toBe(`/api/public/profile-avatars/${USER_FILE}`);
    restore();
  });

  it('does not rewrite unrelated external image URLs', () => {
    const restore = mockWindow('standalone.ezacore.ai');
    const external = 'https://cdn.example.com/avatars/user.jpg';
    expect(resolveProfileAvatarDisplayUrl(external)).toBe(external);
    restore();
  });

  it('resolves relative path to local API base in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.NEXT_PUBLIC_EZA_API_URL;
    const restore = mockWindow('localhost', 'http://localhost:3000');
    expect(
      resolveProfileAvatarDisplayUrl(`/api/public/profile-avatars/${USER_FILE}`)
    ).toBe(`http://127.0.0.1:8000/api/public/profile-avatars/${USER_FILE}`);
    restore();
  });

  it('resolves legacy localhost absolute URL to local API base in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.NEXT_PUBLIC_EZA_API_URL;
    const restore = mockWindow('localhost', 'http://localhost:3000');
    expect(
      resolveProfileAvatarDisplayUrl(
        `http://localhost:8000/api/public/profile-avatars/${USER_FILE}`
      )
    ).toBe(`http://127.0.0.1:8000/api/public/profile-avatars/${USER_FILE}`);
    restore();
  });

  it('buildProfileAvatarDisplaySrc combines rewrite and cache bust on hosted', () => {
    const restore = mockWindow('standalone.ezacore.ai');
    expect(
      buildProfileAvatarDisplaySrc(
        `http://localhost:8000/api/public/profile-avatars/u.jpg`,
        5
      )
    ).toBe('/api/public/profile-avatars/u.jpg?v=5');
    restore();
  });
});
