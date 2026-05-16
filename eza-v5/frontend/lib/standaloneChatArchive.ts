/**
 * Standalone sohbet arşivi — yalnızca bu tarayıcıda (localStorage).
 */

export const ARCHIVE_UPDATED_EVENT = 'eza-standalone-archive-updated';
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

function buildTitle(messages: ArchivedChatMessage[]): string {
  const firstUser = messages.find((m) => m.isUser && m.text.trim());
  if (!firstUser) return `Sohbet · ${new Date().toLocaleDateString('tr-TR')}`;
  const t = firstUser.text.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
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

export function saveChatArchive(messages: ArchivedChatMessage[]): ArchivedChat | null {
  if (typeof window === 'undefined' || messages.length === 0) return null;

  const normalized = messages.map((m) => ({
    ...m,
    timestamp: m.timestamp ?? new Date().toISOString(),
  }));

  const preview =
    normalized.find((m) => m.isUser)?.text.trim().slice(0, 80) ||
    normalized[0]?.text.trim().slice(0, 80) ||
    '';

  const entry: ArchivedChat = {
    id: `arch-${Date.now()}`,
    title: buildTitle(normalized),
    preview,
    savedAt: new Date().toISOString(),
    messageCount: normalized.length,
    messages: normalized,
  };

  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteChatArchive(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}
