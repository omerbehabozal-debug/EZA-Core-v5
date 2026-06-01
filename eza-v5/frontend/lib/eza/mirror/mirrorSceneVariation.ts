import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

/** Plus — aynı kart için yeni sahne (snapshot / buildMirrorState dokunulmaz). */
export function canRequestNewSceneVariation(
  isPlus: boolean,
  sceneImageStatus: MirrorSceneImageStatus
): boolean {
  if (!isPlus) return false;
  return sceneImageStatus !== 'generating';
}
