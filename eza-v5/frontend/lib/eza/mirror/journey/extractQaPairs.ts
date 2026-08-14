/**
 * Deterministic Q/A pairing — RFC §4.2 + Phase 2 PASS role hardening.
 *
 * Only pairs eligible conversational roles: user → assistant.
 * system / tool / noise / unknown / incomplete → NOT ELIGIBLE (never guessed).
 */

import type {
  EligibleQaPair,
  JourneyMessageLike,
  JourneyMessageRole,
} from './types';

const NOISE_ID_PREFIXES = ['saved-', 'limit-', 'mirror-open-'] as const;

const LOW_INFO_QUESTION =
  /^(evet|hayır|peki|başka|tamam|ok|okay|yes|no|hm+|hmm+|eee+)\.?$/i;

export function resolveJourneyMessageRole(
  msg: JourneyMessageLike
): JourneyMessageRole {
  const id = (msg.id || '').trim();
  if (!id || NOISE_ID_PREFIXES.some((p) => id.startsWith(p))) {
    return 'noise';
  }
  if (msg.role) {
    return msg.role;
  }
  if (msg.isUser === true) return 'user';
  if (msg.isUser === false) return 'assistant';
  return 'unknown';
}

export function isEligiblePairingMessage(msg: JourneyMessageLike): boolean {
  const role = resolveJourneyMessageRole(msg);
  if (role !== 'user' && role !== 'assistant') return false;
  if (msg.incomplete) return false;
  if (!msg.text || !msg.text.trim()) return false;
  return true;
}

export function isLowInformationQuestion(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  return LOW_INFO_QUESTION.test(t);
}

export function extractQaPairs(messages: JourneyMessageLike[]): EligibleQaPair[] {
  const pairs: EligibleQaPair[] = [];
  const usedUserIds = new Set<string>();
  const usedAssistantIds = new Set<string>();
  const superseded = new Set<string>();

  for (const msg of messages) {
    const replaced = msg.replacesAssistantMessageId?.trim();
    if (replaced) superseded.add(replaced);
  }

  let lastUser: JourneyMessageLike | null = null;

  for (const msg of messages) {
    const role = resolveJourneyMessageRole(msg);
    if (!isEligiblePairingMessage(msg)) {
      // system / tool / noise / incomplete — never clear a prior eligible user.
      continue;
    }

    if (role === 'user') {
      lastUser = msg;
      continue;
    }

    // assistant
    if (superseded.has(msg.id) || usedAssistantIds.has(msg.id)) continue;

    const user = lastUser;
    if (!user || resolveJourneyMessageRole(user) !== 'user') continue;
    if (!isEligiblePairingMessage(user)) continue;
    if (usedUserIds.has(user.id)) continue;

    usedUserIds.add(user.id);
    usedAssistantIds.add(msg.id);
    pairs.push({
      userMessageId: user.id,
      assistantMessageId: msg.id,
      publicQuestion: user.text.trim(),
      publicAnswer: msg.text.trim(),
      sourceOrder: pairs.length,
    });
    lastUser = null;
  }

  return pairs;
}
