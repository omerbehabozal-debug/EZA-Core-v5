import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

/** Plus — aynı kart için yeni sahne (snapshot / buildMirrorState dokunulmaz). */
export function canRequestNewSceneVariation(
  isPlus: boolean,
  sceneImageStatus: MirrorSceneImageStatus,
  hasProductionQuota = true
): boolean {
  if (!isPlus) return false;
  if (!hasProductionQuota) return false;
  return sceneImageStatus !== 'generating';
}
