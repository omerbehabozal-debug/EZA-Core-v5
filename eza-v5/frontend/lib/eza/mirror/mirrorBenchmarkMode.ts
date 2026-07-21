/**
 * Controlled Mirror benchmark mode (D2 quality runs).
 *
 * Enable (client-only):
 * - URL: ?mirrorBenchmark=1
 * - or localStorage: eza_mirror_benchmark_v1 = "1"
 *
 * Historical: forced cinematic_no_character. Style Lens prompt injection is
 * now retired globally; this flag remains for QA / future gates.
 */

import {
  type StyleLensId,
} from '@/lib/eza/mirror/styleLensRegistry';

export const MIRROR_BENCHMARK_STORAGE_KEY = 'eza_mirror_benchmark_v1';

/** Existing neutral lens — no person / mascot injection. */
export const MIRROR_BENCHMARK_NEUTRAL_LENS_ID: StyleLensId =
  'cinematic_no_character';

export function isMirrorBenchmarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mirrorBenchmark') === '1') return true;
    return window.localStorage.getItem(MIRROR_BENCHMARK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableMirrorBenchmarkMode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MIRROR_BENCHMARK_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function disableMirrorBenchmarkMode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MIRROR_BENCHMARK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveBenchmarkStyleLensId(
  fallback: StyleLensId
): StyleLensId {
  return isMirrorBenchmarkMode() ? MIRROR_BENCHMARK_NEUTRAL_LENS_ID : fallback;
}
