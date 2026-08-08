/**
 * Fetch public Mirror Network payload (no auth).
 */

import { getApiUrl } from '@/lib/apiUrl';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';
import {
  MirrorApiContractError,
  validatePublicMirrorBySlug,
} from '@/lib/eza/mirror/mirrorApiContracts';

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
    const validated = validatePublicMirrorBySlug(data);
    return { ok: true, data: { ...data, slug: validated.slug } };
  } catch (err) {
    if (err instanceof MirrorApiContractError) {
      return { ok: false, status: 502 };
    }
    return { ok: false, status: 502 };
  }
}
