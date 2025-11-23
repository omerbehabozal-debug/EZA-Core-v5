/**
 * Mock Corporate Data
 */

import type { CorporateAudit, PolicyConfig } from '@/lib/types';

export const MOCK_CORPORATE_AUDIT: CorporateAudit[] = [
  {
    id: '1',
    ai_agent: 'Customer Support Bot',
    risk_score: 0.35,
    flags: ['sensitive_data'],
    reviewer: 'John Doe',
    status: 'approved',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    ai_agent: 'Sales Assistant',
    risk_score: 0.75,
    flags: ['high_risk', 'needs_review'],
    reviewer: 'Jane Smith',
    status: 'flagged',
    timestamp: new Date().toISOString(),
  },
  {
    id: '3',
    ai_agent: 'HR Chatbot',
    risk_score: 0.25,
    flags: [],
    reviewer: 'Admin',
    status: 'approved',
    timestamp: new Date().toISOString(),
  },
];

export const MOCK_CORPORATE_POLICY: PolicyConfig = {
  high_risk_topics: ['financial_advice', 'medical_diagnosis', 'legal_opinion'],
  illegal_use_cases: ['fraud', 'harassment', 'discrimination'],
  custom_rules: ['no_personal_data_sharing', 'require_human_review_for_high_risk'],
};
