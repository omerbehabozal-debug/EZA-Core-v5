/**
 * Mock Regulator Data
 */

import { CaseItem } from '@/lib/types';

export interface RegulatorCase extends CaseItem {
  eu_ai_class?: string;
  content_preview?: string;
}

export interface RiskMatrixData {
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
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

export const MOCK_REGULATOR_RISK_MATRIX: RiskMatrixData[] = [
  { x: 0, y: 0, value: 0.9, label: 'High Risk Content' },
  { x: 0, y: 1, value: 0.7, label: 'Medium-High Risk' },
  { x: 1, y: 0, value: 0.5, label: 'Medium Risk' },
  { x: 1, y: 1, value: 0.3, label: 'Low-Medium Risk' },
  { x: 2, y: 2, value: 0.2, label: 'Low Risk' },
];

export const MOCK_REGULATOR_AUDIT_LOGS: AuditLog[] = [
  {
    id: '1',
    action: 'Case Reviewed',
    user: 'Admin User',
    timestamp: new Date().toISOString(),
    details: 'Case CONT-001 reviewed and approved',
  },
  {
    id: '2',
    action: 'Case Flagged',
    user: 'Reviewer',
    timestamp: new Date().toISOString(),
    details: 'Case CONT-003 flagged for further review',
  },
];

