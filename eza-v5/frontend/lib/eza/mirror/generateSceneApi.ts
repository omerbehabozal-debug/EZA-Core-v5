/**
 * EZA Mirror — backend scene generation (prompt metadata only, no chat content).
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';

export type MirrorGenerateSceneResponse = {
  sceneImageUrl: string;
  provider: 'mock' | 'openai' | 'replicate' | 'stability';
  cached: boolean;
  generatedAt: string;
  /** Optional 0–1 focal; omitted → safe center. Never invent client-side fakes to persist. */
  focalX?: number | null;
  focalY?: number | null;
};

export type MirrorGenerateSceneRequest = {
  prompt: string;
  negativePrompt: string;
  seedHint: string;
  stylePreset: string;
  qualityHints?: string[];
  cardDate: string;
  promptContract?: string;
  conversationId?: string;
  generationRequestId?: string;
};

export type MirrorSceneGenerationOptions = {
  conversationId?: string | null;
  generationRequestId?: string;
};

export type MirrorSceneErrorCode =
  | 'auth_required'
  | 'upgrade_required'
  | 'visual_not_available_on_tier'
  | 'visual_cooldown_active'
  | 'visual_daily_limit_reached'
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
  cardDate: string,
  options?: MirrorSceneGenerationOptions
): MirrorGenerateSceneRequest {
  return {
    prompt: visual.prompt,
    negativePrompt: visual.negativePrompt,
    seedHint: visual.seedHint,
    stylePreset: visual.stylePreset,
    qualityHints: visual.qualityHints,
    cardDate,
    promptContract: visual.promptContract,
    conversationId: options?.conversationId ?? undefined,
    generationRequestId: options?.generationRequestId,
  };
}

export async function generateMirrorScene(
  visual: MirrorVisualPromptPayload,
  cardDate: string,
  options?: MirrorSceneGenerationOptions
): Promise<MirrorGenerateSceneResponse> {
  const body = buildMirrorGenerateScenePayload(visual, cardDate, options);
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('eza_token') : null;
  const headers: Record<string, string> = {};
  if (!token && typeof window !== 'undefined') {
    const guestToken = getOrCreateMirrorGuestToken();
    if (guestToken) {
      headers[GUEST_TOKEN_HEADER] = guestToken;
    }
  }
  const res = await apiClient.post<MirrorGenerateSceneResponse>(
    '/api/standalone/mirror/generate-scene',
    { body, auth: Boolean(token), headers, directBackend: true, timeoutMs: 130_000 }
  );
  if (!res.ok) {
    const detail = res.detail as Record<string, unknown> | undefined;
    const reason = typeof detail?.reason === 'string' ? detail.reason : undefined;
    const code = res.error?.error_code;
    const msg =
      res.error?.error_message ??
      res.error?.message ??
      'Mirror sahnesi şu an hazırlanamadı.';
    if (code === 'auth_required' || code === 'HTTP_401') {
      throw new MirrorSceneError(msg, 'auth_required');
    }
    if (code === 'upgrade_required' || reason === 'visual_not_available_on_tier') {
      throw new MirrorSceneError(msg, reason === 'visual_not_available_on_tier' ? 'visual_not_available_on_tier' : 'upgrade_required');
    }
    if (reason === 'visual_cooldown_active') {
      throw new MirrorSceneError(msg, 'visual_cooldown_active');
    }
    if (reason === 'visual_daily_limit_reached') {
      throw new MirrorSceneError(msg, 'visual_daily_limit_reached');
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
