/**
 * Mock Platform Data
 */

import { ApiKey, ContentItem } from '@/lib/types';

export const MOCK_PLATFORM_API_KEYS: ApiKey[] = [
  {
    id: '1',
    name: 'Production Key',
    key: 'eza_live_sk_test_1234567890abcdef',
    created_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
    status: 'active',
  },
  {
    id: '2',
    name: 'Development Key',
    key: 'eza_dev_sk_test_abcdef1234567890',
    created_at: new Date().toISOString(),
    status: 'active',
  },
];

export const MOCK_PLATFORM_STREAM: ContentItem[] = [
  {
    id: 'stream_1',
    content: 'Sample content for moderation...',
    score: 0.75,
    risk_level: 'medium',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'stream_2',
    content: 'Another content item requiring review...',
    score: 0.45,
    risk_level: 'high',
    timestamp: new Date().toISOString(),
  },
];

export interface TrendData {
  hour: number;
  risk: number;
}

export const MOCK_PLATFORM_TREND: TrendData[] = [
  { hour: 0, risk: 0.3 },
  { hour: 8, risk: 0.6 },
  { hour: 12, risk: 0.8 },
  { hour: 18, risk: 0.5 },
];
