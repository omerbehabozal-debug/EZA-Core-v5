/**
 * Deterministic Q/A pairing — RFC §4.2.
 *
 * For each assistant message with non-empty text:
 *   U = nearest prior user with text not yet used
 *   emit pair { U, A } once
 *
 * Rejects: orphan assistants, system/noise ids, empty text, user-id reuse.
 */

import type { EligibleQaPair, JourneyMessageLike } from './types';

const NOISE_ID_PREFIXES = ['saved-', 'limit-'] as const;

function isNoiseId(id: string): boolean {
  const raw = (id || '').trim();
  return NOISE_ID_PREFIXES.some((p) => raw.startsWith(p));
}

function hasText(msg: JourneyMessageLike | undefined): boolean {
  return Boolean(msg && typeof msg.text === 'string' && msg.text.trim().length > 0);
}

export function extractQaPairs(messages: JourneyMessageLike[]): EligibleQaPair[] {
  const pairs: EligibleQaPair[] = [];
  const usedUserIds = new Set<string>();
  const usedAssistantIds = new Set<string>();

  let lastUser: JourneyMessageLike | null = null;

  for (const msg of messages) {
    if (!msg?.id || isNoiseId(msg.id)) continue;

    if (msg.isUser) {
      if (hasText(msg)) {
        lastUser = msg;
      }
      continue;
    }

    // Assistant turn
    if (!hasText(msg)) continue;
    if (usedAssistantIds.has(msg.id)) continue;

    const user = lastUser;
    if (!user || !hasText(user)) continue;
    if (usedUserIds.has(user.id)) continue;

    usedUserIds.add(user.id);
    usedAssistantIds.add(msg.id);
    pairs.push({
      userMessageId: user.id,
      assistantMessageId: msg.id,
      publicQuestion: user.text.trim(),
      publicAnswer: msg.text.trim(),
    });
    // Freeze this user turn — consecutive assistants after same user do not re-pair.
    lastUser = null;
  }

  return pairs;
}
