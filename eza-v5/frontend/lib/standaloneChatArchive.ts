/**
 * Standalone sohbet sekmeleri — her sohbet ayrı kayıt (localStorage).
 * Arşiv sayfası yok; yan menüden sekmeye dönünce kaldığın yerden devam.
 */

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
  mirrorOrigin?: MirrorConversationOrigin;
}

export type ArchivedChatSummary = Pick<
  ArchivedChat,
  'id' | 'title' | 'preview' | 'savedAt' | 'messageCount' | 'pinned' | 'titlePinned'
>;

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
  };
}

export function listChatArchives(): ArchivedChatSummary[] {
  return readAll().map(({ id, title, preview, savedAt, messageCount, pinned, titlePinned }) => ({
    id,
    title,
    preview,
    savedAt,
    messageCount,
    pinned,
    titlePinned,
  }));
}

/** Full archives including messages (backfill / migration). */
export function readChatArchives(): ArchivedChat[] {
  return readAll();
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

export function createStandaloneChat(): string {
  const id = `chat-${Date.now()}`;
  const entry: ArchivedChat = {
    id,
    title: 'Yeni sohbet',
    preview: '',
    savedAt: new Date().toISOString(),
    messageCount: 0,
    messages: [],
  };
  writeAll([entry, ...readAll()]);
  writeActiveChatId(id);
  return id;
}

/** Mevcut sohbeti günceller veya boş liste ile başlığı korur */
export function saveStandaloneChat(
  id: string,
  messages: ArchivedChatMessage[]
): ArchivedChat | null {
  if (typeof window === 'undefined') return null;

  const entry = buildChatEntry(id, messages);
  const rest = readAll().filter((a) => a.id !== id);
  writeAll([entry, ...rest]);
  writeActiveChatId(id);
  return entry;
}

export function deleteChatArchive(id: string): void {
  const remaining = readAll().filter((a) => a.id !== id);
  writeAll(remaining);
  if (readActiveChatId() === id) {
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
