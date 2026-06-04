/**
 * Client cache for today's generated mirror scene (snapshot does not store image URL).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

export const MIRROR_SCENE_CACHE_STORAGE_KEY = 'eza_daily_mirror_scene_v1';

export type MirrorSceneCacheRecord = {
  cardDate: string;
  intentFingerprint: string;
  sceneImageUrl: string;
  provider?: string;
  cachedAt: string;
};

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function normalize(raw: unknown): MirrorSceneCacheRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.cardDate === 'string' &&
    typeof o.intentFingerprint === 'string' &&
    typeof o.sceneImageUrl === 'string' &&
    o.sceneImageUrl.trim().length > 0
  ) {
    return {
      cardDate: o.cardDate,
      intentFingerprint: o.intentFingerprint,
      sceneImageUrl: o.sceneImageUrl,
      provider: typeof o.provider === 'string' ? o.provider : undefined,
      cachedAt: typeof o.cachedAt === 'string' ? o.cachedAt : '',
    };
  }
  return null;
}

export function readMirrorSceneCache(
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'> | null
): MirrorSceneCacheRecord | null {
  if (!card?.visual) return null;
  const fingerprint = card.visual.intentFingerprint ?? '';
  if (!fingerprint) return null;
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(MIRROR_SCENE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const record = normalize(JSON.parse(raw));
    if (!record) return null;
    if (record.cardDate !== card.date) return null;
    if (record.intentFingerprint !== fingerprint) return null;
    return record;
  } catch {
    return null;
  }
}

export function saveMirrorSceneCache(
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'>,
  sceneImageUrl: string,
  provider?: string
): void {
  const fingerprint = card.visual?.intentFingerprint ?? '';
  if (!fingerprint || !sceneImageUrl.trim()) return;
  const record: MirrorSceneCacheRecord = {
    cardDate: card.date,
    intentFingerprint: fingerprint,
    sceneImageUrl,
    provider,
    cachedAt: new Date().toISOString(),
  };
  storage()?.setItem(MIRROR_SCENE_CACHE_STORAGE_KEY, JSON.stringify(record));
}

export function clearMirrorSceneCache(): void {
  storage()?.removeItem(MIRROR_SCENE_CACHE_STORAGE_KEY);
}
