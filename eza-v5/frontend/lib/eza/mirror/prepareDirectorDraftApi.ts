/**
 * Client for POST /api/standalone/mirror/prepare-director-draft (PR C).
 * Does not consume visual quota. Backend flag authority.
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
    // Soft-fail to legacy — never block image path on prepare HTTP errors
    return {
      directorEnabled: false,
      usedDirector: false,
      fallbackReason: 'prepare_http_error',
    };
  }
  return (
    res.data ?? {
      directorEnabled: false,
      usedDirector: false,
      fallbackReason: 'prepare_empty_response',
    }
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
