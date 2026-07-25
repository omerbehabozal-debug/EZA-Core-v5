/**
 * Client for POST /api/standalone/mirror/prepare-director-draft (PR C).
 * Does not consume visual quota. Backend flag authority.
 *
 * Fail-closed: HTTP / empty failures throw — callers must not soft-continue to V3.
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type { PrepareDirectorDraftResult } from '@/lib/eza/mirror/applyDirectorPrepareToCard';

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
    throw new MirrorPrepareError(
      'Director prepare başarısız oldu.',
      'prepare_http_error'
    );
  }
  // apiClient may place FastAPI response_model fields on `res` itself when the
  // body has no nested `data` key. Prefer res.data, then unwrapped body fields.
  const data = unwrapPrepareDirectorResult(res);
  if (!data) {
    throw new MirrorPrepareError(
      'Director prepare boş yanıt döndü.',
      'prepare_empty_response'
    );
  }
  return data;
}

/** Normalize apiClient envelope vs raw FastAPI prepare body. */
export function unwrapPrepareDirectorResult(
  res: Record<string, unknown> & { data?: unknown; ok?: boolean }
): PrepareDirectorDraftResult | null {
  const nested = res.data;
  if (nested && typeof nested === 'object' && isPrepareDirectorShape(nested)) {
    return nested as PrepareDirectorDraftResult;
  }
  if (isPrepareDirectorShape(res)) {
    const {
      ok: _ok,
      error: _error,
      detail: _detail,
      data: _data,
      ...rest
    } = res;
    return rest as unknown as PrepareDirectorDraftResult;
  }
  return null;
}

function isPrepareDirectorShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.usedDirector === 'boolean' ||
    typeof v.directorEnabled === 'boolean' ||
    typeof v.directorMode === 'string' ||
    v.mappedPrompt != null
  );
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
