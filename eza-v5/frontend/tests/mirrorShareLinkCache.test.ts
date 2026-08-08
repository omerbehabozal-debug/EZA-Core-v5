import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearMirrorShareLink,
  readMirrorShareLink,
  saveMirrorShareLink,
} from '@/lib/eza/mirror-share/mirrorShareLinkCache';

describe('mirrorShareLinkCache user scope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isolates share links by authenticated user id', () => {
    saveMirrorShareLink('conv-1', 'slug-a', 'https://saina.app/m/slug-a', 'user-1');
    saveMirrorShareLink('conv-1', 'slug-b', 'https://saina.app/m/slug-b', 'user-2');

    expect(readMirrorShareLink('conv-1', 'user-1')?.slug).toBe('slug-a');
    expect(readMirrorShareLink('conv-1', 'user-2')?.slug).toBe('slug-b');
    expect(readMirrorShareLink('conv-1', null)).toBeNull();
  });

  it('persists published landing fields for preview remount', () => {
    saveMirrorShareLink(
      'conv-1',
      'slug-a',
      'https://saina.app/m/slug-a',
      'user-1',
      new Date(),
      {
        publicTitle: 'Choosing the Right Family SUV',
        publicSummary: 'Inside a modern car showroom.',
      }
    );
    const row = readMirrorShareLink('conv-1', 'user-1');
    expect(row?.publicTitle).toBe('Choosing the Right Family SUV');
    expect(row?.publicSummary).toBe('Inside a modern car showroom.');
  });

  it('clears a conversation across users when userId omitted', () => {
    saveMirrorShareLink('conv-x', 'slug-a', 'https://saina.app/m/slug-a', 'user-1');
    saveMirrorShareLink('conv-x', 'slug-b', 'https://saina.app/m/slug-b', 'user-2');
    clearMirrorShareLink('conv-x');
    expect(readMirrorShareLink('conv-x', 'user-1')).toBeNull();
    expect(readMirrorShareLink('conv-x', 'user-2')).toBeNull();
  });
});
