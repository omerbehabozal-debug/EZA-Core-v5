import { describe, expect, it } from 'vitest';
import {
  applicationStatusLabel,
  formatPlatformDate,
  systemFeatureLabel,
} from '@/lib/eza/platformAdminUi';

describe('platformAdminUi', () => {
  it('maps application statuses to Turkish labels', () => {
    expect(applicationStatusLabel('received')).toBe('Alındı');
    expect(applicationStatusLabel('under_review')).toBe('İncelemede');
    expect(applicationStatusLabel('approved')).toBe('Onaylandı');
  });

  it('formats dates in tr-TR without crashing on invalid input', () => {
    expect(formatPlatformDate(null)).toBe('—');
    expect(formatPlatformDate('not-a-date')).toBe('not-a-date');
    expect(formatPlatformDate('2026-10-18T16:42:15.332Z')).toMatch(/2026/);
  });

  it('maps known system feature keys', () => {
    expect(systemFeatureLabel('yansi_studio')).toBe('Yansı Stüdyosu');
    expect(systemFeatureLabel('knowledge_pool')).toBe('Bilgi havuzu');
  });
});
