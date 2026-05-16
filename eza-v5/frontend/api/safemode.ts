/**
 * Safe Mode API client (JWT user scope).
 */

import { apiClient, type ApiResponse } from '@/lib/apiClient';
import type {
  SafeModeFeedbackPayload,
  SafeModeFeedbackResponse,
  SafeModeInsight,
  SafeModeReport,
  SafeModeReportPeriod,
  SafeModeTrend,
} from '@/lib/types/safemode';

export class SafeModeApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SafeModeApiError';
    this.code = code;
  }
}

function unwrap<T>(res: ApiResponse<T>): T {
  if (res.ok === false || res.error) {
    const msg =
      res.error?.error_message ||
      res.error?.message ||
      (typeof res.error === 'string' ? res.error : 'İstek başarısız');
    throw new SafeModeApiError(msg, res.error?.error_code);
  }
  const { ok: _ok, error: _err, data: _data, ...rest } = res as ApiResponse<T> & Record<string, unknown>;
  return rest as T;
}

function optionalOrgHeaders(orgId?: string | null): Record<string, string> | undefined {
  if (!orgId) return undefined;
  return { 'x-org-id': orgId };
}

export async function getSafeModeTrend(): Promise<SafeModeTrend> {
  const res = await apiClient.get<SafeModeTrend>('/api/safemode/me/trend', { auth: true });
  return unwrap(res);
}

export async function getSafeModeInsight(): Promise<SafeModeInsight> {
  const res = await apiClient.get<SafeModeInsight>('/api/safemode/me/insight', { auth: true });
  return unwrap(res);
}

export async function getSafeModeReport(
  period: SafeModeReportPeriod = 'weekly'
): Promise<SafeModeReport> {
  const res = await apiClient.get<SafeModeReport>('/api/safemode/me/report', {
    auth: true,
    params: { period },
  });
  return unwrap(res);
}

export async function postSafeModeFeedback(
  payload: SafeModeFeedbackPayload,
  orgId?: string | null
): Promise<SafeModeFeedbackResponse> {
  const headers = optionalOrgHeaders(orgId);
  const res = await apiClient.post<SafeModeFeedbackResponse>('/api/safemode/feedback', {
    auth: true,
    body: payload,
    headers,
  });
  return unwrap(res);
}
