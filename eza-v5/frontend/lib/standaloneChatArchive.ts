/**
 * Standalone sohbet arşivi — yalnızca bu tarayıcıda (localStorage).
 */

import { clearChatDraft } from './standaloneChatDraft';

export const ARCHIVE_UPDATED_EVENT = 'eza-standalone-archive-updated';
/** Güncel oturum arşivden silindi — ana sayfa sohbeti temizlemeli */
export const ACTIVE_ARCHIVE_CLEARED_EVENT = 'eza-standalone-active-archive-cleared';
/** Tek aktif oturum — otomatik kayıt bu kimliğe yazılır */
export const ACTIVE_SESSION_ARCHIVE_ID = 'session-active';
const STORAGE_KEY = 'eza_standalone_chat_archive';
const MAX_ARCHIVES = 30;

export interface ArchivedChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  timestamp?: string;
}

export interface ArchivedChat {
  id: string;
  title: string;
  preview: string;
  savedAt: string;
  messageCount: number;
  messages: ArchivedChatMessage[];
  /** Otomatik kayıt; yeni sohbet öncesi kalıcı arşive taşınabilir */
  autoSaved?: boolean;
}

export type ArchivedChatSummary = Pick<
  ArchivedChat,
  'id' | 'title' | 'preview' | 'savedAt' | 'messageCount'
>;

function notifyArchiveUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
}

function readAll(): ArchivedChat[] {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ARCHIVES)));
    notifyArchiveUpdated();
  } catch {
    /* quota */
  }
}

/** Sidebar satırına sığan kısa başlık (yatay kaydırma yok) */
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
  if (!firstUser) return `Sohbet · ${new Date().toLocaleDateString('tr-TR')}`;
  return summarizeArchiveTitle(firstUser.text);
}

export function listChatArchives(): ArchivedChatSummary[] {
  return readAll().map(({ id, title, preview, savedAt, messageCount }) => ({
    id,
    title,
    preview,
    savedAt,
    messageCount,
  }));
}

export function getChatArchive(id: string): ArchivedChat | null {
  return readAll().find((a) => a.id === id) ?? null;
}

function buildArchiveEntry(
  id: string,
  messages: ArchivedChatMessage[],
  options?: { autoSaved?: boolean }
): ArchivedChat | null {
  if (messages.length === 0) return null;

  const normalized = messages.map((m) => ({
    ...m,
    timestamp: m.timestamp ?? new Date().toISOString(),
  }));

  const preview =
    normalized.find((m) => m.isUser)?.text.trim().slice(0, 80) ||
    normalized[0]?.text.trim().slice(0, 80) ||
    '';

  const existing = readAll().find((a) => a.id === id);

  return {
    id,
    title: buildTitle(normalized),
    preview,
    savedAt: new Date().toISOString(),
    messageCount: normalized.length,
    messages: normalized,
    autoSaved: options?.autoSaved ?? existing?.autoSaved,
  };
}

/** Aktif oturumu günceller (otomatik kayıt) */
export function upsertActiveChatArchive(messages: ArchivedChatMessage[]): ArchivedChat | null {
  if (typeof window === 'undefined' || messages.length === 0) return null;

  const entry = buildArchiveEntry(ACTIVE_SESSION_ARCHIVE_ID, messages, { autoSaved: true });
  if (!entry) return null;

  const rest = readAll().filter((a) => a.id !== ACTIVE_SESSION_ARCHIVE_ID);
  writeAll([entry, ...rest]);
  return entry;
}

/** Aktif oturumu kalıcı arşive taşır (yeni sohbet — sakla) */
export function finalizeActiveSession(): string | null {
  const all = readAll();
  const active = all.find((a) => a.id === ACTIVE_SESSION_ARCHIVE_ID);
  if (!active || active.messageCount === 0) return null;

  const permanentId = `arch-${Date.now()}`;
  const finalized: ArchivedChat = {
    ...active,
    id: permanentId,
    savedAt: new Date().toISOString(),
    autoSaved: false,
  };
  writeAll([finalized, ...all.filter((a) => a.id !== ACTIVE_SESSION_ARCHIVE_ID)]);
  return permanentId;
}

export function clearActiveSessionArchive(): void {
  deleteChatArchive(ACTIVE_SESSION_ARCHIVE_ID);
}

export function saveChatArchive(messages: ArchivedChatMessage[]): ArchivedChat | null {
  if (typeof window === 'undefined' || messages.length === 0) return null;

  const entry = buildArchiveEntry(`arch-${Date.now()}`, messages, { autoSaved: false });
  if (!entry) return null;

  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteChatArchive(id: string): void {
  const wasActive = id === ACTIVE_SESSION_ARCHIVE_ID;
  writeAll(readAll().filter((a) => a.id !== id));
  if (wasActive) {
    clearChatDraft();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACTIVE_ARCHIVE_CLEARED_EVENT));
    }
  }
}
