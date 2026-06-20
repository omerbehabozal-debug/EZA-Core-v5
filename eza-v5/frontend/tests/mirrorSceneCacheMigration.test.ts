import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
  readConversationMirrorSceneCache,
} from '@/lib/eza/mirror/mirrorSceneCache';
import {
  isV31SceneCacheFingerprint,
  purgeLegacyMirrorSceneCaches,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorSceneCacheMigration';
import { MIRROR_V3_SCENE_CACHE_KEY } from '@/lib/eza/mirror/conversationMirrorV3/types';

describe('mirrorSceneCacheMigration', () => {
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
  });

  it('recognizes V3.1 cache fingerprint prefix', () => {
    expect(isV31SceneCacheFingerprint(`${MIRROR_V3_SCENE_CACHE_KEY}:golden_hour:d2`)).toBe(
      true
    );
    expect(isV31SceneCacheFingerprint('v3:golden_hour:Merak')).toBe(false);
  });

  it('purges legacy storage key and stale conversation cache entries', () => {
    localStorage.setItem('eza_conversation_mirror_scene_v1', '{"old":true}');
    localStorage.setItem(
      CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
      JSON.stringify({
        'chat-old': {
          cardDate: '2026-05-31',
          intentFingerprint: 'v3:golden_hour:topic',
          sceneImageUrl: 'https://cdn.example/old.png',
        },
        'chat-new': {
          cardDate: '2026-05-31',
          intentFingerprint: `${MIRROR_V3_SCENE_CACHE_KEY}:golden_hour:d2:Merak:chat-new`,
          sceneImageUrl: 'https://cdn.example/new.png',
        },
      })
    );

    purgeLegacyMirrorSceneCaches();

    expect(localStorage.getItem('eza_conversation_mirror_scene_v1')).toBeNull();
    const store = JSON.parse(
      localStorage.getItem(CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY) ?? '{}'
    );
    expect(store['chat-old']).toBeUndefined();
    expect(store['chat-new']).toBeDefined();
  });

  it('rejects V3 card cache hit when fingerprint is pre-V3.1', () => {
    localStorage.setItem(
      CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
      JSON.stringify({
        'chat-1': {
          cardDate: '2026-05-31',
          intentFingerprint: 'v3:golden_hour:topic',
          sceneImageUrl: 'https://cdn.example/stale.png',
        },
      })
    );

    const hit = readConversationMirrorSceneCache('chat-1', {
      date: '2026-05-31',
      mirrorPipelineVersion: 'v3',
      visual: {
        intentFingerprint: `${MIRROR_V3_SCENE_CACHE_KEY}:golden_hour:d2:Merak:chat-1`,
      },
    });

    expect(hit).toBeNull();
  });
});
