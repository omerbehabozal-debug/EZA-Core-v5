/** Bust CDN/browser cache after avatar replace (same durable filename). */
import { getApiUrl, isEzacoreFrontendHost } from '@/lib/apiUrl';

export const PROFILE_AVATAR_PUBLIC_PREFIX = '/api/public/profile-avatars/';

export function appendAvatarCacheBust(url: string, version?: number | string): string {
  const trimmed = url.trim();
  if (!trimmed || version == null) return trimmed;
  const token = version;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(String(token))}`;
}

/** Extract canonical profile-avatar path from relative or legacy absolute locators. */
export function extractProfileAvatarCanonicalPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const pathOnly = trimmed.split('?')[0] ?? trimmed;
  if (pathOnly.startsWith(PROFILE_AVATAR_PUBLIC_PREFIX)) {
    return pathOnly;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (!parsed.pathname.startsWith(PROFILE_AVATAR_PUBLIC_PREFIX)) {
      return null;
    }
    return parsed.pathname;
  } catch {
    return null;
  }
}

function extractProfileAvatarQuery(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.search;
  } catch {
    const q = url.indexOf('?');
    return q >= 0 ? url.slice(q) : '';
  }
}

/**
 * Resolve durable avatar locator for the current environment.
 * - Hosted *.ezacore.ai → same-origin /api/public/profile-avatars/... (HTTPS via rewrite)
 * - Local dev → configured API base (e.g. http://127.0.0.1:8000/...)
 * Legacy localhost/api.ezacore.ai absolute URLs are canonicalized first.
 */
export function resolveProfileAvatarDisplayUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const canonical = extractProfileAvatarCanonicalPath(trimmed);
  if (!canonical) return trimmed;

  const query = extractProfileAvatarQuery(trimmed);

  if (typeof window !== 'undefined' && isEzacoreFrontendHost(window.location.hostname)) {
    return `${canonical}${query}`;
  }

  const apiBase = getApiUrl().replace(/\/$/, '');
  return `${apiBase}${canonical}${query}`;
}

export function buildProfileAvatarDisplaySrc(
  url: string,
  cacheBust?: number | string
): string {
  const resolved = resolveProfileAvatarDisplayUrl(url);
  if (!resolved) return resolved;
  return cacheBust != null ? appendAvatarCacheBust(resolved, cacheBust) : resolved;
}
