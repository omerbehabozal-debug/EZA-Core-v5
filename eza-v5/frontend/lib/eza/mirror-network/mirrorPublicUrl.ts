/**
 * Phase 8.2 — canonical public Yansı share URL (single source of truth).
 *
 * Production default: standalone.ezacore.ai (matches SAINA deploy + middleware).
 * Override via NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL when staging/custom.
 */

export const MIRROR_PUBLIC_BASE_URL_DEFAULT = 'https://standalone.ezacore.ai';

export function resolveMirrorPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  return MIRROR_PUBLIC_BASE_URL_DEFAULT;
}

export function buildMirrorPublicPath(slug: string): string {
  const safe = slug.trim();
  return `/m/${safe}`;
}

export function buildMirrorPublicShareUrl(slug: string): string {
  return `${resolveMirrorPublicBaseUrl()}${buildMirrorPublicPath(slug)}`;
}

/** Paths served by the public mirror network app — never domain-rewritten. */
export function isPublicMirrorNetworkPath(pathname: string): boolean {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  return path === '/m' || path.startsWith('/m/');
}
