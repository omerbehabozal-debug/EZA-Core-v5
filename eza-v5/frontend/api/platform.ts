/**
 * Platform API Client
 */

import { apiRequest } from './api_client';
import { MOCK_PLATFORM_API_KEYS, MOCK_PLATFORM_CONTENT, MOCK_PLATFORM_TREND } from '@/mock/platform';
import type { ApiKey, ContentItem } from '@/lib/types';
import type { TrendData } from '@/mock/platform';

/**
 * Fetch platform API keys
 * TODO: Connect real backend endpoint when available
 */
export async function fetchPlatformApiKeys(): Promise<ApiKey[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<ApiKey[]>('/api/institution/api-keys', 'GET');
    // return response;
    
    console.info('[Mock Mode] fetchPlatformApiKeys');
    return MOCK_PLATFORM_API_KEYS;
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using fallback data');
    return MOCK_PLATFORM_API_KEYS;
  }
}

/**
 * Generate new API key
 * TODO: Connect real backend endpoint when available
 */
export async function generateApiKey(name: string): Promise<ApiKey> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<ApiKey>('/api/institution/api-keys', 'POST', { name });
    // return response;
    
    console.info(`[Mock Mode] generateApiKey: ${name}`);
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name,
      key: `eza_live_sk_${Math.random().toString(36).substring(7)}`,
      created_at: new Date().toISOString(),
      status: 'active',
    };
    return newKey;
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using mock generation');
    throw error;
  }
}

/**
 * Revoke API key
 * TODO: Connect real backend endpoint when available
 */
export async function revokeApiKey(id: string): Promise<void> {
  try {
    // TODO: Replace with real endpoint
    // await apiRequest(`/api/institution/api-keys/${id}`, 'DELETE');
    
    console.info(`[Mock Mode] revokeApiKey: ${id}`);
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using mock revoke');
  }
}

/**
 * Fetch platform content stream
 * TODO: Connect real backend endpoint when available
 */
export async function fetchPlatformContent(): Promise<ContentItem[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<ContentItem[]>('/api/platform/content', 'GET');
    // return response;
    
    console.info('[Mock Mode] fetchPlatformContent');
    return MOCK_PLATFORM_CONTENT;
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using fallback data');
    return MOCK_PLATFORM_CONTENT;
  }
}

/**
 * Fetch platform trend data
 * TODO: Connect real backend endpoint when available
 */
export async function fetchPlatformTrend(): Promise<TrendData[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<TrendData[]>('/api/platform/trend', 'GET');
    // return response;
    
    console.info('[Mock Mode] fetchPlatformTrend');
    return MOCK_PLATFORM_TREND;
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using fallback data');
    return MOCK_PLATFORM_TREND;
  }
}

