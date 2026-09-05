/**
 * Conversation groups — client persistence (localStorage).
 * Phase 8.3.1: identity-scoped buckets (user:{id} / guest:{token}).
 * Backend table mirrors this for future sync; guest-first path stays local.
 */

import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import type { ConversationGroup, ConversationGroupSource } from '@/lib/eza/conversation-tree/types';
import {
  type LocalIdentityScope,
  resolveCurrentLocalIdentityScope,
  scopeKey,
} from '@/lib/eza/localIdentityScope';
import { clearChatMembershipsForGroup } from '@/lib/standaloneChatArchive';

export const GROUPS_UPDATED_EVENT = 'eza-conversation-groups-updated';
/** Legacy flat array — migrated into scoped buckets on first read. */
export const GROUPS_STORAGE_KEY = 'eza_standalone_conversation_groups';
const SCOPED_STORAGE_KEY = 'eza_standalone_conversation_groups_scoped_v1';
const MAX_GROUPS = 40;

type ScopedGroupBuckets = Record<string, ConversationGroup[]>;

function notifyGroupsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GROUPS_UPDATED_EVENT));
}

function readScopedBuckets(opts?: { claimFlat?: boolean }): ScopedGroupBuckets {
  if (typeof window === 'undefined') return {};
  try {
    const scopedRaw = localStorage.getItem(SCOPED_STORAGE_KEY);
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: ScopedGroupBuckets = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (Array.isArray(value)) out[key] = value as ConversationGroup[];
        }
        return out;
      }
    }

    // Phase 8.8G-5.3.2 — auth authority paths must not auto-claim flat groups.
    if (opts?.claimFlat === false) {
      return {};
    }

    const legacyRaw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!legacyRaw) return {};
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return {};
    const scope = resolveCurrentLocalIdentityScope({ createGuestIfMissing: true });
    if (!scope) return {};
    const buckets: ScopedGroupBuckets = { [scopeKey(scope)]: legacy as ConversationGroup[] };
    localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify(buckets));
    localStorage.removeItem(GROUPS_STORAGE_KEY);
    return buckets;
  } catch {
    return {};
  }
}

function writeScopedBuckets(buckets: ScopedGroupBuckets): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify(buckets));
    localStorage.removeItem(GROUPS_STORAGE_KEY);
    notifyGroupsUpdated();
  } catch {
    /* quota */
  }
}

function requireCurrentScope(): LocalIdentityScope | null {
  return resolveCurrentLocalIdentityScope({ createGuestIfMissing: true });
}

function sortGroups(list: ConversationGroup[]): ConversationGroup[] {
  return [...list].sort((a, b) => {
    const orderA = a.sortOrder ?? 0;
    const orderB = b.sortOrder ?? 0;
    if (orderA !== orderB) return orderB - orderA;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function readAllRawForScope(scope: LocalIdentityScope): ConversationGroup[] {
  const buckets = readScopedBuckets();
  const list = buckets[scopeKey(scope)];
  return Array.isArray(list) ? list : [];
}

/** Scoped read that never auto-claims flat legacy groups (auth degraded path). */
export function peekScopedConversationGroupsForScope(
  scope: LocalIdentityScope
): ConversationGroup[] {
  const buckets = readScopedBuckets({ claimFlat: false });
  const list = buckets[scopeKey(scope)];
  return Array.isArray(list) ? list : [];
}

function writeAllForScope(scope: LocalIdentityScope, list: ConversationGroup[]): void {
  const buckets = readScopedBuckets();
  buckets[scopeKey(scope)] = sortGroups(list).slice(0, MAX_GROUPS);
  writeScopedBuckets(buckets);
}

function readAllRaw(): ConversationGroup[] {
  const scope = requireCurrentScope();
  if (!scope) return [];
  return readAllRawForScope(scope);
}

function writeAll(list: ConversationGroup[]): void {
  const scope = requireCurrentScope();
  if (!scope) return;
  writeAllForScope(scope, list);
}

export function listConversationGroupsForScope(scope: LocalIdentityScope): ConversationGroup[] {
  return readAllRawForScope(scope);
}

export function replaceConversationGroupsForScope(
  scope: LocalIdentityScope,
  list: ConversationGroup[]
): void {
  writeAllForScope(scope, list);
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
  const scope = requireCurrentScope();
  const inferredUserId =
    input.userId !== undefined
      ? input.userId
      : scope?.kind === 'user'
        ? scope.userId
        : null;
  const inferredGuest =
    input.guestToken !== undefined
      ? input.guestToken
      : inferredUserId
        ? null
        : getOrCreateMirrorGuestToken();

  const group: ConversationGroup = {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: inferredUserId ?? null,
    guestToken: inferredGuest,
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
  // Guest/local: keep chats visible as ungrouped.
  clearChatMembershipsForGroup(id);
}

/** Replace full group list for the current identity (login merge / migration). */
export function replaceConversationGroups(list: ConversationGroup[]): void {
  writeAll(list);
}
