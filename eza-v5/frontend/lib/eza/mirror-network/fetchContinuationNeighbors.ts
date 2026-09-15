/**
 * Slice 4 — public continuation neighbors client.
 * Server is authority. Never derive from parentSlug or /children.
 */

import { apiClient } from '@/lib/apiClient';

export type PublicContinuationNeighbor = {
  slug: string;
  journeyVersion: number;
};

export type ContinuationNeighborsResponse = {
  slug: string;
  journeyVersion: number;
  previous: PublicContinuationNeighbor | null;
  next: PublicContinuationNeighbor | null;
};

export type FetchContinuationNeighborsResult =
  | { ok: true; data: ContinuationNeighborsResponse }
  | { ok: false; status: number };

function parseNeighbor(raw: unknown): PublicContinuationNeighbor | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const slug = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
  const journeyVersion =
    typeof row.journeyVersion === 'number' &&
    Number.isInteger(row.journeyVersion) &&
    row.journeyVersion >= 1
      ? row.journeyVersion
      : null;
  if (!slug || journeyVersion == null) return null;
  return { slug, journeyVersion };
}

export async function fetchContinuationNeighbors(
  slug: string
): Promise<FetchContinuationNeighborsResult> {
  const key = (slug || '').trim().toLowerCase();
  if (!key) return { ok: false, status: 400 };
  const response = await apiClient.get<ContinuationNeighborsResponse>(
    `/api/mirror-network/${encodeURIComponent(key)}/continuation-neighbors`,
    { timeoutMs: 15_000 }
  );
  if (!response || !response.ok) {
    return { ok: false, status: (response && response.status) || 500 };
  }
  const data = (response.data ?? response) as ContinuationNeighborsResponse;
  if (typeof data.slug !== 'string' || !data.slug.trim()) {
    return { ok: false, status: 500 };
  }
  const journeyVersion =
    typeof data.journeyVersion === 'number' &&
    Number.isInteger(data.journeyVersion) &&
    data.journeyVersion >= 1
      ? data.journeyVersion
      : 1;
  return {
    ok: true,
    data: {
      slug: data.slug.trim().toLowerCase(),
      journeyVersion,
      previous: parseNeighbor(data.previous),
      next: parseNeighbor(data.next),
    },
  };
}
