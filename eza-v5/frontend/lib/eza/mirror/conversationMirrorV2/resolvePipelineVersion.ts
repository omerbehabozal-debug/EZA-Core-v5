/**
 * Mirror pipeline version flag — V1 (legacy) vs V2 (cinematic poster).
 */

import type { MirrorPipelineVersion } from '@/lib/eza/mirror/types';

const DEV_PIPELINE_KEY = 'eza_mirror_pipeline';

function readEnvPipeline(): MirrorPipelineVersion | null {
  const raw = process.env.NEXT_PUBLIC_EZA_MIRROR_PIPELINE;
  if (raw === 'v2') return 'v2';
  if (raw === 'v1') return 'v1';
  return null;
}

function readLocalPipelineOverride(): MirrorPipelineVersion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEV_PIPELINE_KEY);
    if (raw === 'v2' || raw === 'v1') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveMirrorPipelineVersion(
  override?: MirrorPipelineVersion
): MirrorPipelineVersion {
  if (override) return override;
  const local = readLocalPipelineOverride();
  if (local) return local;
  const env = readEnvPipeline();
  if (env) return env;
  return 'v1';
}

export function isMirrorPipelineV2(override?: MirrorPipelineVersion): boolean {
  return resolveMirrorPipelineVersion(override) === 'v2';
}

export function setDevMirrorPipeline(version: MirrorPipelineVersion): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEV_PIPELINE_KEY, version);
}

export function clearDevMirrorPipeline(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEV_PIPELINE_KEY);
}
