import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMirrorSceneCache,
  MIRROR_SCENE_CACHE_STORAGE_KEY,
  readMirrorSceneCache,
  saveMirrorSceneCache,
} from '@/lib/eza/mirror/mirrorSceneCache';

const card = {
  date: '2026-05-31',
  visual: { intentFingerprint: 'fp-test' },
};

describe('mirrorSceneCache', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
    clearMirrorSceneCache();
  });

  it('round-trips scene URL for matching card fingerprint', () => {
    saveMirrorSceneCache(card, 'https://cdn.example/scene.png', 'openai');
    const hit = readMirrorSceneCache(card);
    expect(hit?.sceneImageUrl).toBe('https://cdn.example/scene.png');
    expect(hit?.provider).toBe('openai');
  });

  it('misses when fingerprint differs', () => {
    saveMirrorSceneCache(card, 'https://cdn.example/scene.png');
    expect(
      readMirrorSceneCache({
        date: card.date,
        visual: { intentFingerprint: 'other' },
      })
    ).toBeNull();
  });

  it('clears storage', () => {
    saveMirrorSceneCache(card, 'https://cdn.example/scene.png');
    clearMirrorSceneCache();
    expect(localStorage.getItem(MIRROR_SCENE_CACHE_STORAGE_KEY)).toBeNull();
  });
});
