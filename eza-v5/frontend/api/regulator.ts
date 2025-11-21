/**
 * Regulator API Client
 */

import { apiRequest } from './api_client';
import { MOCK_REGULATOR_CASES, MOCK_REGULATOR_RISK_MATRIX, MOCK_REGULATOR_AUDIT_LOGS } from '@/mock/regulator';
import type { RegulatorCase, RiskMatrixData, AuditLog } from '@/mock/regulator';

/**
 * Fetch regulator cases
 * TODO: Connect real backend endpoint when available
 */
export async function fetchRegulatorCases(tenantId: string): Promise<RegulatorCase[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<RegulatorCase[]>(`/api/regulator/${tenantId}/cases`, 'GET');
    // return response;
    
    console.info(`[Mock Mode] fetchRegulatorCases for tenant: ${tenantId}`);
    return MOCK_REGULATOR_CASES;
  } catch (error) {
    console.info(`[Mock Mode] Backend unavailable, using fallback data for tenant: ${tenantId}`);
    return MOCK_REGULATOR_CASES;
  }
}

/**
 * Fetch regulator risk matrix
 * TODO: Connect real backend endpoint when available
 */
export async function fetchRegulatorRiskMatrix(tenantId: string): Promise<RiskMatrixData[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<RiskMatrixData[]>(`/api/regulator/${tenantId}/risk-matrix`, 'GET');
    // return response;
    
    console.info(`[Mock Mode] fetchRegulatorRiskMatrix for tenant: ${tenantId}`);
    return MOCK_REGULATOR_RISK_MATRIX;
  } catch (error) {
    console.info(`[Mock Mode] Backend unavailable, using fallback data for tenant: ${tenantId}`);
    return MOCK_REGULATOR_RISK_MATRIX;
  }
}

/**
 * Fetch regulator audit logs
 * TODO: Connect real backend endpoint when available
 */
export async function fetchRegulatorAuditLogs(tenantId: string): Promise<AuditLog[]> {
  try {
    // TODO: Replace with real endpoint
    // const response = await apiRequest<AuditLog[]>(`/api/regulator/${tenantId}/audit-logs`, 'GET');
    // return response;
    
    console.info(`[Mock Mode] fetchRegulatorAuditLogs for tenant: ${tenantId}`);
    return MOCK_REGULATOR_AUDIT_LOGS;
  } catch (error) {
    console.info(`[Mock Mode] Backend unavailable, using fallback data for tenant: ${tenantId}`);
    return MOCK_REGULATOR_AUDIT_LOGS;
  }
}

