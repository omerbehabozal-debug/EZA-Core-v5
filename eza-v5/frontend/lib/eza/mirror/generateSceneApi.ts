/**
 * EZA Mirror — backend scene generation (prompt metadata only, no chat content).
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import {
  MirrorApiContractError,
  validateGenerateSceneResponse,
} from '@/lib/eza/mirror/mirrorApiContracts';

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
  /** Explicit pipeline discriminator — never infer LEGACY from missing data. */
  generationPipeline?: 'D2_V5' | 'LEGACY_V3';
  /** SHA-256 of the exact prompt about to be sent (D2 fail-closed). */
  finalScenePromptHash?: string;
};

export type MirrorSceneGenerationOptions = {
  conversationId?: string | null;
  generationRequestId?: string;
  generationPipeline?: 'D2_V5' | 'LEGACY_V3';
  finalScenePromptHash?: string;
};

export type MirrorGenerateSceneResponse = {
  sceneImageUrl: string;
  provider: 'mock' | 'openai' | 'replicate' | 'stability';
  cached: boolean;
  generatedAt: string;
  /** Echo of request generation id for race guards. */
  generationRequestId?: string | null;
  /** Optional 0–1 focal; omitted → safe center. Never invent client-side fakes to persist. */
  focalX?: number | null;
  focalY?: number | null;
};

export type MirrorSceneErrorCode =
  | 'auth_required'
  | 'upgrade_required'
  | 'visual_not_available_on_tier'
  | 'visual_cooldown_active'
  | 'visual_daily_limit_reached'
  | 'generation_failed'
  | 'prepare_failed'
  | 'd2_prompt_invalid'
  | 'd2_pipeline_required'
  | 'stale_generation'
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
    generationPipeline: options?.generationPipeline,
    finalScenePromptHash: options?.finalScenePromptHash,
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
      code === 'prepare_failed' ||
      code === 'd2_prompt_invalid' ||
      code === 'd2_prompt_invalid_prefix' ||
      code === 'd2_prompt_contains_category' ||
      code === 'provider_prompt_hash_mismatch' ||
      code === 'generation_id_required'
    ) {
      throw new MirrorSceneError(
        msg,
        code === 'prepare_failed' ? 'prepare_failed' : 'd2_prompt_invalid'
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
  try {
    const payload = validateGenerateSceneResponse(res.data ?? res);
    return {
      sceneImageUrl: payload.sceneImageUrl,
      provider: (payload.provider as MirrorGenerateSceneResponse['provider']) ?? 'mock',
      cached: Boolean(payload.cached),
      generatedAt:
        typeof payload.generatedAt === 'string'
          ? payload.generatedAt
          : new Date().toISOString(),
      generationRequestId:
        (typeof payload.generationRequestId === 'string'
          ? payload.generationRequestId
          : null) ?? body.generationRequestId,
      focalX: typeof payload.focalX === 'number' ? payload.focalX : null,
      focalY: typeof payload.focalY === 'number' ? payload.focalY : null,
    };
  } catch (err) {
    if (err instanceof MirrorApiContractError) {
      throw new MirrorSceneError(err.message, 'generation_failed');
    }
    throw new MirrorSceneError('Mirror sahnesi şu an hazırlanamadı.', 'generation_failed');
  }
}
