/**
 * Owner-only Mirror Network impact stats (Faz 2 — Yansı).
 */

import { apiClient } from '@/lib/apiClient';

export type MirrorNetworkImpactStats = {
  mirrorId: string;
  publicSlug: string;
  shareUrl: string;
  continuationStarts: number;
  continuationStartsVerified: boolean;
  yansiCount: number;
  landingViews: number;
};

const IMPACT_ALLOWLIST = new Set([
  'mirrorId',
  'publicSlug',
  'shareUrl',
  'continuationStarts',
  'continuationStartsVerified',
  'yansiCount',
  'landingViews',
]);

export function isMirrorImpactStats(value: unknown): value is MirrorNetworkImpactStats {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!Object.keys(row).every((key) => IMPACT_ALLOWLIST.has(key))) return false;
  return (
    typeof row.mirrorId === 'string' &&
    typeof row.publicSlug === 'string' &&
    typeof row.shareUrl === 'string' &&
    typeof row.continuationStarts === 'number' &&
    typeof row.continuationStartsVerified === 'boolean' &&
    typeof row.yansiCount === 'number' &&
    typeof row.landingViews === 'number'
  );
}

export async function fetchMirrorImpact(
  slug: string
): Promise<{ ok: true; data: MirrorNetworkImpactStats } | { ok: false }> {
  const normalized = slug.trim();
  if (!normalized) return { ok: false };

  const response = await apiClient.get<MirrorNetworkImpactStats>(
    `/api/mirror-network/${encodeURIComponent(normalized)}/impact`,
    { auth: true, timeoutMs: 15_000 }
  );

  if (!response.ok || !isMirrorImpactStats(response.data)) {
    return { ok: false };
  }

  return { ok: true, data: response.data };
}
