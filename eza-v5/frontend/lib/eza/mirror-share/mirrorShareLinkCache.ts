/**
 * Stage 4C — persist prepared share link per conversation (reload-safe).
 */

const STORAGE_KEY = 'eza_mirror_share_link_v1';

export type MirrorShareLinkRecord = {
  conversationId: string;
  slug: string;
  shareUrl: string;
  updatedAt: string;
};

type Store = Record<string, MirrorShareLinkRecord>;

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function readStore(): Store {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const store: Store = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      if (
        typeof row.conversationId === 'string' &&
        typeof row.slug === 'string' &&
        typeof row.shareUrl === 'string' &&
        typeof row.updatedAt === 'string'
      ) {
        store[key] = {
          conversationId: row.conversationId,
          slug: row.slug,
          shareUrl: row.shareUrl,
          updatedAt: row.updatedAt,
        };
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readMirrorShareLink(conversationId: string): MirrorShareLinkRecord | null {
  const key = conversationId.trim();
  if (!key) return null;
  return readStore()[key] ?? null;
}

export function saveMirrorShareLink(
  conversationId: string,
  slug: string,
  shareUrl: string,
  now: Date = new Date()
): MirrorShareLinkRecord {
  const key = conversationId.trim();
  const record: MirrorShareLinkRecord = {
    conversationId: key,
    slug: slug.trim(),
    shareUrl: shareUrl.trim(),
    updatedAt: now.toISOString(),
  };
  const store = readStore();
  store[key] = record;
  writeStore(store);
  return record;
}

export function clearMirrorShareLink(conversationId: string): void {
  const key = conversationId.trim();
  if (!key) return;
  const store = readStore();
  if (!store[key]) return;
  delete store[key];
  writeStore(store);
}
