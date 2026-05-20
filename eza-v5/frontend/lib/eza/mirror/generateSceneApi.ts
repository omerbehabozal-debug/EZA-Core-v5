/**
 * EZA Mirror — backend scene generation (prompt metadata only, no chat content).
 */

import { apiClient } from '@/lib/apiClient';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';

export type MirrorGenerateSceneResponse = {
  sceneImageUrl: string;
  provider: 'mock' | 'openai' | 'replicate' | 'stability';
  cached: boolean;
  generatedAt: string;
};

export type MirrorGenerateSceneRequest = {
  prompt: string;
  negativePrompt: string;
  seedHint: string;
  stylePreset: string;
  qualityHints?: string[];
  cardDate: string;
};

export function buildMirrorGenerateScenePayload(
  visual: MirrorVisualPromptPayload,
  cardDate: string
): MirrorGenerateSceneRequest {
  return {
    prompt: visual.prompt,
    negativePrompt: visual.negativePrompt,
    seedHint: visual.seedHint,
    stylePreset: visual.stylePreset,
    qualityHints: visual.qualityHints,
    cardDate,
  };
}

export async function generateMirrorScene(
  visual: MirrorVisualPromptPayload,
  cardDate: string
): Promise<MirrorGenerateSceneResponse> {
  const body = buildMirrorGenerateScenePayload(visual, cardDate);
  const res = await apiClient.post<MirrorGenerateSceneResponse>(
    '/api/standalone/mirror/generate-scene',
    { body }
  );
  if (!res.ok) {
    const msg =
      res.error?.error_message ??
      res.error?.message ??
      'Mirror sahnesi şu an hazırlanamadı.';
    throw new Error(msg);
  }
  const payload = (res.data ?? res) as MirrorGenerateSceneResponse;
  if (!payload.sceneImageUrl) {
    throw new Error('Mirror sahnesi şu an hazırlanamadı.');
  }
  return payload;
}
