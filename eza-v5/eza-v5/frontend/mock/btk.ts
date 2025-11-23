/**
 * Mock BTK Data
 */

export interface TrafficRiskRequest {
  text: string;
  metadata?: Record<string, any>;
}

export interface TrafficRiskResponse {
  risk_score: number;
  risk_level: string;
  traffic_category: 'low' | 'medium' | 'high';
  analysis: {
    risk_score: number;
    risk_level: string;
    input_analysis?: any;
  };
}

export interface BTKAuditLogResponse {
  id: number;
  endpoint: string;
  method: string;
  actor: string | null;
  result: string | null;
  meta: Record<string, any> | null;
  created_at: string;
}

export const MOCK_TRAFFIC_RISK: TrafficRiskResponse = {
  risk_score: 0.65,
  risk_level: 'high',
  traffic_category: 'high',
  analysis: {
    risk_score: 0.65,
    risk_level: 'high',
  },
};

export const MOCK_BTK_AUDIT_LOG: BTKAuditLogResponse[] = [
  {
    id: 1,
    endpoint: '/api/btk/traffic-risk',
    method: 'POST',
    actor: 'system',
    result: 'success',
    meta: { risk_score: 0.65, category: 'high' },
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    endpoint: '/api/btk/traffic-risk',
    method: 'POST',
    actor: 'system',
    result: 'success',
    meta: { risk_score: 0.35, category: 'low' },
    created_at: new Date().toISOString(),
  },
];

