/**
 * Aktif sohbet taslağı — sekme kapanınca kaybolmasın diye localStorage.
 */

import type { ArchivedChatMessage } from './standaloneChatArchive';

const STORAGE_KEY = 'eza_standalone_chat_draft';

export interface ChatDraft {
  sessionArchiveId: string;
  messages: ArchivedChatMessage[];
  updatedAt: string;
}

export function saveChatDraft(draft: ChatDraft): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function loadChatDraft(): ChatDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatDraft;
    if (!parsed?.messages?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChatDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
