/**
 * Mock Corporate Data
 */

import type { CorporateAudit } from '@/lib/types';

export const MOCK_CORPORATE_AUDITS: CorporateAudit[] = [
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

