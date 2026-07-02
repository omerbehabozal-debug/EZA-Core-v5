import { afterEach, describe, expect, it } from 'vitest';
import { isSainaImpactStatsEnabled } from '@/lib/eza/mirror-network/impactStatsFeature';

describe('impactStatsFeature', () => {
  const prev = process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED = prev;
    }
  });

  it('defaults to disabled', () => {
    delete process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED;
    expect(isSainaImpactStatsEnabled()).toBe(false);
  });

  it('enables only when env is true', () => {
    process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED = 'true';
    expect(isSainaImpactStatsEnabled()).toBe(true);
  });
});
