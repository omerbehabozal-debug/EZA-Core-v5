import { describe, it, expect } from 'vitest';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import { applyStyleLensToVisual } from '@/lib/eza/mirror/styleLensPrompt';

const baseVisual: MirrorVisualPromptPayload = {
  characterId: 'curiosity_exploration',
  characterName: 'İtalyan Sohbeti',
  personaFamilyId: 'curiosity_exploration',
  topicLabel: 'Travel',
  atmosphereLabel: 'warm',
  emotionLabel: 'curious',
  prompt:
    'visual moment: Paylaştıkça yol açılır., identity mood lens: calm, do not depict a panda, fox, animal doctor mascot, cartoon animal, or literal character costume',
  negativePrompt: 'text, logo, sticker',
  stylePreset: 'eza_mirror_professional_v1',
  seedHint: 'seed-base-abc',
};

describe('styleLensPrompt', () => {
  it('does not mutate the original visual', () => {
    const patched = applyStyleLensToVisual(baseVisual, 'curious_panda', 1);
    expect(patched.prompt).not.toBe(baseVisual.prompt);
    expect(baseVisual.prompt).not.toContain('style lens:');
    expect(patched.prompt).toContain('style lens:');
  });

  it('extends seedHint with lens and variation index', () => {
    const patched = applyStyleLensToVisual(baseVisual, 'explorer_fox', 3);
    expect(patched.seedHint).toContain('lens:explorer_fox');
    expect(patched.seedHint).toContain('v3');
  });

  it('strips panda avoid for curious_panda but keeps sticker/cartoon negatives', () => {
    const patched = applyStyleLensToVisual(baseVisual, 'curious_panda', 0);
    expect(patched.prompt).not.toMatch(/do not depict a panda/i);
    expect(patched.prompt).toMatch(/premium anthropomorphic curious panda/i);
    expect(patched.negativePrompt).toMatch(/sticker/i);
    expect(patched.negativePrompt).toMatch(/children book/i);
  });

  it('keeps mascot avoid for premium_human', () => {
    const patched = applyStyleLensToVisual(baseVisual, 'premium_human', 0);
    expect(patched.prompt).toMatch(/do not depict a panda/i);
  });
});
