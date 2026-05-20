import { describe, it, expect } from 'vitest';
import { buildMirrorGenerateScenePayload } from '@/lib/eza/mirror/generateSceneApi';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';

const visual: MirrorVisualPromptPayload = {
  characterId: 'balanced_calm',
  characterName: 'Sakin',
  personaFamilyId: 'balanced_calm',
  topicLabel: 'genel düşünce',
  atmosphereLabel: 'sakin',
  emotionLabel: 'dengeli',
  prompt: 'premium soft 3D illustration, no text',
  negativePrompt: 'text, letters',
  stylePreset: 'eza_mirror_professional_v1',
  seedHint: 'mirror-visual-test',
  qualityHints: ['9:16 vertical safe composition'],
};

describe('buildMirrorGenerateScenePayload', () => {
  it('maps visual fields without chat content', () => {
    const payload = buildMirrorGenerateScenePayload(visual, '2026-05-21');
    expect(payload).toEqual({
      prompt: visual.prompt,
      negativePrompt: visual.negativePrompt,
      seedHint: visual.seedHint,
      stylePreset: visual.stylePreset,
      qualityHints: visual.qualityHints,
      cardDate: '2026-05-21',
    });
    expect(payload).not.toHaveProperty('messages');
    expect(payload).not.toHaveProperty('entries');
  });
});
