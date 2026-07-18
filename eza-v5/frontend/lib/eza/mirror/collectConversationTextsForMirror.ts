/**
 * Production helper: collect bounded user texts for Mirror heuristic / V3 topic path.
 *
 * Used by StandaloneObservationExperience — tests must call this same function.
 *
 * Merge: archive + in-memory live messages (duplicate-safe, order preserved).
 * Bounds: heuristic-path only (LLM analysis snapshot authority remains backend).
 */

export type ConversationTextSourceMessage = {
  id?: string;
  text: string;
  isUser: boolean;
};

/** Soft cap for semantic-first topic resolution (not the LLM Director snapshot). */
export const HEURISTIC_CONVERSATION_TEXTS_MAX_CHARS = 6000;
export const HEURISTIC_CONVERSATION_TEXT_MAX_PER_MESSAGE = 800;
const HEAD_KEEP = 6;
const TAIL_KEEP = 12;
const MID_PICK = 4;

function normalizeKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Unicode-safe truncation (no mid-surrogate cut). */
export function truncateConversationText(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(cleaned);
  if (chars.length <= maxChars) return cleaned;
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join('').trimEnd()}…`;
}

function selectBoundedTexts(texts: string[]): string[] {
  if (texts.length <= HEAD_KEEP + TAIL_KEEP) return texts;
  const head = texts.slice(0, HEAD_KEEP);
  const tail = texts.slice(-TAIL_KEEP);
  const middle = texts.slice(HEAD_KEEP, -TAIL_KEEP);
  const scored = [...middle].sort((a, b) => {
    const score = (t: string) =>
      (t.includes('?') || t.includes('？') ? 1_000_000 : 0) +
      (t.length >= 40 ? 100_000 : 0) +
      t.length;
    return score(b) - score(a);
  });
  const midPick = scored.slice(0, MID_PICK);
  const chosen = new Set([...head, ...midPick, ...tail]);
  return texts.filter((t) => chosen.has(t));
}

function applyCharBudget(texts: string[], maxChars: number): string[] {
  if (!texts.length) return [];
  const total = texts.reduce((n, t) => n + t.length, 0) + Math.max(0, texts.length - 1);
  if (total <= maxChars) return texts;

  // Keep earliest intent (up to 2) + newest messages that fit.
  const headCount = Math.min(2, texts.length);
  const head = texts.slice(0, headCount);
  const rest = texts.slice(headCount);
  const selectedTail: string[] = [];
  let budget =
    maxChars -
    head.reduce((n, t) => n + t.length, 0) -
    Math.max(0, head.length - 1);

  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const t = rest[i]!;
    const cost = t.length + (selectedTail.length || head.length ? 1 : 0);
    if (cost > budget) continue;
    selectedTail.push(t);
    budget -= cost;
  }
  return [...head, ...selectedTail.reverse()];
}

/**
 * Merge archive + live user messages, then bound for heuristic Mirror build.
 */
export function collectConversationTextsForMirror(input: {
  archiveMessages?: readonly ConversationTextSourceMessage[] | null;
  liveMessages?: readonly ConversationTextSourceMessage[] | null;
  maxChars?: number;
  maxPerMessage?: number;
}): string[] | undefined {
  const maxChars = input.maxChars ?? HEURISTIC_CONVERSATION_TEXTS_MAX_CHARS;
  const maxPerMessage = input.maxPerMessage ?? HEURISTIC_CONVERSATION_TEXT_MAX_PER_MESSAGE;

  const seenIds = new Set<string>();
  const seenNorm = new Set<string>();
  const ordered: string[] = [];

  const push = (message: ConversationTextSourceMessage) => {
    if (!message.isUser) return;
    const raw = message.text?.trim();
    if (!raw) return;
    const text = truncateConversationText(raw, maxPerMessage);
    if (!text) return;
    if (message.id) {
      if (seenIds.has(message.id)) return;
      seenIds.add(message.id);
    }
    const norm = normalizeKey(text);
    if (seenNorm.has(norm)) return;
    seenNorm.add(norm);
    ordered.push(text);
  };

  for (const message of input.archiveMessages ?? []) push(message);
  for (const message of input.liveMessages ?? []) push(message);

  if (!ordered.length) return undefined;

  const selected = selectBoundedTexts(ordered);
  const bounded = applyCharBudget(selected, maxChars);
  return bounded.length ? bounded : undefined;
}

/**
 * Experience-facing orchestration: resolve texts for a conversation id.
 * Inject getters so unit tests exercise the same path without mounting React.
 */
export function resolveMirrorBuildConversationTexts(input: {
  conversationId: string | null | undefined;
  getArchiveMessages: (
    conversationId: string
  ) => readonly ConversationTextSourceMessage[] | null | undefined;
  getLiveMessages: (
    conversationId: string
  ) => readonly ConversationTextSourceMessage[] | null | undefined;
}): string[] | undefined {
  if (!input.conversationId) return undefined;
  return collectConversationTextsForMirror({
    archiveMessages: input.getArchiveMessages(input.conversationId),
    liveMessages: input.getLiveMessages(input.conversationId),
  });
}
