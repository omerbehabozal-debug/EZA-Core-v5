import { describe, expect, it } from 'vitest';
import { appendAvatarCacheBust } from '@/lib/eza/profile/avatarDisplayUrl';

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
});
