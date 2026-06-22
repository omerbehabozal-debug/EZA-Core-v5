/**
 * V3.2 scene cache namespace — bump when poster contract changes so stale scenes are not reused.
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { MIRROR_V3_SCENE_CACHE_KEY } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';

export function buildMirrorV3IntentFingerprint(payload: SainaMirrorV3Payload): string {
  const brief = buildMirrorRenderBrief(payload);
  return [
    MIRROR_V3_SCENE_CACHE_KEY,
    payload.season,
    brief.lightMode,
    brief.publicTopicHint.slice(0, 40),
    brief.title.slice(0, 40),
    payload.conversationId,
  ].join(':');
}

export function buildMirrorV3SeedHint(
  payload: SainaMirrorV3Payload,
  conversationScopedHint?: string
): string {
  const scope = conversationScopedHint ?? payload.conversationId;
  return [
    MIRROR_V3_SCENE_CACHE_KEY,
    scope,
    payload.season,
    `d${payload.narrativeDistance}`,
  ].join(':');
}
