/**
 * EZA Proxy UI Types
 */

export interface ProxyLiteResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_category: string;
  violated_rule_count: number;
  summary: string;
  recommendation: string;
  score?: number;
}

export interface CaseItem {
  id: string;
  content_id: string;
  risk_score: number;
  eu_ai_class?: string;
  status: 'pending' | 'reviewed' | 'approved' | 'flagged';
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'revoked';
}

export interface ContentItem {
  id: string;
  content: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface PolicyConfig {
  high_risk_topics: string[];
  illegal_use_cases: string[];
  custom_rules: string[];
}

export interface WorkflowNode {
  id: string;
  type: 'input' | 'risk_check' | 'human_reviewer' | 'archive';
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface CorporateAudit {
  id: string;
  ai_agent: string;
  risk_score: number;
  flags: string[];
  reviewer: string;
  status: 'pending' | 'approved' | 'flagged';
  timestamp: string;
}

