import { describe, it, expect } from 'vitest';
import {
  POSTER_ASPECT_RATIO,
  POSTER_CARD_WIDTH_PX,
} from '@/lib/eza/mirror/posterCardSkin';

describe('posterCardSkin', () => {
  it('uses 9:16 poster standard dimensions', () => {
    expect(POSTER_ASPECT_RATIO).toBe('9 / 16');
    expect(POSTER_CARD_WIDTH_PX).toBeGreaterThanOrEqual(420);
    expect(POSTER_CARD_WIDTH_PX).toBeLessThanOrEqual(460);
  });
});
