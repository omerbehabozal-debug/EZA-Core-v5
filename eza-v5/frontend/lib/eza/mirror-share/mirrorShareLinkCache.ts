/**
 * Stage 4C — persist prepared share link per conversation (reload-safe).
 * Scoped by authenticated user id to prevent cross-account leakage.
 */

const STORAGE_KEY = 'eza_mirror_share_link_v2';
/** Legacy unscoped store — migrated once per conversation under known user. */
const LEGACY_STORAGE_KEY = 'eza_mirror_share_link_v1';

export type MirrorShareLinkRecord = {
  conversationId: string;
  slug: string;
  shareUrl: string;
  updatedAt: string;
  userId: string;
};

type UserStore = Record<string, MirrorShareLinkRecord>;
type RootStore = Record<string, UserStore>;

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function normalizeUserId(userId: string | null | undefined): string | null {
  const key = userId?.trim();
  return key ? key : null;
}

function readRoot(): RootStore {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const root: RootStore = {};
    for (const [uid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const userStore: UserStore = {};
      for (const [convId, rowValue] of Object.entries(value as Record<string, unknown>)) {
        if (!rowValue || typeof rowValue !== 'object') continue;
        const row = rowValue as Record<string, unknown>;
        if (
          typeof row.conversationId === 'string' &&
          typeof row.slug === 'string' &&
          typeof row.shareUrl === 'string' &&
          typeof row.updatedAt === 'string'
        ) {
          userStore[convId] = {
            conversationId: row.conversationId,
            slug: row.slug,
            shareUrl: row.shareUrl,
            updatedAt: row.updatedAt,
            userId: typeof row.userId === 'string' ? row.userId : uid,
          };
        }
      }
      root[uid] = userStore;
    }
    return root;
  } catch {
    return {};
  }
}

function writeRoot(root: RootStore): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(root));
}

function readLegacyUnscoped(): Record<string, Omit<MirrorShareLinkRecord, 'userId'>> {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const store: Record<string, Omit<MirrorShareLinkRecord, 'userId'>> = {};
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

function migrateLegacyIfNeeded(userId: string, conversationId: string): MirrorShareLinkRecord | null {
  const legacy = readLegacyUnscoped()[conversationId];
  if (!legacy) return null;
  const record: MirrorShareLinkRecord = { ...legacy, userId };
  const root = readRoot();
  const userStore = root[userId] ?? {};
  if (!userStore[conversationId]) {
    userStore[conversationId] = record;
    root[userId] = userStore;
    writeRoot(root);
  }
  return userStore[conversationId] ?? record;
}

export function readMirrorShareLink(
  conversationId: string,
  userId?: string | null
): MirrorShareLinkRecord | null {
  const conv = conversationId.trim();
  const uid = normalizeUserId(userId);
  if (!conv || !uid) return null;
  const scoped = readRoot()[uid]?.[conv] ?? null;
  if (scoped) return scoped;
  return migrateLegacyIfNeeded(uid, conv);
}

export function saveMirrorShareLink(
  conversationId: string,
  slug: string,
  shareUrl: string,
  userId?: string | null,
  now: Date = new Date()
): MirrorShareLinkRecord | null {
  const conv = conversationId.trim();
  const uid = normalizeUserId(userId);
  if (!conv || !uid) return null;
  const record: MirrorShareLinkRecord = {
    conversationId: conv,
    slug: slug.trim(),
    shareUrl: shareUrl.trim(),
    updatedAt: now.toISOString(),
    userId: uid,
  };
  const root = readRoot();
  const userStore = root[uid] ?? {};
  userStore[conv] = record;
  root[uid] = userStore;
  writeRoot(root);
  return record;
}

export function clearMirrorShareLink(
  conversationId: string,
  userId?: string | null
): void {
  const conv = conversationId.trim();
  if (!conv) return;
  const root = readRoot();
  const uid = normalizeUserId(userId);
  if (uid) {
    const userStore = root[uid];
    if (!userStore?.[conv]) return;
    delete userStore[conv];
    root[uid] = userStore;
    writeRoot(root);
    return;
  }
  // No user scope (e.g. chat delete) — purge this conversation from every account bucket.
  let changed = false;
  for (const [scopedUid, userStore] of Object.entries(root)) {
    if (!userStore[conv]) continue;
    delete userStore[conv];
    root[scopedUid] = userStore;
    changed = true;
  }
  if (changed) writeRoot(root);
}
