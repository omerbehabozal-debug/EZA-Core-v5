/**
 * PREVIEW / TEST HELPER ONLY — not production snapshot authority.
 *
 * Production Mirror Director analysis snapshots are built by:
 *   eza-v5/backend/services/mirror/conversation_snapshot.py
 *
 * Frontend sends permitted message DTOs; backend cleans, dedupes, selects,
 * and applies token/char caps. Do not use this module as a second production
 * implementation for LLM analysis input.
 *
 * Kept for local Vitest fixtures and UI preview experiments.
 */

export type SnapshotMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type MirrorConversationSnapshot = {
  title: string | null;
  messages: readonly SnapshotMessage[];
  conversationSummary: string | null;
  charCount: number;
  truncated: boolean;
};

export const DEFAULT_MAX_SNAPSHOT_CHARS = 4500;
const MAX_ASSISTANT_SNIPPET_CHARS = 280;
const MAX_USER_MESSAGE_CHARS = 600;
const HEAD_USER_KEEP = 4;
const TAIL_USER_KEEP = 8;

const PRIVATE_KEY_RE =
  /(user[_-]?id|guest[_-]?token|auth|password|api[_-]?key|lineage|archive|session|cookie|authorization|bearer|refresh|access[_-]?token)/i;

function cleanText(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1).trimEnd()}…`;
}

function dedupeKeepOrder(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const key = raw.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

function selectUserMessages(users: string[]): string[] {
  if (users.length <= HEAD_USER_KEEP + TAIL_USER_KEEP) return users;
  const head = users.slice(0, HEAD_USER_KEEP);
  const tail = users.slice(-TAIL_USER_KEEP);
  const middle = users.slice(HEAD_USER_KEEP, -TAIL_USER_KEEP);
  const scored = [...middle].sort((a, b) => {
    const score = (t: string) =>
      (t.includes('?') || t.includes('？') ? 1_000_000 : 0) +
      (t.length >= 40 ? 100_000 : 0) +
      t.length;
    return score(b) - score(a);
  });
  const midPick = scored.slice(0, 3);
  const chosen = new Set([...head, ...midPick, ...tail]);
  return users.filter((u) => chosen.has(u));
}

/** @deprecated Preview/test only — production authority is backend conversation_snapshot.py */
export function buildMirrorConversationSnapshotPreview(input: {
  title?: string | null;
  userMessages?: readonly string[] | null;
  assistantMessages?: readonly string[] | null;
  conversationSummary?: string | null;
  maxChars?: number;
  includeAssistant?: boolean;
}): MirrorConversationSnapshot {
  const maxChars = input.maxChars ?? DEFAULT_MAX_SNAPSHOT_CHARS;
  const users = dedupeKeepOrder(
    (input.userMessages ?? [])
      .filter((m) => Boolean(m?.trim()))
      .map((m) => cleanText(m, MAX_USER_MESSAGE_CHARS))
  );
  const assistants =
    input.includeAssistant === true
      ? dedupeKeepOrder(
          (input.assistantMessages ?? [])
            .filter((m) => Boolean(m?.trim()))
            .map((m) => cleanText(m, MAX_ASSISTANT_SNIPPET_CHARS))
        )
      : [];

  let safeTitle = input.title ? cleanText(input.title, 120) : null;
  if (safeTitle && PRIVATE_KEY_RE.test(safeTitle)) safeTitle = null;
  let safeSummary = input.conversationSummary
    ? cleanText(input.conversationSummary, 400)
    : null;

  const selectedUsers = selectUserMessages(users);
  const messages: SnapshotMessage[] = selectedUsers.map((text) => ({ role: 'user', text }));
  let truncated = users.length > selectedUsers.length;

  const count = () =>
    (safeTitle?.length ?? 0) +
    (safeSummary?.length ?? 0) +
    messages.reduce((n, m) => n + m.text.length + 8, 0);

  if (input.includeAssistant && assistants.length && count() < maxChars) {
    for (const snippet of assistants.slice(-2)) {
      if (count() + snippet.length + 12 > maxChars) {
        truncated = true;
        break;
      }
      messages.push({ role: 'assistant', text: snippet });
    }
  }

  while (count() > maxChars && messages.length > 2) {
    const dropIdx = messages.findIndex((m, i) => m.role === 'user' && i >= 2);
    if (dropIdx < 0) break;
    messages.splice(dropIdx, 1);
    truncated = true;
  }

  if (count() > maxChars && safeSummary) {
    safeSummary = null;
    truncated = true;
  }

  return {
    title: safeTitle,
    messages,
    conversationSummary: safeSummary,
    charCount: count(),
    truncated,
  };
}

/** @deprecated Use buildMirrorConversationSnapshotPreview */
export const buildMirrorConversationSnapshot = buildMirrorConversationSnapshotPreview;

export function snapshotToModelInput(snapshot: MirrorConversationSnapshot): {
  title: string | null;
  conversationSummary: string | null;
  messages: Array<{ role: string; text: string }>;
} {
  return {
    title: snapshot.title,
    conversationSummary: snapshot.conversationSummary,
    messages: snapshot.messages.map((m) => ({ role: m.role, text: m.text })),
  };
}

/** Test helper — ensure private keys never appear in model input. */
export function assertSnapshotHasNoPrivateKeys(payload: unknown): void {
  const forbidden = [
    'userId',
    'user_id',
    'guestToken',
    'guest_token',
    'apiKey',
    'api_key',
    'authorization',
    'lineageProof',
    'archiveMeta',
    'password',
    'refreshToken',
    'accessToken',
  ];

  const walk = (obj: unknown, path: string): void => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const lower = k.toLowerCase();
        for (const bad of forbidden) {
          if (lower.includes(bad.toLowerCase())) {
            throw new Error(`private key leaked into snapshot: ${path}.${k}`);
          }
        }
        if (PRIVATE_KEY_RE.test(k)) {
          throw new Error(`private field name in snapshot: ${path}.${k}`);
        }
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
    }
  };

  walk(payload, 'root');
}
