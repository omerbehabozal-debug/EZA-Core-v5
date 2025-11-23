/**
 * Corporate API Client
 */

import { apiRequest } from './api_client';
import { MOCK_CORPORATE_AUDIT, MOCK_CORPORATE_POLICY } from '@/mock/corporate';
import type { CorporateAudit, PolicyConfig } from '@/lib/types';

export interface CorporateAuditApiResponse {
  id: number;
  endpoint: string;
  method: string;
  risk_score: number | null;
  eza_score: number | null;
  action_taken: string | null;
  created_at: string;
}

export interface CorporatePolicyApiResponse {
  id: number;
  tenant: string;
  rules: Record<string, any>;
  policy_type: string;
  is_active: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyUpdateRequest {
  rules: Record<string, any>;
  policy_type?: string;
}

const fetcher = async <T>(url: string, fallback: T, method: string = 'GET', body?: any): Promise<T> => {
  try {
    const response = await apiRequest<T>(url, method, body);
    return response;
  } catch (error) {
    console.info(`[Preview Mode] Backend unavailable for ${url}, using fallback data`);
    return fallback;
  }
};

export async function fetchCorporateAudit(limit: number = 100, offset: number = 0): Promise<CorporateAudit[]> {
  const url = `/api/corporate/audit?limit=${limit}&offset=${offset}`;
  // Create mock API response format
  const mockApiResponse: CorporateAuditApiResponse[] = MOCK_CORPORATE_AUDIT.map(audit => ({
    id: parseInt(audit.id),
    endpoint: audit.ai_agent,
    method: 'POST',
    risk_score: audit.risk_score,
    eza_score: audit.risk_score,
    action_taken: audit.status === 'flagged' ? 'blocked' : null,
    created_at: audit.timestamp,
  }));
  const response = await fetcher<CorporateAuditApiResponse[]>(url, mockApiResponse);
  return response.map(audit => ({
    id: audit.id.toString(),
    ai_agent: audit.endpoint,
    risk_score: audit.risk_score || 0,
    flags: audit.action_taken ? [audit.action_taken] : [],
    reviewer: 'System',
    status: audit.action_taken === 'blocked' ? 'flagged' : 'approved' as const,
    timestamp: audit.created_at,
  }));
}

export async function fetchCorporatePolicy(tenant: string): Promise<PolicyConfig> {
  const url = `/api/corporate/policy?tenant=${tenant}`;
  // Create mock API response format
  const mockApiResponse: CorporatePolicyApiResponse = {
    id: 1,
    tenant: tenant,
    rules: {
      high_risk_topics: MOCK_CORPORATE_POLICY.high_risk_topics || [],
      illegal_use_cases: MOCK_CORPORATE_POLICY.illegal_use_cases || [],
      custom_rules: MOCK_CORPORATE_POLICY.custom_rules || [],
    },
    policy_type: 'default',
    is_active: 'true',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const response = await fetcher<CorporatePolicyApiResponse>(url, mockApiResponse);
  return {
    high_risk_topics: response.rules.high_risk_topics || [],
    illegal_use_cases: response.rules.illegal_use_cases || [],
    custom_rules: response.rules.custom_rules || [],
  };
}

export async function updateCorporatePolicy(
  tenant: string,
  rules: Record<string, any>,
  policy_type: string = 'default'
): Promise<PolicyConfig> {
  const url = `/api/corporate/policy?tenant=${tenant}`;
  const requestBody: PolicyUpdateRequest = { rules, policy_type };
  // Create mock API response format
  const mockApiResponse: CorporatePolicyApiResponse = {
    id: 1,
    tenant: tenant,
    rules: {
      high_risk_topics: rules.high_risk_topics || MOCK_CORPORATE_POLICY.high_risk_topics || [],
      illegal_use_cases: rules.illegal_use_cases || MOCK_CORPORATE_POLICY.illegal_use_cases || [],
      custom_rules: rules.custom_rules || MOCK_CORPORATE_POLICY.custom_rules || [],
    },
    policy_type: policy_type,
    is_active: 'true',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const response = await fetcher<CorporatePolicyApiResponse>(url, mockApiResponse, 'POST', requestBody);
  return {
    high_risk_topics: response.rules.high_risk_topics || [],
    illegal_use_cases: response.rules.illegal_use_cases || [],
    custom_rules: response.rules.custom_rules || [],
  };
}
