/**
 * Fetch public Mirror Network payload (no auth).
 */

import { getApiUrl } from '@/lib/apiUrl';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';

export type FetchPublicMirrorResult =
  | { ok: true; data: MirrorNetworkPublicApiResponse }
  | { ok: false; status: number };

export async function fetchPublicMirrorBySlug(
  slug: string,
  options?: { revalidateSeconds?: number }
): Promise<FetchPublicMirrorResult> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, status: 404 };
  }

  const base = getApiUrl().replace(/\/$/, '');
  const url = `${base}/api/mirror-network/${encodeURIComponent(normalized)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: options?.revalidateSeconds ?? 120 },
    });

    if (response.status === 404) {
      return { ok: false, status: 404 };
    }

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const data = (await response.json()) as MirrorNetworkPublicApiResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502 };
  }
}
