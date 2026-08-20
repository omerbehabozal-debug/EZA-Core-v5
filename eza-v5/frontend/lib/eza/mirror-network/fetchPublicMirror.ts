/**
 * Fetch public Mirror Network payload (no auth).
 *
 * Phase 8.4.1 — trust-authoritative by default: no Next/HTTP cache so
 * withdrawn / private / restricted Yansı cannot linger after state change.
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

export type FetchPublicMirrorOptions = {
  /**
   * @deprecated Ignored for trust-authoritative fetches (Phase 8.4.1).
   * Public slug visibility always uses cache: 'no-store'.
   */
  revalidateSeconds?: number;
  /**
   * When true (default), bypass caches. Set false only for non-trust probes.
   */
  trustAuthoritative?: boolean;
};

export async function fetchPublicMirrorBySlug(
  slug: string,
  options?: FetchPublicMirrorOptions
): Promise<FetchPublicMirrorResult> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, status: 404 };
  }

  const base = getApiUrl().replace(/\/$/, '');
  const url = `${base}/api/mirror-network/${encodeURIComponent(normalized)}`;
  const trustAuthoritative = options?.trustAuthoritative !== false;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(trustAuthoritative
        ? { cache: 'no-store' as RequestCache, next: { revalidate: 0 } }
        : {
            next: {
              revalidate:
                typeof options?.revalidateSeconds === 'number'
                  ? options.revalidateSeconds
                  : 120,
            },
          }),
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
