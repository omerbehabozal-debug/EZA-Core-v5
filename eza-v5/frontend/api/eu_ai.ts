/**
 * EU AI Act API Client
 */

import { apiRequest } from './api_client';
import { MOCK_EU_MODELS, MOCK_EU_RISK_PROFILE } from '@/mock/eu_ai';
import type { EUModel, EURiskProfile } from '@/mock/eu_ai';

export interface EUModelApiResponse {
  id: number;
  model_name: string;
  version: string;
  risk_profile: Record<string, any> | null;
  provider: string | null;
  compliance_status: string | null;
  created_at: string;
}

export interface EURiskProfileApiResponse {
  risk_profile: Record<string, any>;
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

export async function fetchEUModels(provider?: string, compliance_status?: string): Promise<EUModel[]> {
  const params = new URLSearchParams();
  if (provider) params.append('provider', provider);
  if (compliance_status) params.append('compliance_status', compliance_status);
  const url = `/api/eu-ai/models${params.toString() ? `?${params.toString()}` : ''}`;
  return fetcher(url, MOCK_EU_MODELS);
}

export async function createEUModel(
  model_name: string,
  version: string,
  risk_profile?: Record<string, any>,
  provider?: string
): Promise<EUModel> {
  const requestBody = { model_name, version, risk_profile, provider };
  return fetcher('/api/eu-ai/models', MOCK_EU_MODELS[0] || {} as EUModel, 'POST', requestBody);
}

export async function fetchEURiskProfile(modelId: number): Promise<EURiskProfile> {
  return fetcher(`/api/eu-ai/risk-profile/${modelId}`, MOCK_EU_RISK_PROFILE);
}

