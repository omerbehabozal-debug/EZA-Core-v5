/** Bust CDN/browser cache after avatar replace (same durable filename). */
export function appendAvatarCacheBust(url: string, version?: number | string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const token = version ?? Date.now();
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(String(token))}`;
}
