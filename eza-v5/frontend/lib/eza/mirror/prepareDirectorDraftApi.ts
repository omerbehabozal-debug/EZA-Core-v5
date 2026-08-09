/**
 * Client for POST /api/standalone/mirror/prepare-director-draft (PR C).
 * Does not consume visual quota. Backend flag authority.
 *
 * Fail-closed: HTTP / empty / contract failures throw — callers must not soft-continue to V3.
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type { PrepareDirectorDraftResult } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import {
  MirrorApiContractError,
  validatePrepareDirectorResponse,
} from '@/lib/eza/mirror/mirrorApiContracts';

export type MirrorPrepareMessageDTO = {
  role: 'user' | 'assistant';
  text: string;
  sequence?: number;
};

export type PrepareDirectorDraftRequest = {
  conversationId: string;
  generationRequestId: string;
  messages: MirrorPrepareMessageDTO[];
  title?: string;
  conversationSummary?: string;
  /** Phase 3 — when set, backend fail-closes unless messages match the window. */
  journeySemanticScope?: {
    semanticScope: 'journey_window_v1';
    journeyId: string;
    journeyVersion: number;
    sourceConversationId: string;
    parentJourneyId?: string | null;
    windowIndex: number;
    windowStart: number;
    windowEnd: number;
    blockIndex?: number;
    blockStart?: number;
    blockEnd?: number;
    windowHash?: string;
    sourceBlockHash?: string;
    scopedInputHash?: string;
    selectedStepsHash?: string;
    selectedSteps: Array<{
      stepIndex: number;
      sourceOrder: number;
      sourceUserMessageId: string;
      sourceAssistantMessageId: string;
      publicQuestion: string;
      publicAnswer: string;
    }>;
    sourceBlockSteps?: Array<{
      sourceOrder: number;
      sourceUserMessageId: string;
      sourceAssistantMessageId: string;
      publicQuestion: string;
      publicAnswer: string;
    }>;
  };
};

export class MirrorPrepareError extends Error {
  readonly code: string;

  constructor(message: string, code = 'prepare_failed') {
    super(message);
    this.name = 'MirrorPrepareError';
    this.code = code;
  }
}

export async function prepareDirectorDraft(
  body: PrepareDirectorDraftRequest
): Promise<PrepareDirectorDraftResult> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('eza_token') : null;
  const headers: Record<string, string> = {};
  if (!token && typeof window !== 'undefined') {
    const guestToken = getOrCreateMirrorGuestToken();
    if (guestToken) headers[GUEST_TOKEN_HEADER] = guestToken;
  }

  const res = await apiClient.post<PrepareDirectorDraftResult>(
    '/api/standalone/mirror/prepare-director-draft',
    {
      body,
      auth: Boolean(token),
      headers,
      directBackend: true,
      timeoutMs: 90_000,
    }
  );

  if (!res.ok) {
    const code =
      (typeof res.error?.error_code === 'string' && res.error.error_code) ||
      (typeof res.error?.error === 'string' && res.error.error) ||
      'prepare_http_error';
    const message =
      (typeof res.error?.error_message === 'string' && res.error.error_message) ||
      (typeof res.error?.message === 'string' && res.error.message) ||
      'Director prepare başarısız oldu.';
    throw new MirrorPrepareError(message, code);
  }
  try {
    // Prefer nested data / double-wrap via contract unwrap; reject soft shapes.
    return validatePrepareDirectorResponse(res) as PrepareDirectorDraftResult;
  } catch (err) {
    if (err instanceof MirrorApiContractError) {
      throw new MirrorPrepareError(err.message, err.code);
    }
    throw new MirrorPrepareError(
      'Director prepare boş yanıt döndü.',
      'prepare_empty_response'
    );
  }
}

/** @deprecated Prefer validatePrepareDirectorResponse — kept for transitional callers. */
export function unwrapPrepareDirectorResult(
  res: Record<string, unknown> & { data?: unknown; ok?: boolean }
): PrepareDirectorDraftResult | null {
  try {
    return validatePrepareDirectorResponse(res) as PrepareDirectorDraftResult;
  } catch {
    return null;
  }
}

/** Build permitted DTOs from archive + live messages (user primary). */
export function buildPrepareMessageDtos(
  messages: ReadonlyArray<{ id?: string; text: string; isUser: boolean }>
): MirrorPrepareMessageDTO[] {
  const out: MirrorPrepareMessageDTO[] = [];
  let seq = 0;
  for (const m of messages) {
    const text = m.text?.trim();
    if (!text) continue;
    out.push({
      role: m.isUser ? 'user' : 'assistant',
      text: text.slice(0, 4000),
      sequence: seq++,
    });
  }
  return out;
}
