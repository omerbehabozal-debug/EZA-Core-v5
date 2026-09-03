/**
 * Standalone sohbet sekmeleri — her sohbet ayrı kayıt (localStorage).
 * Arşiv sayfası yok; yan menüden sekmeye dönünce kaldığın yerden devam.
 */

import { generateChatClientId } from '@/lib/eza/clientStableIds';
import { touchConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import type { ConversationTreeMetadata } from '@/lib/eza/conversation-tree/types';
import {
  isChatDeleted,
  markChatDeleted,
  purgeConversationLocalState,
} from '@/lib/standaloneChatDelete';
import {
  buildConversationSceneIdentityFields,
  type ConversationSceneIdentityInput,
  type ConversationSceneSource,
} from '@/lib/eza/conversationSceneIdentity';
import {
  trackConversationCreatedInGroup,
} from '@/lib/eza/conversation-tree/conversationTreeAnalytics';
import {
  type LocalIdentityScope,
  resolveCurrentLocalIdentityScope,
  scopeKey,
} from '@/lib/eza/localIdentityScope';

export type { ConversationSceneSource } from '@/lib/eza/conversationSceneIdentity';
export { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';

export const CHATS_UPDATED_EVENT = 'eza-standalone-archive-updated';
/** @deprecated */
export const ARCHIVE_UPDATED_EVENT = CHATS_UPDATED_EVENT;

/** Legacy flat array key — migrated into scoped buckets on first read. */
export const STORAGE_KEY = 'eza_standalone_chat_archive';
const SCOPED_STORAGE_KEY = 'eza_standalone_chat_archive_scoped_v1';
/** Legacy global active pointer — migrated into scoped map. */
export const ACTIVE_CHAT_ID_KEY = 'eza_standalone_active_chat_id';
const SCOPED_ACTIVE_CHAT_KEY = 'eza_standalone_active_chat_id_scoped_v1';
/** Guest cache only — authenticated user buckets must never silently truncate. */
export const GUEST_MAX_CHATS = 30;
/** @deprecated Phase 8.8G-3.2 — auth buckets no longer use this destructive cap. */
const MAX_CHATS = GUEST_MAX_CHATS;

type ScopedChatBuckets = Record<string, ArchivedChat[]>;
type ScopedActiveMap = Record<string, string | null>;

/** Eski tek «güncel» oturum kimliği — migrasyon için */
const LEGACY_ACTIVE_SESSION_ID = 'session-active';

export interface ArchivedChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  timestamp?: string;
}

/** Guest mirror-origin metadata — internal field names; never label "seed" in UI. */
export interface MirrorConversationOrigin {
  startedFromMirrorId: string;
  parentMirrorId: string;
  rootMirrorId: string;
  seedTopic: string;
  seedCategory: string;
  seedMood: string;
  /** Server-issued proof for verified Yansı lineage at publish time. */
  lineageProofToken?: string;
  isGuestSession: true;
  /** First user message awaits assistant stream on standalone load. */
  autoReplyPending?: boolean;
  pendingUserMessage?: string;
}

export interface ArchivedChat {
  id: string;
  /** Server UUID when conversation is authenticated + durable (Phase 8.8G-2). */
  serverConversationId?: string;
  title: string;
  preview: string;
  savedAt: string;
  messageCount: number;
  messages: ArchivedChatMessage[];
  /** Kullanıcı sabitledi (sidebar'da en üstte). Geriye uyumlu opsiyonel. */
  pinned?: boolean;
  /** Kullanıcı başlığı elle değiştirdi → autosave başlığı yeniden hesaplamasın. */
  titlePinned?: boolean;
  /** @deprecated Prefer treeMetadata — kept for Stage 2B mirror guest flow */
  mirrorOrigin?: MirrorConversationOrigin;
  groupId?: string | null;
  treeMetadata?: ConversationTreeMetadata;
  /** Sohbet görsel kimliği — mirror runtime sceneImageUrl'den ayrı. */
  conversationSceneUrl?: string | null;
  conversationSceneSource?: ConversationSceneSource | null;
  conversationSceneSlug?: string | null;
  /** Phase 8.8G-4 — server-backed unpublished ready Yansı. */
  hasReadyYansi?: boolean;
  publishedYansiSlug?: string | null;
}

export type ArchivedChatSummary = Pick<
  ArchivedChat,
  | 'id'
  | 'serverConversationId'
  | 'title'
  | 'preview'
  | 'savedAt'
  | 'messageCount'
  | 'pinned'
  | 'titlePinned'
  | 'groupId'
  | 'conversationSceneUrl'
  | 'conversationSceneSource'
  | 'conversationSceneSlug'
  | 'hasReadyYansi'
  | 'publishedYansiSlug'
> & {
  isMirrorSource?: boolean;
};

function notifyChatsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
}

function readScopedBuckets(): ScopedChatBuckets {
  if (typeof window === 'undefined') return {};
  try {
    const scopedRaw = localStorage.getItem(SCOPED_STORAGE_KEY);
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: ScopedChatBuckets = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (Array.isArray(value)) out[key] = value as ArchivedChat[];
        }
        return out;
      }
    }

    // Legacy flat array → current identity bucket (guest or user).
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (!legacyRaw) return {};
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return {};
    const scope = resolveCurrentLocalIdentityScope({ createGuestIfMissing: true });
    if (!scope) return {};
    const buckets: ScopedChatBuckets = { [scopeKey(scope)]: legacy as ArchivedChat[] };
    localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify(buckets));
    localStorage.removeItem(STORAGE_KEY);
    return buckets;
  } catch {
    return {};
  }
}

function writeScopedBuckets(buckets: ScopedChatBuckets): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify(buckets));
    // Keep legacy key empty so old readers do not resurrect a global list.
    localStorage.removeItem(STORAGE_KEY);
    notifyChatsUpdated();
    return true;
  } catch {
    /* quota — do not replace existing storage with a truncated subset */
    return false;
  }
}

function readActiveMap(): ScopedActiveMap {
  if (typeof window === 'undefined') return {};
  try {
    const scopedRaw = localStorage.getItem(SCOPED_ACTIVE_CHAT_KEY);
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ScopedActiveMap;
      }
    }
    const legacy = localStorage.getItem(ACTIVE_CHAT_ID_KEY);
    if (!legacy) return {};
    const scope = resolveCurrentLocalIdentityScope({ createGuestIfMissing: true });
    if (!scope) return {};
    const map: ScopedActiveMap = { [scopeKey(scope)]: legacy };
    localStorage.setItem(SCOPED_ACTIVE_CHAT_KEY, JSON.stringify(map));
    localStorage.removeItem(ACTIVE_CHAT_ID_KEY);
    return map;
  } catch {
    return {};
  }
}

function writeActiveMap(map: ScopedActiveMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCOPED_ACTIVE_CHAT_KEY, JSON.stringify(map));
    localStorage.removeItem(ACTIVE_CHAT_ID_KEY);
  } catch {
    /* ignore */
  }
}

function requireCurrentScope(): LocalIdentityScope | null {
  return resolveCurrentLocalIdentityScope({ createGuestIfMissing: true });
}

function readAllRawForScope(scope: LocalIdentityScope): ArchivedChat[] {
  const buckets = readScopedBuckets();
  const list = buckets[scopeKey(scope)];
  return Array.isArray(list) ? list : [];
}

function writeAllForScope(scope: LocalIdentityScope, list: ArchivedChat[]): void {
  const buckets = readScopedBuckets();
  const sorted = [...list].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  // Phase 8.8G-3.2 — authenticated buckets preserve all chats (migration source).
  // Guest cache may remain bounded; never silently discard account history.
  const nextList =
    scope.kind === 'guest' ? sorted.slice(0, GUEST_MAX_CHATS) : sorted;
  buckets[scopeKey(scope)] = nextList;
  writeScopedBuckets(buckets);
}

function readAllRaw(): ArchivedChat[] {
  const scope = requireCurrentScope();
  if (!scope) return [];
  return readAllRawForScope(scope);
}

function writeAll(list: ArchivedChat[]): void {
  const scope = requireCurrentScope();
  if (!scope) return;
  writeAllForScope(scope, list);
}

/** Read archives for an explicit identity (guest→user rebind). */
export function readChatArchivesForScope(scope: LocalIdentityScope): ArchivedChat[] {
  return migrateLegacyListForScope(scope, readAllRawForScope(scope));
}

/** Replace archives for an explicit identity (guest→user rebind). */
export function replaceChatArchivesForScope(
  scope: LocalIdentityScope,
  list: ArchivedChat[]
): void {
  writeAllForScope(scope, list);
}

export function readActiveChatIdForScope(scope: LocalIdentityScope): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = readActiveMap()[scopeKey(scope)];
    if (!id) return null;
    return readAllRawForScope(scope).some((c) => c.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function writeActiveChatIdForScope(scope: LocalIdentityScope, id: string | null): void {
  if (typeof window === 'undefined') return;
  const map = readActiveMap();
  const key = scopeKey(scope);
  if (!id) {
    delete map[key];
  } else {
    map[key] = id;
  }
  writeActiveMap(map);
}

function migrateLegacyListForScope(
  scope: LocalIdentityScope,
  list: ArchivedChat[]
): ArchivedChat[] {
  let changed = false;
  const out = list.map((item) => {
    if (item.id === LEGACY_ACTIVE_SESSION_ID) {
      changed = true;
      return {
        ...item,
        id: `chat-${new Date(item.savedAt).getTime()}`,
      };
    }
    return item;
  });
  if (changed) writeAllForScope(scope, out);
  return out;
}

function migrateLegacyList(list: ArchivedChat[]): ArchivedChat[] {
  const scope = requireCurrentScope();
  if (!scope) return list;
  return migrateLegacyListForScope(scope, list);
}

function readAll(): ArchivedChat[] {
  return migrateLegacyList(readAllRaw());
}

export const ARCHIVE_TITLE_MAX_LEN = 80;

export function summarizeArchiveTitle(text: string, maxLen = ARCHIVE_TITLE_MAX_LEN): string {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  t = t.replace(/…$/, '').replace(/\.\.\.$/, '').trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim();
}

function isMirrorSourceChat(chat: ArchivedChat): boolean {
  if (chat.treeMetadata?.sourceType === 'mirror' || chat.treeMetadata?.sourceType === 'mirror_branch') {
    return true;
  }
  return Boolean(chat.mirrorOrigin?.startedFromMirrorId);
}

function resolveTreeMetadata(chat: ArchivedChat): ConversationTreeMetadata | undefined {
  if (chat.treeMetadata) return chat.treeMetadata;
  if (!chat.mirrorOrigin) return undefined;
  const o = chat.mirrorOrigin;
  return {
    groupId: chat.groupId ?? null,
    sourceType: 'mirror',
    startedFromMirrorId: o.startedFromMirrorId,
    parentMirrorId: o.parentMirrorId,
    rootMirrorId: o.rootMirrorId,
    seedTopic: o.seedTopic,
    seedCategory: o.seedCategory,
    seedMood: o.seedMood,
    isGuestSession: o.isGuestSession,
  };
}

function toSummary(chat: ArchivedChat): ArchivedChatSummary {
  return {
    id: chat.id,
    serverConversationId: chat.serverConversationId,
    title: chat.title,
    preview: chat.preview,
    savedAt: chat.savedAt,
    messageCount: chat.messageCount,
    pinned: chat.pinned,
    titlePinned: chat.titlePinned,
    groupId: chat.groupId ?? chat.treeMetadata?.groupId ?? null,
    isMirrorSource: isMirrorSourceChat(chat),
    conversationSceneUrl: chat.conversationSceneUrl ?? null,
    conversationSceneSource: chat.conversationSceneSource ?? null,
    conversationSceneSlug: chat.conversationSceneSlug ?? null,
  };
}

function pickConversationSceneFields(chat?: ArchivedChat | null): Partial<ArchivedChat> {
  if (!chat) return {};
  const out: Partial<ArchivedChat> = {};
  if (chat.conversationSceneUrl != null) {
    out.conversationSceneUrl = chat.conversationSceneUrl;
  }
  if (chat.conversationSceneSource != null) {
    out.conversationSceneSource = chat.conversationSceneSource;
  }
  if (chat.conversationSceneSlug != null) {
    out.conversationSceneSlug = chat.conversationSceneSlug;
  }
  return out;
}

function buildTitle(messages: ArchivedChatMessage[]): string {
  const firstUser = messages.find((m) => m.isUser && m.text.trim());
  if (!firstUser) return 'Yeni sohbet';
  return summarizeArchiveTitle(firstUser.text) || 'Yeni sohbet';
}

function buildChatEntry(id: string, messages: ArchivedChatMessage[]): ArchivedChat {
  const normalized = messages.map((m) => ({
    ...m,
    timestamp: m.timestamp ?? new Date().toISOString(),
  }));

  const preview =
    normalized.find((m) => m.isUser)?.text.trim().slice(0, 80) ||
    normalized[0]?.text.trim().slice(0, 80) ||
    '';

  const existing = readAll().find((a) => a.id === id);

  // Kullanıcı başlığı elle değiştirdiyse (titlePinned) koru; aksi halde ilk mesajdan üret.
  const title = existing?.titlePinned ? existing.title : buildTitle(normalized);

  return {
    id,
    ...(existing?.serverConversationId
      ? { serverConversationId: existing.serverConversationId }
      : {}),
    title,
    preview,
    savedAt: new Date().toISOString(),
    messageCount: normalized.length,
    messages: normalized,
    ...(existing?.pinned ? { pinned: true } : {}),
    ...(existing?.titlePinned ? { titlePinned: true } : {}),
    ...(existing?.mirrorOrigin ? { mirrorOrigin: existing.mirrorOrigin } : {}),
    ...(existing?.groupId != null ? { groupId: existing.groupId } : {}),
    ...(existing?.treeMetadata ? { treeMetadata: existing.treeMetadata } : {}),
    ...pickConversationSceneFields(existing),
  };
}

/** Set conversation visual identity on an existing archive row. */
export function setConversationSceneIdentity(
  chatId: string,
  input: ConversationSceneIdentityInput
): ArchivedChat | null {
  if (typeof window === 'undefined') return null;
  const normalized = chatId.trim();
  if (!normalized || isChatDeleted(normalized)) return null;

  const fields = buildConversationSceneIdentityFields(input);
  if (!fields) return null;

  const list = readAll();
  const idx = list.findIndex((a) => a.id === normalized);
  if (idx === -1) return null;

  list[idx] = {
    ...list[idx],
    conversationSceneUrl: fields.conversationSceneUrl,
    conversationSceneSource: fields.conversationSceneSource,
    conversationSceneSlug: fields.conversationSceneSlug,
  };
  writeAll(list);
  return list[idx] ?? null;
}

/** Clear conversation background scene while a new Mirror is being generated. */
export function clearConversationSceneIdentity(chatId: string): ArchivedChat | null {
  if (typeof window === 'undefined') return null;
  const normalized = chatId.trim();
  if (!normalized || isChatDeleted(normalized)) return null;

  const list = readAll();
  const idx = list.findIndex((a) => a.id === normalized);
  if (idx === -1) return null;

  const prev = list[idx];
  list[idx] = {
    ...prev,
    conversationSceneUrl: null,
    conversationSceneSource: null,
    conversationSceneSlug: null,
  };
  writeAll(list);
  return list[idx] ?? null;
}

export type CreateStandaloneChatOptions = {
  groupId?: string | null;
  treeMetadata?: ConversationTreeMetadata;
  title?: string;
  idPrefix?: string;
  serverConversationId?: string;
};

export function createStandaloneChat(options?: CreateStandaloneChatOptions): string {
  const id = generateChatClientId(options?.idPrefix ?? 'chat');
  const groupId = options?.groupId ?? options?.treeMetadata?.groupId ?? null;
  const entry: ArchivedChat = {
    id,
    ...(options?.serverConversationId
      ? { serverConversationId: options.serverConversationId }
      : {}),
    title: options?.title?.trim() || 'Yeni sohbet',
    preview: '',
    savedAt: new Date().toISOString(),
    messageCount: 0,
    messages: [],
    groupId,
    ...(options?.treeMetadata
      ? {
          treeMetadata: {
            ...options.treeMetadata,
            groupId: groupId ?? options.treeMetadata.groupId ?? null,
          },
        }
      : groupId
        ? { treeMetadata: { sourceType: 'direct' as const, groupId } }
        : {}),
  };
  writeAll([entry, ...readAll()]);
  writeActiveChatId(id);
  if (groupId) {
    touchConversationGroup(groupId);
    trackConversationCreatedInGroup(id, groupId);
  }
  return id;
}

export function upsertChatArchive(entry: ArchivedChat): void {
  if (isChatDeleted(entry.id)) return;
  const existing = readAll().find((a) => a.id === entry.id);
  const merged: ArchivedChat = {
    ...existing,
    ...entry,
    ...pickConversationSceneFields(
      entry.conversationSceneUrl != null ? entry : existing
    ),
  };
  const rest = readAll().filter((a) => a.id !== entry.id);
  writeAll([merged, ...rest]);
  writeActiveChatId(entry.id);
  const groupId = merged.groupId ?? merged.treeMetadata?.groupId;
  if (groupId) touchConversationGroup(groupId);
}

export function assignChatToGroup(chatId: string, groupId: string): void {
  const list = readAll();
  const idx = list.findIndex((a) => a.id === chatId);
  if (idx === -1) return;
  const existing = list[idx];
  const treeMetadata: ConversationTreeMetadata = {
    ...(resolveTreeMetadata(existing) ?? { sourceType: 'direct' }),
    groupId,
  };
  list[idx] = {
    ...existing,
    groupId,
    treeMetadata,
  };
  writeAll(list);
  touchConversationGroup(groupId);
  trackConversationCreatedInGroup(chatId, groupId);
}

export function listChatArchives(): ArchivedChatSummary[] {
  return readAll().map(toSummary);
}

export function resolveChatRouteAfterDelete(): string {
  const remaining = listChatArchives();
  if (remaining.length > 0) {
    return `/standalone?chat=${remaining[0]!.id}`;
  }
  return '/standalone/discover';
}

/** Full archives including messages (backfill / migration). */
export function readChatArchives(): ArchivedChat[] {
  return readAll();
}

/** Replace full chat archive list (login merge / migration). */
export function replaceChatArchives(list: ArchivedChat[]): void {
  writeAll(list);
}

/** Sohbeti sabitler / sabitlemeyi kaldırır (localStorage). */
export function setChatPinned(id: string, pinned: boolean): void {
  const list = readAll();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], pinned };
  writeAll(list);
}

/** Sohbet başlığını elle değiştirir; titlePinned ile autosave'in ezmesini engeller. */
export function renameChat(id: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  const list = readAll();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], title: trimmed, titlePinned: true };
  writeAll(list);
  if (typeof window !== 'undefined') {
    void import('@/lib/eza/serverConversationStore').then(
      ({ getServerIdForClientChat, renameServerBackedConversation }) => {
        if (getServerIdForClientChat(id)) {
          void renameServerBackedConversation(id, trimmed);
        }
      }
    );
  }
}

export function getChatArchive(id: string): ArchivedChat | null {
  return readAll().find((a) => a.id === id) ?? null;
}

export function readActiveChatId(): string | null {
  const scope = requireCurrentScope();
  if (!scope) return null;
  return readActiveChatIdForScope(scope);
}

export function writeActiveChatId(id: string): void {
  const scope = requireCurrentScope();
  if (!scope) return;
  writeActiveChatIdForScope(scope, id);
}

/** Mevcut sohbeti günceller veya boş liste ile başlığı korur */
export function saveStandaloneChat(
  id: string,
  messages: ArchivedChatMessage[]
): ArchivedChat | null {
  if (typeof window === 'undefined') return null;
  if (isChatDeleted(id)) return null;

  const entry = buildChatEntry(id, messages);
  const rest = readAll().filter((a) => a.id !== id);
  writeAll([entry, ...rest]);
  writeActiveChatId(id);
  const groupId = entry.groupId ?? entry.treeMetadata?.groupId;
  if (groupId) touchConversationGroup(groupId);
  return entry;
}

export function deleteChatArchive(id: string): void {
  const normalized = id.trim();
  if (!normalized) return;
  markChatDeleted(normalized);
  purgeConversationLocalState(normalized);
  const remaining = readAll().filter((a) => a.id !== normalized);
  writeAll(remaining);
  if (readActiveChatId() === normalized) {
    const scope = requireCurrentScope();
    if (scope) writeActiveChatIdForScope(scope, null);
  }
}

/** Boş sohbetleri temizle (isteğe bağlı) */
export function pruneEmptyChats(exceptId?: string): void {
  const kept = readAll().filter(
    (c) => c.id === exceptId || c.messageCount > 0
  );
  if (kept.length !== readAll().length) writeAll(kept);
}

/** Clear mirror auto-reply flag after standalone consumes pending message. */
export function clearMirrorAutoReplyPending(id: string): void {
  const list = readAll();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const origin = list[idx].mirrorOrigin;
  if (!origin?.autoReplyPending) return;
  list[idx] = {
    ...list[idx],
    mirrorOrigin: {
      ...origin,
      autoReplyPending: false,
      pendingUserMessage: undefined,
    },
  };
  writeAll(list);
}
