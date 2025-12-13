/**
 * Regulator API Client (RTÜK)
 */

import { apiRequest } from './api_client';
import { MOCK_REGULATOR_CASES, MOCK_REGULATOR_RISK_MATRIX, MOCK_REGULATOR_REPORTS } from '@/mock/regulator';
import type { RegulatorCase, RiskMatrixResponse, ReportResponse } from '@/mock/regulator';

export interface RegulatorCaseResponse {
  id: number;
  text: string;
  risk_score: number;
  risk_level: string;
  source: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface RiskMatrixApiResponse {
  matrix: Array<Array<{
    count: number;
    percentage: number;
    severity: string;
    likelihood: string;
  }>>;
  total_cases: number;
  summary: Record<string, number>;
}

export interface ReportApiResponse {
  metadata: {
    report_type: string;
    generated_at: string;
    total_cases: number;
    statistics: Record<string, any>;
    format: string;
  };
  content: {
    summary: string;
    recommendations: string[];
    high_risk_cases: any[];
    case_summary: any[];
  };
}

const fetcher = async <T>(url: string, fallback: T): Promise<T> => {
  try {
    const response = await apiRequest<T>(url, 'GET');
    return response;
  } catch (error) {
    console.info(`[Preview Mode] Backend unavailable for ${url}, using fallback data`);
    return fallback;
  }
};

export async function fetchRegulatorCases(): Promise<RegulatorCase[]> {
  return fetcher('/api/regulator/cases', MOCK_REGULATOR_CASES);
}

export async function fetchRegulatorRiskMatrix(): Promise<RiskMatrixResponse> {
  return fetcher('/api/regulator/risk-matrix', MOCK_REGULATOR_RISK_MATRIX);
}

export async function fetchRegulatorReports(): Promise<ReportResponse> {
  return fetcher('/api/regulator/reports', MOCK_REGULATOR_REPORTS);
}
