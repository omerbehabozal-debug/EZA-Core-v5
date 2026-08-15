import { describe, expect, it } from 'vitest';
import { formatYansiPublicSocialProof, parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';

describe('Phase 6.2 public metrics copy', () => {
  it('formats 140 deneyim · 7 Yansı', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 140,
        directChildYansiCount: 7,
      })
    ).toEqual({
      visible: '140 deneyim · 7 Yansı',
      sr: '140 deneyim, 7 Yansı',
    });
  });

  it('formats 1 child without pluralizing Yansı', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 12,
        directChildYansiCount: 1,
      })?.visible
    ).toBe('12 deneyim · 1 Yansı');
  });

  it('omits · 0 Yansı', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 140,
        directChildYansiCount: 0,
      })?.visible
    ).toBe('140 deneyim');
  });

  it('hides the row when both counts are zero', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 0,
        directChildYansiCount: 0,
      })
    ).toBeNull();
  });

  it('keeps 0 deneyim when children exist', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 0,
        directChildYansiCount: 3,
      })?.visible
    ).toBe('0 deneyim · 3 Yansı');
  });

  it('uses tr-TR grouping without K/M abbreviations', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 1400,
        directChildYansiCount: 12,
      })?.visible
    ).toBe('1.400 deneyim · 12 Yansı');
  });

  it('fail-closes on negative or non-integer', () => {
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: -1,
        directChildYansiCount: 7,
      })
    ).toBeNull();
    expect(
      formatYansiPublicSocialProof({
        experienceStartedCount: 140,
        directChildYansiCount: 1.2,
      })
    ).toBeNull();
  });

  it('parses only integer non-negative pair; rejects partial/legacy fields', () => {
    expect(
      parseYansiPublicSocialProofInput({
        experienceStartedCount: 140,
        directChildYansiCount: 7,
      })
    ).toEqual({ experienceStartedCount: 140, directChildYansiCount: 7 });
    expect(
      parseYansiPublicSocialProofInput({
        yansiCount: 99,
        landingViews: 9999,
        experienceCount: 42,
      })
    ).toBeNull();
  });
});
