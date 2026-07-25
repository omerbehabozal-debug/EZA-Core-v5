import { describe, it, expect } from 'vitest';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
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
  promptContract: MIRROR_V5_PROMPT_CONTRACT,
};

describe('buildMirrorGenerateScenePayload', () => {
  it('maps visual fields without chat content', () => {
    const payload = buildMirrorGenerateScenePayload(visual, '2026-05-21');
    expect(payload.prompt).toBe(visual.prompt);
    expect(payload.negativePrompt).toBe(visual.negativePrompt);
    expect(payload.seedHint).toBe(visual.seedHint);
    expect(payload.stylePreset).toBe(visual.stylePreset);
    expect(payload.qualityHints).toEqual(visual.qualityHints);
    expect(payload.cardDate).toBe('2026-05-21');
    expect(payload.promptContract).toBe(MIRROR_V5_PROMPT_CONTRACT);
    expect(payload).not.toHaveProperty('messages');
    expect(payload).not.toHaveProperty('entries');
  });

  it('forwards D2 pipeline and finalScenePromptHash', () => {
    const payload = buildMirrorGenerateScenePayload(visual, '2026-05-21', {
      generationRequestId: 'gen-abc',
      generationPipeline: 'D2_V5',
      finalScenePromptHash: 'a'.repeat(64),
    });
    expect(payload.generationRequestId).toBe('gen-abc');
    expect(payload.generationPipeline).toBe('D2_V5');
    expect(payload.finalScenePromptHash).toBe('a'.repeat(64));
  });
});
