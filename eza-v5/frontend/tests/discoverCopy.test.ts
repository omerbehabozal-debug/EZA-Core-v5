import { describe, expect, it } from 'vitest';
import {
  SAINA_DISCOVER_CTA,
  SAINA_DISCOVER_HERO_LINE_2,
  SAINA_DISCOVER_HERO_LINE_3,
  formatDiscoverYansiCount,
} from '@/lib/eza/mirror-network/discoverCopy';

describe('discoverCopy', () => {
  it('formats yansi count in Turkish locale style', () => {
    expect(formatDiscoverYansiCount(8421)).toMatch(/8\.421 Yansı/);
  });

  it('uses sohbete katıl CTA', () => {
    expect(SAINA_DISCOVER_CTA).toBe('Bu sohbete katıl →');
  });

  it('uses curiosity-first hero lines', () => {
    expect(SAINA_DISCOVER_HERO_LINE_2).toBe('Bir merak seç.');
    expect(SAINA_DISCOVER_HERO_LINE_3).toBe('Kendi yolculuğunu başlat.');
  });
});
