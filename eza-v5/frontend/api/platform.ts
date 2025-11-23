/**
 * Platform API Client
 */

import { apiRequest } from './api_client';
import { MOCK_PLATFORM_API_KEYS, MOCK_PLATFORM_STREAM } from '@/mock/platform';
import type { ApiKey, ContentItem } from '@/lib/types';

export interface ApiKeyApiResponse {
  id: number;
  name: string;
  key?: string;
  user_id: number;
  institution_id: number | null;
  application_id: number | null;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface StreamItemApiResponse {
  id: string;
  content: string;
  risk_score: number;
  timestamp: string;
}

export interface ApiKeyCreateRequest {
  name: string;
  user_id: number;
  institution_id?: number | null;
  application_id?: number | null;
  expires_days?: number | null;
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

export async function fetchApiKeys(user_id?: number, institution_id?: number): Promise<ApiKey[]> {
  const params = new URLSearchParams();
  if (user_id) params.append('user_id', user_id.toString());
  if (institution_id) params.append('institution_id', institution_id.toString());
  const url = `/api/platform/api-keys${params.toString() ? `?${params.toString()}` : ''}`;
  // Create mock API response format
  const mockApiResponse: ApiKeyApiResponse[] = MOCK_PLATFORM_API_KEYS.map((key, index) => ({
    id: parseInt(key.id) || index + 1,
    name: key.name,
    key: key.key,
    user_id: user_id || 1,
    institution_id: institution_id || null,
    application_id: null,
    is_active: key.status === 'active',
    last_used_at: key.last_used || null,
    expires_at: null,
    created_at: key.created_at,
  }));
  const response = await fetcher<ApiKeyApiResponse[]>(url, mockApiResponse);
  return response.map(key => ({
    id: key.id.toString(),
    name: key.name,
    key: key.key || '',
    created_at: key.created_at,
    last_used: key.last_used_at || undefined,
    status: key.is_active ? 'active' : 'revoked' as const,
  }));
}

export async function generateApiKey(
  name: string,
  user_id: number,
  institution_id?: number,
  application_id?: number,
  expires_days?: number
): Promise<ApiKey> {
  const requestBody: ApiKeyCreateRequest = { name, user_id, institution_id, application_id, expires_days };
  // Create mock API response format
  const mockKey = MOCK_PLATFORM_API_KEYS[0] || {
    id: '1',
    name: 'New Key',
    key: 'eza_new_sk_test_1234567890',
    created_at: new Date().toISOString(),
    status: 'active' as const,
  };
  const mockApiResponse: ApiKeyApiResponse = {
    id: parseInt(mockKey.id) || 1,
    name: name || mockKey.name,
    key: mockKey.key,
    user_id: user_id,
    institution_id: institution_id || null,
    application_id: application_id || null,
    is_active: true,
    last_used_at: null,
    expires_at: expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : null,
    created_at: new Date().toISOString(),
  };
  const response = await fetcher<ApiKeyApiResponse>('/api/platform/api-keys', mockApiResponse, 'POST', requestBody);
  return {
    id: response.id.toString(),
    name: response.name,
    key: response.key || '',
    created_at: response.created_at,
    status: response.is_active ? 'active' : 'revoked' as const,
  };
}

export async function revokeApiKey(api_key_id: number): Promise<void> {
  await fetcher(`/api/platform/api-keys/${api_key_id}`, null, 'DELETE');
}

export async function fetchContentStream(limit: number = 50): Promise<ContentItem[]> {
  const url = `/api/platform/stream?limit=${limit}`;
  // Create mock API response format
  const mockApiResponse: StreamItemApiResponse[] = MOCK_PLATFORM_STREAM.map(item => ({
    id: item.id,
    content: item.content,
    risk_score: item.score,
    timestamp: item.timestamp,
  }));
  const response = await fetcher<StreamItemApiResponse[]>(url, mockApiResponse);
  return response.map(item => ({
    id: item.id,
    content: item.content,
    score: item.risk_score,
    risk_level: item.risk_score >= 0.7 ? 'high' : item.risk_score >= 0.4 ? 'medium' : 'low' as const,
    timestamp: item.timestamp,
  }));
}
