/**
 * Corporate API Client
 */

import { apiRequest } from './api_client';
import { MOCK_CORPORATE_AUDITS } from '@/mock/corporate';
import type { CorporateAudit } from '@/lib/types';

/**
 * Fetch corporate audits
 * TODO: Connect real backend endpoint when available
 */
export async function fetchCorporateAudits(): Promise<CorporateAudit[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<CorporateAudit[]>('/api/corporate/audits', 'GET');
    // return response;
    
    console.info('[Mock Mode] fetchCorporateAudits');
    return MOCK_CORPORATE_AUDITS;
  } catch (error) {
    console.info('[Mock Mode] Backend unavailable, using fallback data');
    return MOCK_CORPORATE_AUDITS;
  }
}

