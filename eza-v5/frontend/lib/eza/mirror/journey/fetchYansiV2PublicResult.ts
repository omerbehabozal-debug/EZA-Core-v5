/**
 * Status-aware V2 public fetch for /m SSR (07F).
 * Distinguishes missing (404) from temporary upstream failures (5xx / network).
 */

import { buildApiUrl } from '@/lib/apiUrl';
import {
  parseYansiV2PublicPublication,
  type YansiV2PublicPublication,
} from '@/lib/eza/mirror/journey/fetchYansiV2Public';

export type FetchYansiV2PublicResult =
  | { ok: true; data: YansiV2PublicPublication }
  | { ok: false; status: number };

export async function fetchYansiV2PublicPublicationResult(input: {
  slug: string;
  publicationVersion?: number | null;
}): Promise<FetchYansiV2PublicResult> {
  const slug = (input.slug || '').trim().toLowerCase();
  if (!slug) {
    return { ok: false, status: 404 };
  }
  const version =
    input.publicationVersion != null &&
    Number.isInteger(input.publicationVersion) &&
    input.publicationVersion >= 1
      ? input.publicationVersion
      : null;
  const path =
    version != null
      ? `/api/business-yansi/v2/public/${encodeURIComponent(slug)}/versions/${version}`
      : `/api/business-yansi/v2/public/${encodeURIComponent(slug)}`;
  const url = buildApiUrl(path);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 404) {
      return { ok: false, status: 404 };
    }
    if (!response.ok) {
      return { ok: false, status: response.status || 502 };
    }
    const parsed = parseYansiV2PublicPublication(await response.json());
    if (!parsed) {
      return { ok: false, status: 502 };
    }
    // Pinned version must match — never silently accept a different version body.
    if (version != null && parsed.publicationVersion !== version) {
      return { ok: false, status: 404 };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, status: 502 };
  }
}
