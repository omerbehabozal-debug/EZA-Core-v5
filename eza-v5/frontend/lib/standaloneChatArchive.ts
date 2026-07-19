/**
 * Standalone sohbet sekmeleri — her sohbet ayrı kayıt (localStorage).
 * Arşiv sayfası yok; yan menüden sekmeye dönünce kaldığın yerden devam.
 */

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

export type { ConversationSceneSource } from '@/lib/eza/conversationSceneIdentity';
export { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';

export const CHATS_UPDATED_EVENT = 'eza-standalone-archive-updated';
/** @deprecated */
export const ARCHIVE_UPDATED_EVENT = CHATS_UPDATED_EVENT;

const STORAGE_KEY = 'eza_standalone_chat_archive';
const ACTIVE_CHAT_ID_KEY = 'eza_standalone_active_chat_id';
const MAX_CHATS = 30;

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
}

export type ArchivedChatSummary = Pick<
  ArchivedChat,
  | 'id'
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
> & {
  isMirrorSource?: boolean;
};

function notifyChatsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
}

function readAllRaw(): ArchivedChat[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: ArchivedChat[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...list].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, MAX_CHATS)));
    notifyChatsUpdated();
  } catch {
    /* quota */
  }
}

function migrateLegacyList(list: ArchivedChat[]): ArchivedChat[] {
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
  if (changed) writeAll(out);
  return out;
}

function readAll(): ArchivedChat[] {
  return migrateLegacyList(readAllRaw());
}

export const ARCHIVE_TITLE_MAX_LEN = 32;

export function summarizeArchiveTitle(text: string, maxLen = ARCHIVE_TITLE_MAX_LEN): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 12 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
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
};

export function createStandaloneChat(options?: CreateStandaloneChatOptions): string {
  const id = `${options?.idPrefix ?? 'chat'}-${Date.now()}`;
  const groupId = options?.groupId ?? options?.treeMetadata?.groupId ?? null;
  const entry: ArchivedChat = {
    id,
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
  return '/standalone';
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
}

export function getChatArchive(id: string): ArchivedChat | null {
  return readAll().find((a) => a.id === id) ?? null;
}

export function readActiveChatId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = localStorage.getItem(ACTIVE_CHAT_ID_KEY);
    if (!id) return null;
    return getChatArchive(id) ? id : null;
  } catch {
    return null;
  }
}

export function writeActiveChatId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_CHAT_ID_KEY, id);
  } catch {
    /* ignore */
  }
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(ACTIVE_CHAT_ID_KEY);
      } catch {
        /* ignore */
      }
    }
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
