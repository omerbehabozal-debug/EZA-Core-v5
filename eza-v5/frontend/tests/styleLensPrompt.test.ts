import { describe, it, expect } from 'vitest';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import {
  applyStyleLensToVisual,
  stripLegacyStyleLensFromPrompt,
  withSceneVariationSeed,
} from '@/lib/eza/mirror/styleLensPrompt';

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

describe('styleLensPrompt (injection retired)', () => {
  it('applyStyleLensToVisual is a no-op (no character injection)', () => {
    const patched = applyStyleLensToVisual(baseVisual, 'curious_panda', 1);
    expect(patched).toBe(baseVisual);
    expect(patched.prompt).not.toContain('style lens:');
    expect(patched.prompt).not.toMatch(/anthropomorphic curious panda/i);
    expect(patched.prompt).not.toMatch(/cinematic real human subject/i);
  });

  it('withSceneVariationSeed only extends seedHint', () => {
    const patched = withSceneVariationSeed(baseVisual, 3);
    expect(patched.prompt).toBe(baseVisual.prompt);
    expect(patched.seedHint).toContain('scene_var:3');
    expect(patched.seedHint).not.toContain('lens:');
  });

  it('strips legacy style lens tails from cached prompts', () => {
    const dirty =
      'Mardin stone terrace at dusk. style lens: premium anthropomorphic curious panda, adult cinematic editorial character.';
    expect(stripLegacyStyleLensFromPrompt(dirty)).toBe(
      'Mardin stone terrace at dusk.'
    );
    expect(withSceneVariationSeed({ ...baseVisual, prompt: dirty }, 0).prompt).toBe(
      'Mardin stone terrace at dusk.'
    );
  });
});
