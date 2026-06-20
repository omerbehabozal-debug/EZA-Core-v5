/**
 * Purge pre-V3.1 scene caches so stale posters are never hydrated.
 */

import { CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY } from '@/lib/eza/mirror/mirrorSceneCache';
import { MIRROR_V3_SCENE_CACHE_KEY } from '@/lib/eza/mirror/conversationMirrorV3/types';

export const LEGACY_CONVERSATION_MIRROR_SCENE_CACHE_KEYS = [
  'eza_conversation_mirror_scene_v1',
] as const;

export function purgeLegacyMirrorSceneCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_CONVERSATION_MIRROR_SCENE_CACHE_KEYS) {
      localStorage.removeItem(key);
    }

    const raw = localStorage.getItem(CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, { intentFingerprint?: string }>;
    if (!parsed || typeof parsed !== 'object') return;

    const prefix = MIRROR_V3_SCENE_CACHE_KEY;
    let changed = false;
    for (const [conversationId, record] of Object.entries(parsed)) {
      if (!record?.intentFingerprint?.startsWith(prefix)) {
        delete parsed[conversationId];
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(
        CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
        JSON.stringify(parsed)
      );
    }
  } catch {
    /* ignore storage errors */
  }
}

export function isV31SceneCacheFingerprint(fingerprint: string | undefined | null): boolean {
  return Boolean(fingerprint?.startsWith(MIRROR_V3_SCENE_CACHE_KEY));
}
