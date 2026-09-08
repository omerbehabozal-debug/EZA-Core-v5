/**
 * Conversation display title helpers — Stage 1 (first message) + Stage 2 (Yansı).
 * Deterministic only; no AI dependency.
 */

export const DEFAULT_CONVERSATION_TITLE = 'Yeni sohbet';
/** Soft target for sidebar/header — shorter than archive hard cap (80). */
export const CONVERSATION_TITLE_SOFT_MAX = 48;

export function isDefaultConversationTitle(title: string | null | undefined): boolean {
  const t = (title || '').trim().toLocaleLowerCase('tr');
  return !t || t === 'yeni sohbet';
}

function softTrimTitle(text: string, maxLen: number): string {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  t = t.replace(/…$/, '').replace(/\.\.\.$/, '').trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Deterministic short title from first meaningful user text.
 * Does not call AI. Safe to run on every first message; does not block send.
 */
export function deriveConversationTitle(raw: string): string {
  let text = (raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';

  // Prefer clause before first question mark when it yields a usable phrase.
  const qIdx = text.indexOf('?');
  if (qIdx >= 8) {
    const before = text.slice(0, qIdx).trim();
    if (before.length >= 8) text = before;
  }

  text = text
    .replace(/\s+(lütfen|pls|please)\.?$/i, '')
    .replace(/[.!]+$/g, '')
    .trim();

  return softTrimTitle(text, CONVERSATION_TITLE_SOFT_MAX);
}

/**
 * Display precedence:
 * Yansı public title (when provided) > non-default persisted title > default.
 * After Stage 2 promotion, Yansı title is stored as pinned conversation title,
 * so callers typically omit yansiPublicTitle.
 */
export function resolveDisplayConversationTitle(input: {
  title?: string | null;
  titlePinned?: boolean | null;
  yansiPublicTitle?: string | null;
}): string {
  const yansi = (input.yansiPublicTitle || '').trim();
  if (yansi) return softTrimTitle(yansi, CONVERSATION_TITLE_SOFT_MAX) || yansi;

  const title = (input.title || '').trim();
  if (title && !isDefaultConversationTitle(title)) {
    return softTrimTitle(title, CONVERSATION_TITLE_SOFT_MAX) || title;
  }
  return DEFAULT_CONVERSATION_TITLE;
}
