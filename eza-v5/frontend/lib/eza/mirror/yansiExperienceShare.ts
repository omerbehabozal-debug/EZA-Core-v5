/**
 * Desktop Yansı experience share — canonical /m/{slug} only.
 */

import { copyShareText } from '@/lib/eza/standaloneShare';
import {
  buildMirrorPublicPath,
  buildMirrorPublicShareUrl,
} from '@/lib/eza/mirror-network/mirrorPublicUrl';

export type YansiExperienceShareResult = 'shared' | 'copied' | 'failed';

export function resolveCanonicalYansiShareUrl(slug: string): string | null {
  const safe = slug.trim();
  if (!safe) return null;
  const path = buildMirrorPublicPath(safe);
  if (path.includes('/sohbet') || path.includes('/yansilar') || path.includes('/standalone')) {
    return null;
  }
  if (!path.startsWith('/m/') || path === '/m/') return null;
  return buildMirrorPublicShareUrl(safe);
}

export async function sharePublishedYansi(slug: string): Promise<YansiExperienceShareResult> {
  const url = resolveCanonicalYansiShareUrl(slug);
  if (!url) return 'failed';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Yansı', url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'failed';
    }
  }
  const copied = await copyShareText(url);
  return copied ? 'copied' : 'failed';
}
