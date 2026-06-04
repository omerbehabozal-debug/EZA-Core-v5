import { describe, it, expect } from 'vitest';
import { composeMirrorMoment } from '@/lib/eza/mirror/mirrorMomentEngine';

describe('mirrorMomentEngine (P4-A)', () => {
  it('comparison → Standing still before choosing.', () => {
    expect(composeMirrorMoment('comparison')).toBe('Standing still before choosing.');
  });

  it('exploration → Looking beyond the familiar.', () => {
    expect(composeMirrorMoment('exploration')).toBe('Looking beyond the familiar.');
  });

  it('care → Choosing yourself again.', () => {
    expect(composeMirrorMoment('care')).toBe('Choosing yourself again.');
  });

  it('vehicle lock uses comparison moment', () => {
    expect(composeMirrorMoment('exploration', 'premium_vehicle_comparison')).toBe(
      'Standing still before choosing.'
    );
  });
});
