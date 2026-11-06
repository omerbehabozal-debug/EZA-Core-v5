import { describe, expect, it } from 'vitest';
import { coverInterval, squareCoverRect } from '@/lib/eza/business/coverExperience';

describe('manual cover rules', () => {
  it('rejects an interval longer than the cover limit', () => {
    expect(coverInterval(40, 0, 21)).toEqual({ error: 'Kapak en fazla 20 saniye olabilir.' });
    expect(coverInterval(40, 5, 15)).toEqual({ start: 5, end: 15 });
  });

  it('keeps the discovery crop square', () => {
    const rect = squareCoverRect(1600, 900, 1);
    expect(rect).not.toBeNull();
    expect(rect?.size).toBeGreaterThan(0);
  });
});
