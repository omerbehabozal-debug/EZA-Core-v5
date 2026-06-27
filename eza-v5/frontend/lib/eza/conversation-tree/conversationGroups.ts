/**
 * Conversation groups — client persistence (localStorage).
 * Backend table mirrors this for future sync; guest-first path stays local.
 */

import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import type { ConversationGroup, ConversationGroupSource } from '@/lib/eza/conversation-tree/types';

export const GROUPS_UPDATED_EVENT = 'eza-conversation-groups-updated';
const STORAGE_KEY = 'eza_standalone_conversation_groups';
const MAX_GROUPS = 40;

function notifyGroupsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GROUPS_UPDATED_EVENT));
}

function readAllRaw(): ConversationGroup[] {
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

function writeAll(list: ConversationGroup[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...list].sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderB - orderA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, MAX_GROUPS)));
    notifyGroupsUpdated();
  } catch {
    /* quota */
  }
}

export function listConversationGroups(): ConversationGroup[] {
  return readAllRaw();
}

export function getConversationGroup(id: string): ConversationGroup | null {
  return readAllRaw().find((g) => g.id === id) ?? null;
}

export type CreateConversationGroupInput = {
  title: string;
  source?: ConversationGroupSource;
  userId?: string | null;
  guestToken?: string | null;
  parentGroupId?: string | null;
};

export function createConversationGroup(input: CreateConversationGroupInput): ConversationGroup {
  const now = new Date().toISOString();
  const group: ConversationGroup = {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId ?? null,
    guestToken: input.guestToken ?? getOrCreateMirrorGuestToken(),
    title: input.title.trim(),
    source: input.source ?? 'manual',
    parentGroupId: input.parentGroupId ?? null,
    createdAt: now,
    updatedAt: now,
    sortOrder: Date.now(),
  };
  writeAll([group, ...readAllRaw()]);
  return group;
}

export function touchConversationGroup(id: string): void {
  const list = readAllRaw();
  const idx = list.findIndex((g) => g.id === id);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    updatedAt: new Date().toISOString(),
    sortOrder: Date.now(),
  };
  writeAll(list);
}

export function renameConversationGroup(id: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  const list = readAllRaw();
  const idx = list.findIndex((g) => g.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], title: trimmed, updatedAt: new Date().toISOString() };
  writeAll(list);
}

export function deleteConversationGroup(id: string): void {
  writeAll(readAllRaw().filter((g) => g.id !== id));
}

/** Replace full group list (login merge / migration). */
export function replaceConversationGroups(list: ConversationGroup[]): void {
  writeAll(list);
}
