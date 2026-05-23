/**
 * EZA Mirror render mode — Sprint 13C hybrid poster feature flag.
 *
 * Mode A (scene_only): OpenAI textless scene; frontend all copy overlays.
 * Mode B (hybrid_middle): OpenAI middle poster artwork with embedded copy.
 */

export type MirrorRenderMode = 'scene_only' | 'hybrid_middle';

export function resolveMirrorRenderMode(
  override?: MirrorRenderMode
): MirrorRenderMode {
  if (override) return override;
  const envValues = [
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER,
    process.env.NEXT_PUBLIC_EZA_MIRROR_RENDER_MODE,
    process.env.EZA_MIRROR_RENDER_MODE,
  ];
  for (const raw of envValues) {
    if (raw === 'true' || raw === 'hybrid_middle') {
      return 'hybrid_middle';
    }
  }
  return 'scene_only';
}

export function isHybridPosterMode(override?: MirrorRenderMode): boolean {
  return resolveMirrorRenderMode(override) === 'hybrid_middle';
}
