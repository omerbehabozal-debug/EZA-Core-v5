import { describe, expect, it } from 'vitest';
import { formatDiscoverYansiCount, SAINA_DISCOVER_CTA } from '@/lib/eza/mirror-network/discoverCopy';

describe('discoverCopy', () => {
  it('formats yansi count in Turkish locale style', () => {
    expect(formatDiscoverYansiCount(8421)).toMatch(/8\.421 Yansı/);
  });

  it('uses sohbete katıl CTA', () => {
    expect(SAINA_DISCOVER_CTA).toBe('Bu sohbete katıl →');
  });
});
