/**
 * Phase 8.4 — owner unpublish / visibility + authenticated report clients.
 */

import { apiClient } from '@/lib/apiClient';

export type YansiReportReason = 'inappropriate' | 'misleading' | 'privacy' | 'other';

export const YANSI_REPORT_REASONS: { id: YansiReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'Uygunsuz içerik' },
  { id: 'misleading', label: 'Yanıltıcı' },
  { id: 'privacy', label: 'Gizlilik' },
  { id: 'other', label: 'Diğer' },
];

export async function reportYansi(
  slug: string,
  reason: YansiReportReason
): Promise<{ ok: true; status: string } | { ok: false; code: string }> {
  const res = await apiClient.post<{ status?: string }>(
    `/api/mirror-network/${encodeURIComponent(slug)}/report`,
    { body: { reason }, auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'report_failed'),
    };
  }
  return { ok: true, status: String(res.status || res.data?.status || 'created') };
}

export async function unpublishYansi(
  slug: string
): Promise<{ ok: true; status: string } | { ok: false; code: string }> {
  const res = await apiClient.post<{ status?: string }>(
    `/api/mirror-network/${encodeURIComponent(slug)}/unpublish`,
    { body: {}, auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'unpublish_failed'),
    };
  }
  return { ok: true, status: String(res.status || res.data?.status || 'unpublished') };
}

export async function setYansiVisibility(
  slug: string,
  visibility: 'public' | 'unlisted'
): Promise<{ ok: true; status: string } | { ok: false; code: string }> {
  const res = await apiClient.post<{ status?: string }>(
    `/api/mirror-network/${encodeURIComponent(slug)}/visibility`,
    { body: { visibility }, auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'visibility_failed'),
    };
  }
  return { ok: true, status: String(res.status || res.data?.status || 'updated') };
}
