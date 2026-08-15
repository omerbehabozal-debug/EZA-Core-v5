/**
 * Phase 6.1/6.2 — public Yansı aggregate metrics helper.
 *
 * experienceStartedCount = distinct STARTED sessions (“N deneyim”).
 * directChildYansiCount = eligible direct published children (“N Yansı”).
 *
 * Phase 6.2 UI consumes only those two counts via formatYansiPublicSocialProof.
 */

import { apiClient } from '@/lib/apiClient';

export type YansiPublicMetrics = {
  slug: string;
  journeyVersion: number;
  experienceStartedCount: number;
  experienceCompletedCount: number;
  experienceSkippedSessionCount: number;
  completionRate: number | null;
  skipRate: number | null;
  observedAverageDepth: number | null;
  directChildYansiCount: number;
};

const PUBLIC_METRIC_KEYS = new Set([
  'slug',
  'journeyVersion',
  'experienceStartedCount',
  'experienceCompletedCount',
  'experienceSkippedSessionCount',
  'completionRate',
  'skipRate',
  'observedAverageDepth',
  'directChildYansiCount',
]);

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRate(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isYansiPublicMetrics(value: unknown): value is YansiPublicMetrics {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!Object.keys(row).every((key) => PUBLIC_METRIC_KEYS.has(key))) return false;
  return (
    typeof row.slug === 'string' &&
    isNonNegativeInt(row.journeyVersion) &&
    row.journeyVersion >= 1 &&
    isNonNegativeInt(row.experienceStartedCount) &&
    isNonNegativeInt(row.experienceCompletedCount) &&
    isNonNegativeInt(row.experienceSkippedSessionCount) &&
    isRate(row.completionRate) &&
    isRate(row.skipRate) &&
    (row.observedAverageDepth === null ||
      (typeof row.observedAverageDepth === 'number' &&
        Number.isFinite(row.observedAverageDepth) &&
        row.observedAverageDepth >= 0)) &&
    isNonNegativeInt(row.directChildYansiCount)
  );
}

const metricsCache = new Map<
  string,
  { ok: true; data: YansiPublicMetrics } | { ok: false }
>();
const metricsInflight = new Map<
  string,
  Promise<{ ok: true; data: YansiPublicMetrics } | { ok: false }>
>();

export function yansiPublicMetricsCacheKey(
  slug: string,
  journeyVersion?: number
): string {
  const s = slug.trim().toLowerCase();
  return typeof journeyVersion === 'number' ? `${s}:v${journeyVersion}` : `${s}:current`;
}

export function clearYansiPublicMetricsCacheForTests(): void {
  metricsCache.clear();
  metricsInflight.clear();
}

export function yansiMetricsMatchPresentedVersion(
  data: YansiPublicMetrics,
  slug: string,
  journeyVersion: number
): boolean {
  return (
    data.slug.trim().toLowerCase() === slug.trim().toLowerCase() &&
    data.journeyVersion === journeyVersion
  );
}

export async function fetchYansiPublicMetrics(
  slug: string,
  journeyVersion?: number
): Promise<{ ok: true; data: YansiPublicMetrics } | { ok: false }> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return { ok: false };
  const key = yansiPublicMetricsCacheKey(normalized, journeyVersion);
  const cached = metricsCache.get(key);
  if (cached) return cached;
  const pending = metricsInflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const params =
      typeof journeyVersion === 'number'
        ? { journeyVersion: String(journeyVersion) }
        : undefined;
    try {
      const response = await apiClient.get<YansiPublicMetrics>(
        `/api/mirror-network/${encodeURIComponent(normalized)}/metrics`,
        { auth: false, timeoutMs: 15_000, params }
      );
      if (!response.ok || !isYansiPublicMetrics(response.data)) {
        const fail = { ok: false as const };
        metricsCache.set(key, fail);
        return fail;
      }
      const ok = { ok: true as const, data: response.data };
      metricsCache.set(key, ok);
      return ok;
    } catch {
      const fail = { ok: false as const };
      metricsCache.set(key, fail);
      return fail;
    } finally {
      metricsInflight.delete(key);
    }
  })();

  metricsInflight.set(key, request);
  return request;
}
