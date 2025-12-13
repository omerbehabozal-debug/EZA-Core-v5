/**
 * Mock Regulator Data
 */

import { CaseItem } from '@/lib/types';

export interface RegulatorCase extends CaseItem {
  eu_ai_class?: string;
  content_preview?: string;
}

export interface RiskMatrixResponse {
  matrix: Array<Array<{
    count: number;
    percentage: number;
    severity: string;
    likelihood: string;
  }>>;
  total_cases: number;
  summary: Record<string, number>;
}

export interface ReportResponse {
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

export const MOCK_REGULATOR_CASES: RegulatorCase[] = [
  {
    id: '1',
    content_id: 'CONT-001',
    risk_score: 0.85,
    eu_ai_class: 'High Risk',
    status: 'pending',
    created_at: new Date().toISOString(),
    content_preview: 'Sample content requiring review...',
  },
  {
    id: '2',
    content_id: 'CONT-002',
    risk_score: 0.45,
    eu_ai_class: 'Limited Risk',
    status: 'reviewed',
    created_at: new Date().toISOString(),
    content_preview: 'Another content item...',
  },
  {
    id: '3',
    content_id: 'CONT-003',
    risk_score: 0.92,
    eu_ai_class: 'High Risk',
    status: 'flagged',
    created_at: new Date().toISOString(),
    content_preview: 'High risk content detected...',
  },
];

export const MOCK_REGULATOR_RISK_MATRIX: RiskMatrixResponse = {
  matrix: [
    [
      { count: 5, percentage: 12.5, severity: 'low', likelihood: 'low' },
      { count: 8, percentage: 20.0, severity: 'low', likelihood: 'medium' },
      { count: 3, percentage: 7.5, severity: 'low', likelihood: 'high' },
    ],
    [
      { count: 10, percentage: 25.0, severity: 'medium', likelihood: 'low' },
      { count: 7, percentage: 17.5, severity: 'medium', likelihood: 'medium' },
      { count: 2, percentage: 5.0, severity: 'medium', likelihood: 'high' },
    ],
    [
      { count: 3, percentage: 7.5, severity: 'high', likelihood: 'low' },
      { count: 1, percentage: 2.5, severity: 'high', likelihood: 'medium' },
      { count: 1, percentage: 2.5, severity: 'high', likelihood: 'high' },
    ],
  ],
  total_cases: 40,
  summary: {
    low_low: 5,
    low_medium: 8,
    low_high: 3,
    medium_low: 10,
    medium_medium: 7,
    medium_high: 2,
    high_low: 3,
    high_medium: 1,
    high_high: 1,
  },
};

export const MOCK_REGULATOR_REPORTS: ReportResponse = {
  metadata: {
    report_type: 'rtuk',
    generated_at: new Date().toISOString(),
    total_cases: 40,
    statistics: {
      high_risk_count: 5,
      medium_risk_count: 19,
      low_risk_count: 16,
      average_risk_score: 0.45,
      sources: { rtuk: 40 },
    },
    format: 'json',
  },
  content: {
    summary: 'Regulatory compliance report for RTÜK. Total cases analyzed: 40. High risk cases: 5, Medium risk: 19, Low risk: 16.',
    recommendations: [
      'Immediate action required: 5 high-risk cases detected. Review and take appropriate regulatory measures.',
      'Ensure all content complies with RTÜK broadcasting regulations. Monitor high-risk content categories closely.',
    ],
    high_risk_cases: MOCK_REGULATOR_CASES.filter(c => c.risk_score >= 0.7),
    case_summary: MOCK_REGULATOR_CASES.map(c => ({
      id: c.id,
      source: 'rtuk',
      risk_score: c.risk_score,
      risk_level: c.risk_score >= 0.7 ? 'high' : c.risk_score >= 0.4 ? 'medium' : 'low',
      created_at: c.created_at,
    })),
  },
};
