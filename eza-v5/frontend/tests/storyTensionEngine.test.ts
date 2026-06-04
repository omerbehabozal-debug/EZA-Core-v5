import { describe, it, expect } from 'vitest';
import { composeStoryTension } from '@/lib/eza/mirror/storyTensionEngine';

describe('storyTensionEngine (P4-A)', () => {
  it('comparison → Two strong paths. One decision.', () => {
    const t = composeStoryTension('comparison');
    expect(t.storyTensionTitle).toBe('Two paths. One decision.');
    expect(t.storyTensionSummary.toLowerCase()).toContain('options');
  });

  it('creation → A form seeking shape.', () => {
    const t = composeStoryTension('creation');
    expect(t.storyTensionTitle).toBe('A form seeking shape.');
  });

  it('care → Care returning.', () => {
    const t = composeStoryTension('care');
    expect(t.storyTensionTitle).toBe('Care returning.');
  });
});
