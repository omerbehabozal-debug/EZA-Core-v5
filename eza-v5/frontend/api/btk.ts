/**
 * BTK API Client
 */

import { apiRequest } from './api_client';
import { MOCK_TRAFFIC_RISK, MOCK_BTK_AUDIT_LOG } from '@/mock/btk';
import type { TrafficRiskRequest, TrafficRiskResponse, BTKAuditLogResponse } from '@/mock/btk';

const fetcher = async <T>(url: string, fallback: T, method: string = 'GET', body?: any): Promise<T> => {
  try {
    const response = await apiRequest<T>(url, method, body);
    return response;
  } catch (error) {
    console.info(`[Preview Mode] Backend unavailable for ${url}, using fallback data`);
    return fallback;
  }
};

export async function fetchTrafficRisk(text: string, metadata?: Record<string, any>): Promise<TrafficRiskResponse> {
  const requestBody: TrafficRiskRequest = { text, metadata };
  return fetcher('/api/btk/traffic-risk', MOCK_TRAFFIC_RISK, 'POST', requestBody);
}

export async function fetchBTKAuditLog(endpoint?: string, limit: number = 100, offset: number = 0): Promise<BTKAuditLogResponse[]> {
  const params = new URLSearchParams();
  if (endpoint) params.append('endpoint', endpoint);
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  const url = `/api/btk/audit-log?${params.toString()}`;
  return fetcher(url, MOCK_BTK_AUDIT_LOG);
}

