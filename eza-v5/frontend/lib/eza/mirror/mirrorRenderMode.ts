/**
 * EZA Mirror render mode — Sprint 13C hybrid poster feature flag.
 *
 * Mode A (scene_only): OpenAI textless scene; frontend all copy overlays.
 * Mode B (hybrid_middle): OpenAI middle poster artwork with embedded copy.
 */

export type MirrorRenderMode = 'scene_only' | 'hybrid_middle';

const DEV_RENDER_MODE_KEY = 'eza_mirror_render_mode';

function readEnvHybridFlag(): boolean {
  const envValues = [
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER,
    process.env.NEXT_PUBLIC_EZA_MIRROR_RENDER_MODE,
    process.env.EZA_MIRROR_RENDER_MODE,
  ];
  return envValues.some((raw) => raw === 'true' || raw === 'hybrid_middle');
}

function readLocalRenderOverride(): MirrorRenderMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEV_RENDER_MODE_KEY);
    if (raw === 'hybrid_middle' || raw === 'scene_only') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/** True when env or dev localStorage enables hybrid mode. */
export function isHybridEnabled(): boolean {
  if (readEnvHybridFlag()) return true;
  return readLocalRenderOverride() === 'hybrid_middle';
}

export function getHybridEnvDebug(): string {
  const parts = [
    `NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER=${process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER ?? 'unset'}`,
    `NEXT_PUBLIC_EZA_MIRROR_RENDER_MODE=${process.env.NEXT_PUBLIC_EZA_MIRROR_RENDER_MODE ?? 'unset'}`,
    `localStorage.${DEV_RENDER_MODE_KEY}=${typeof window !== 'undefined' ? localStorage.getItem(DEV_RENDER_MODE_KEY) ?? 'unset' : 'ssr'}`,
  ];
  return parts.join(' · ');
}

export function setDevRenderMode(mode: MirrorRenderMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEV_RENDER_MODE_KEY, mode);
}

/**
 * Resolves active render mode from env + dev localStorage override.
 * Default: scene_only (production-safe).
 */
export function resolveMirrorRenderMode(
  override?: MirrorRenderMode
): MirrorRenderMode {
  if (override) return override;
  const local = readLocalRenderOverride();
  if (local) return local;
  if (readEnvHybridFlag()) return 'hybrid_middle';
  return 'scene_only';
}

export function isHybridPosterMode(override?: MirrorRenderMode): boolean {
  return resolveMirrorRenderMode(override) === 'hybrid_middle';
}
