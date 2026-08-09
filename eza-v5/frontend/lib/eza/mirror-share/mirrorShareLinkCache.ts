/**
 * Stage 4C — persist prepared share link per conversation (reload-safe).
 * Scoped by authenticated user id to prevent cross-account leakage.
 *
 * Phase 3.7.5 — Journey V1 also persists artifact-scoped links so Journey A
 * and Journey B never overwrite each other's slug/shareUrl.
 */

const STORAGE_KEY = 'eza_mirror_share_link_v2';
/** Legacy unscoped store — migrated once per conversation under known user. */
const LEGACY_STORAGE_KEY = 'eza_mirror_share_link_v1';
/** Journey artifact share identity (Phase 3.7.5). */
const JOURNEY_SHARE_STORAGE_KEY = 'eza_mirror_journey_share_link_v1';

export type MirrorShareLinkRecord = {
  conversationId: string;
  slug: string;
  shareUrl: string;
  updatedAt: string;
  userId: string;
  publicTitle?: string | null;
  publicSummary?: string | null;
};

export type MirrorJourneyShareLinkRecord = MirrorShareLinkRecord & {
  journeyId: string;
  journeyVersion: number;
  publishedAt: string;
};

type UserStore = Record<string, MirrorShareLinkRecord>;
type RootStore = Record<string, UserStore>;
type JourneyShareUserStore = Record<string, MirrorJourneyShareLinkRecord>;
type JourneyShareRoot = Record<string, JourneyShareUserStore>;

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

function journeyShareKey(journeyId: string, journeyVersion: number): string {
  return `${journeyId.trim().toLowerCase()}::v${journeyVersion}`;
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
            publicTitle:
              typeof row.publicTitle === 'string' ? row.publicTitle : null,
            publicSummary:
              typeof row.publicSummary === 'string' ? row.publicSummary : null,
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

function readJourneyShareRoot(): JourneyShareRoot {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(JOURNEY_SHARE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const root: JourneyShareRoot = {};
    for (const [uid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const userStore: JourneyShareUserStore = {};
      for (const [key, rowValue] of Object.entries(value as Record<string, unknown>)) {
        if (!rowValue || typeof rowValue !== 'object') continue;
        const row = rowValue as Record<string, unknown>;
        if (
          typeof row.conversationId === 'string' &&
          typeof row.slug === 'string' &&
          typeof row.shareUrl === 'string' &&
          typeof row.journeyId === 'string' &&
          typeof row.journeyVersion === 'number' &&
          typeof row.publishedAt === 'string'
        ) {
          userStore[key] = {
            conversationId: row.conversationId,
            slug: row.slug,
            shareUrl: row.shareUrl,
            updatedAt:
              typeof row.updatedAt === 'string' ? row.updatedAt : row.publishedAt,
            userId: typeof row.userId === 'string' ? row.userId : uid,
            publicTitle:
              typeof row.publicTitle === 'string' ? row.publicTitle : null,
            publicSummary:
              typeof row.publicSummary === 'string' ? row.publicSummary : null,
            journeyId: row.journeyId,
            journeyVersion: row.journeyVersion,
            publishedAt: row.publishedAt,
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

function writeJourneyShareRoot(root: JourneyShareRoot): void {
  storage()?.setItem(JOURNEY_SHARE_STORAGE_KEY, JSON.stringify(root));
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

/** Legacy / non-Journey: one share link per conversation. */
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
  now: Date = new Date(),
  landing?: { publicTitle?: string | null; publicSummary?: string | null }
): MirrorShareLinkRecord | null {
  const conv = conversationId.trim();
  const uid = normalizeUserId(userId);
  if (!conv || !uid) return null;
  const existing = readRoot()[uid]?.[conv];
  const record: MirrorShareLinkRecord = {
    conversationId: conv,
    slug: slug.trim(),
    shareUrl: shareUrl.trim(),
    updatedAt: now.toISOString(),
    userId: uid,
    publicTitle:
      landing?.publicTitle?.trim() ||
      existing?.publicTitle?.trim() ||
      null,
    publicSummary:
      landing?.publicSummary?.trim() ||
      existing?.publicSummary?.trim() ||
      null,
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

/** Journey V1 — artifact-scoped share identity. */
export function readMirrorShareLinkForJourney(
  userId: string | null | undefined,
  journeyId: string,
  journeyVersion: number
): MirrorJourneyShareLinkRecord | null {
  const uid = normalizeUserId(userId);
  const jid = journeyId.trim().toLowerCase();
  if (!uid || !jid || !Number.isFinite(journeyVersion)) return null;
  return readJourneyShareRoot()[uid]?.[journeyShareKey(jid, journeyVersion)] ?? null;
}

export function saveMirrorShareLinkForJourney(input: {
  userId: string | null | undefined;
  conversationId: string;
  journeyId: string;
  journeyVersion: number;
  slug: string;
  shareUrl: string;
  publicTitle?: string | null;
  publicSummary?: string | null;
  now?: Date;
}): MirrorJourneyShareLinkRecord | null {
  const uid = normalizeUserId(input.userId);
  const conv = input.conversationId.trim();
  const jid = input.journeyId.trim().toLowerCase();
  if (!uid || !conv || !jid || !Number.isFinite(input.journeyVersion)) return null;
  const nowIso = (input.now || new Date()).toISOString();
  const key = journeyShareKey(jid, input.journeyVersion);
  const existing = readJourneyShareRoot()[uid]?.[key];
  const record: MirrorJourneyShareLinkRecord = {
    conversationId: conv,
    journeyId: jid,
    journeyVersion: input.journeyVersion,
    slug: input.slug.trim(),
    shareUrl: input.shareUrl.trim(),
    updatedAt: nowIso,
    publishedAt: existing?.publishedAt || nowIso,
    userId: uid,
    publicTitle:
      input.publicTitle?.trim() || existing?.publicTitle?.trim() || null,
    publicSummary:
      input.publicSummary?.trim() || existing?.publicSummary?.trim() || null,
  };
  const root = readJourneyShareRoot();
  const userStore = root[uid] ?? {};
  userStore[key] = record;
  root[uid] = userStore;
  writeJourneyShareRoot(root);
  return record;
}

export function listMirrorShareLinksForConversation(
  userId: string | null | undefined,
  conversationId: string
): MirrorJourneyShareLinkRecord[] {
  const uid = normalizeUserId(userId);
  const conv = conversationId.trim();
  if (!uid || !conv) return [];
  const userStore = readJourneyShareRoot()[uid] ?? {};
  return Object.values(userStore)
    .filter((row) => row.conversationId === conv && row.userId === uid)
    .sort(
      (a, b) =>
        a.journeyVersion - b.journeyVersion ||
        a.publishedAt.localeCompare(b.publishedAt)
    );
}

export function clearMirrorShareLinksForJourneyUser(
  userId: string | null | undefined
): void {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  const root = readJourneyShareRoot();
  if (!root[uid]) return;
  delete root[uid];
  writeJourneyShareRoot(root);
}
