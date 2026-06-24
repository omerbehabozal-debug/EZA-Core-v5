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
  promptContract?: string;
};

export type MirrorSceneErrorCode =
  | 'auth_required'
  | 'upgrade_required'
  | 'generation_failed'
  | 'rate_limit'
  | 'openai_insufficient_quota'
  | 'unknown';

export class MirrorSceneError extends Error {
  readonly code: MirrorSceneErrorCode;

  constructor(message: string, code: MirrorSceneErrorCode) {
    super(message);
    this.name = 'MirrorSceneError';
    this.code = code;
  }
}

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
    promptContract: visual.promptContract,
  };
}

export async function generateMirrorScene(
  visual: MirrorVisualPromptPayload,
  cardDate: string
): Promise<MirrorGenerateSceneResponse> {
  const body = buildMirrorGenerateScenePayload(visual, cardDate);
  const res = await apiClient.post<MirrorGenerateSceneResponse>(
    '/api/standalone/mirror/generate-scene',
    { body, auth: true, directBackend: true, timeoutMs: 130_000 }
  );
  if (!res.ok) {
    const code = res.error?.error_code;
    const msg =
      res.error?.error_message ??
      res.error?.message ??
      'Mirror sahnesi şu an hazırlanamadı.';
    if (code === 'auth_required' || code === 'HTTP_401') {
      throw new MirrorSceneError(msg, 'auth_required');
    }
    if (code === 'upgrade_required') {
      throw new MirrorSceneError(msg, 'upgrade_required');
    }
    if (code === 'rate_limit' || code === 'HTTP_429') {
      throw new MirrorSceneError(msg, 'rate_limit');
    }
    if (
      code === 'openai_insufficient_quota' ||
      code === 'insufficient_quota' ||
      code === 'HTTP_402'
    ) {
      throw new MirrorSceneError(
        'OpenAI hesap kotası veya ödeme kısıtı nedeniyle sahne üretilemiyor. Biraz sonra tekrar dene veya yönetici billing kontrolü yapsın.',
        'openai_insufficient_quota'
      );
    }
    if (
      code === 'generation_failed' ||
      code === 'HTTP_502' ||
      code === 'REQUEST_TIMEOUT' ||
      code === 'NETWORK_ERROR'
    ) {
      throw new MirrorSceneError(msg, 'generation_failed');
    }
    throw new MirrorSceneError(msg, 'unknown');
  }
  const payload = (res.data ?? res) as MirrorGenerateSceneResponse;
  if (!payload.sceneImageUrl) {
    throw new Error('Mirror sahnesi şu an hazırlanamadı.');
  }
  return payload;
}
