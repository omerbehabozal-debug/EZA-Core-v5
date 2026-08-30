/** Bust CDN/browser cache after avatar replace (same durable filename). */
import { isEzacoreFrontendHost } from '@/lib/apiUrl';

export function appendAvatarCacheBust(url: string, version?: number | string): string {
  const trimmed = url.trim();
  if (!trimmed || version == null) return trimmed;
  const token = version;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(String(token))}`;
}

/** Route durable avatar assets through same-origin /api on *.ezacore.ai. */
export function resolveProfileAvatarDisplayUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (typeof window !== 'undefined' && isEzacoreFrontendHost(window.location.hostname)) {
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (
        (parsed.hostname === 'api.ezacore.ai' || parsed.hostname === window.location.hostname) &&
        parsed.pathname.startsWith('/api/public/profile-avatars/')
      ) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      /* keep original */
    }
  }

  return trimmed;
}

export function buildProfileAvatarDisplaySrc(
  url: string,
  cacheBust?: number | string
): string {
  const resolved = resolveProfileAvatarDisplayUrl(url);
  if (!resolved) return resolved;
  return cacheBust != null ? appendAvatarCacheBust(resolved, cacheBust) : resolved;
}
