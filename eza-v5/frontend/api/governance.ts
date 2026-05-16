/**
 * Admin governance & universal events API client.
 */

import { apiClient, type ApiResponse } from '@/lib/apiClient';
import type {
  CalibrationSummary,
  EngineReliabilityReport,
  EventDetail,
  EventsListResponse,
  GovernanceOverview,
  ListEventsParams,
  WeeklyCalibrationReport,
} from '@/lib/types/governance';

export class GovernanceApiError extends Error {
  code?: string;
  statusHint?: number;

  constructor(message: string, code?: string, statusHint?: number) {
    super(message);
    this.name = 'GovernanceApiError';
    this.code = code;
    this.statusHint = statusHint;
  }
}

function orgHeaders(orgId: string): Record<string, string> {
  return { 'x-org-id': orgId };
}

function unwrap<T>(res: ApiResponse<T>): T {
  if (res.ok === false || res.error) {
    const msg =
      res.error?.error_message ||
      res.error?.message ||
      (typeof res.error === 'string' ? res.error : 'İstek başarısız');
    const code = res.error?.error_code || res.error?.error;
    let statusHint: number | undefined;
    if (code === 'HTTP_403' || msg.toLowerCase().includes('cross-org')) {
      statusHint = 403;
    }
    if (code === 'HTTP_400' || msg.toLowerCase().includes('x-org-id')) {
      statusHint = 400;
    }
    throw new GovernanceApiError(msg, code, statusHint);
  }
  const { ok: _ok, error: _err, data: _data, ...rest } = res as ApiResponse<T> & Record<string, unknown>;
  return rest as T;
}

export async function getGovernanceOverview(orgId: string): Promise<GovernanceOverview> {
  const res = await apiClient.get<GovernanceOverview>('/api/admin/governance/overview', {
    auth: true,
    headers: orgHeaders(orgId),
  });
  return unwrap(res);
}

export async function getEngineReliability(
  orgId: string,
  days = 30
): Promise<EngineReliabilityReport> {
  const res = await apiClient.get<EngineReliabilityReport>(
    '/api/admin/governance/engine-reliability',
    {
      auth: true,
      headers: orgHeaders(orgId),
      params: { days: String(days) },
    }
  );
  return unwrap(res);
}

export async function getCalibrationSummary(
  orgId: string,
  weeks = 8
): Promise<CalibrationSummary> {
  const res = await apiClient.get<CalibrationSummary>(
    '/api/admin/governance/calibration-summary',
    {
      auth: true,
      headers: orgHeaders(orgId),
      params: { weeks: String(weeks) },
    }
  );
  return unwrap(res);
}

export async function getWeeklyCalibrationReport(
  orgId: string,
  weeks = 1
): Promise<WeeklyCalibrationReport> {
  const res = await apiClient.get<WeeklyCalibrationReport>(
    '/api/admin/governance/weekly-calibration-report',
    {
      auth: true,
      headers: orgHeaders(orgId),
      params: { weeks: String(weeks) },
    }
  );
  return unwrap(res);
}

export async function listAdminEvents(
  orgId: string,
  params: ListEventsParams = {}
): Promise<EventsListResponse> {
  const query: Record<string, string> = {};
  if (params.days != null) query.days = String(params.days);
  if (params.limit != null) query.limit = String(params.limit);
  if (params.source_mode) query.source_mode = params.source_mode;
  if (params.entity_type) query.entity_type = params.entity_type;
  if (params.event_type) query.event_type = params.event_type;
  if (params.user_id) query.user_id = params.user_id;

  const res = await apiClient.get<EventsListResponse>('/api/admin/events', {
    auth: true,
    headers: orgHeaders(orgId),
    params: query,
  });
  return unwrap(res);
}

export async function getAdminEventDetail(
  orgId: string,
  eventId: string
): Promise<EventDetail> {
  const res = await apiClient.get<EventDetail>(`/api/admin/events/${eventId}`, {
    auth: true,
    headers: orgHeaders(orgId),
  });
  return unwrap(res);
}
