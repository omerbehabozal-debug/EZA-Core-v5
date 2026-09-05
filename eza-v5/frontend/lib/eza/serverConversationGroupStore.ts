/**
 * Phase 8.8G-5.3.2 — authenticated conversation group authority store.
 *
 * ready + [] = AUTHORITATIVE EMPTY (do not merge local named groups).
 * failed/loading without snapshot = degraded current-user scoped local cache.
 * Guest remains outside this store (local group-* path).
 */

import {
  assignServerConversationGroup,
  createServerConversationGroup,
  deleteServerConversationGroup,
  listServerConversationGroups,
  updateServerConversationGroup,
  type ServerConversationGroup,
} from '@/lib/eza/serverConversationGroupsApi';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import {
  GROUPS_UPDATED_EVENT,
  peekScopedConversationGroupsForScope,
  replaceConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { userScope } from '@/lib/eza/localIdentityScope';
import {
  getServerIdForClientChat,
  noteServerConversationGroupAssigned,
  noteServerConversationGroupCleared,
} from '@/lib/eza/serverConversationStore';
import {
  assignChatToGroup,
  clearChatMembershipsForGroup,
  getChatArchive,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

export type GroupAuthorityPhase = 'none' | 'loading' | 'ready' | 'failed';

type GroupAuthorityState = {
  groups: ConversationGroup[];
  authorityPhase: GroupAuthorityPhase;
  hasCompleteSnapshot: boolean;
  loading: boolean;
  error: string | null;
};

const state: GroupAuthorityState = {
  groups: [],
  authorityPhase: 'none',
  hasCompleteSnapshot: false,
  loading: false,
  error: null,
};

let activeOwnerKey: string | null = null;
let bootstrapEpoch = 0;

const listeners = new Set<() => void>();

const EMPTY_GROUPS: ConversationGroup[] = [];

let cachedDegradedGroups: ConversationGroup[] = EMPTY_GROUPS;
let cachedDegradedOwner: string | null = null;

function invalidateDegradedCache(): void {
  cachedDegradedGroups = EMPTY_GROUPS;
  cachedDegradedOwner = null;
}

function emit(): void {
  invalidateDegradedCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GROUPS_UPDATED_EVENT));
  }
  listeners.forEach((listener) => listener());
}

function captureAuthority(): { ownerAtStart: string | null; epochAtStart: number } {
  return { ownerAtStart: activeOwnerKey, epochAtStart: bootstrapEpoch };
}

function isAuthorityValid(ownerAtStart: string | null, epochAtStart: number): boolean {
  return ownerAtStart === activeOwnerKey && epochAtStart === bootstrapEpoch;
}

function resetMutableState(): void {
  state.groups = [];
  state.authorityPhase = 'none';
  state.hasCompleteSnapshot = false;
  state.loading = false;
  state.error = null;
}

export function subscribeServerConversationGroups(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function mapServerGroupToLocal(
  row: ServerConversationGroup,
  ownerId: string
): ConversationGroup {
  return {
    id: row.id,
    userId: ownerId,
    guestToken: null,
    title: row.title,
    source: row.source,
    parentGroupId: row.parentGroupId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sortOrder: row.sortOrder,
    clientGroupId: row.clientGroupId ?? null,
  };
}

function writeOwnerCache(ownerId: string, groups: ConversationGroup[]): void {
  replaceConversationGroupsForScope(userScope(ownerId), groups);
}

export function beginGroupAccountSession(userId: string): void {
  if (activeOwnerKey !== userId) {
    bootstrapEpoch += 1;
    activeOwnerKey = userId;
    resetMutableState();
    emit();
  }
}

export function clearServerConversationGroupState(): void {
  bootstrapEpoch += 1;
  activeOwnerKey = null;
  resetMutableState();
  emit();
}

export function resetServerConversationGroupStoreForTests(): void {
  bootstrapEpoch = 0;
  activeOwnerKey = null;
  resetMutableState();
  invalidateDegradedCache();
  listeners.clear();
}

export function getGroupAuthorityPhase(): GroupAuthorityPhase {
  return state.authorityPhase;
}

export function hasCompleteGroupAuthoritySnapshot(): boolean {
  return state.hasCompleteSnapshot;
}

export function getServerAuthorityGroups(): ConversationGroup[] {
  return state.groups;
}

/**
 * Groups for authenticated sidebar tree.
 * ready (incl. empty) → server snapshot only.
 * loading/failed with snapshot → last-good server.
 * none/loading/failed without snapshot → current-user scoped local peek (no flat claim).
 * Never return another account’s in-memory authority.
 *
 * Returns referentially stable arrays for useSyncExternalStore.
 */
export function getGroupsForAuthenticatedSidebar(userId: string | null | undefined): ConversationGroup[] {
  if (!userId) return EMPTY_GROUPS;
  // Cross-owner guard: never surface activeOwnerKey groups for a different userId.
  if (activeOwnerKey && activeOwnerKey !== userId) {
    return EMPTY_GROUPS;
  }
  if (activeOwnerKey === userId && state.hasCompleteSnapshot) {
    return state.groups;
  }
  // Degraded / pre-bootstrap: scoped local only — never promote flat legacy key.
  if (cachedDegradedOwner === userId) {
    return cachedDegradedGroups;
  }
  const peeked = peekScopedConversationGroupsForScope(userScope(userId));
  cachedDegradedOwner = userId;
  cachedDegradedGroups = peeked.length === 0 ? EMPTY_GROUPS : peeked;
  return cachedDegradedGroups;
}

export async function bootstrapServerConversationGroups(userId: string): Promise<boolean> {
  beginGroupAccountSession(userId);
  const { ownerAtStart, epochAtStart } = captureAuthority();
  state.loading = true;
  state.error = null;
  state.authorityPhase = 'loading';
  emit();
  try {
    const rows = await listServerConversationGroups();
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return false;
    const mapped = rows.map((r) => mapServerGroupToLocal(r, userId));
    state.groups = mapped;
    state.loading = false;
    state.error = null;
    state.authorityPhase = 'ready';
    state.hasCompleteSnapshot = true;
    writeOwnerCache(userId, mapped);
    emit();
    return true;
  } catch {
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return false;
    state.loading = false;
    state.error = 'bootstrap_failed';
    state.authorityPhase = 'failed';
    // Preserve last-good; never install [] on failure.
    emit();
    return false;
  }
}

export async function createAuthenticatedConversationGroup(input: {
  title: string;
  source?: ConversationGroup['source'];
}): Promise<ConversationGroup> {
  const userId = activeOwnerKey;
  if (!userId) throw new Error('conversation_group_no_owner');
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const created = await createServerConversationGroup({
    title: input.title,
    source: input.source ?? 'manual',
  });
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) {
    throw new Error('conversation_group_stale_authority');
  }
  const mapped = mapServerGroupToLocal(created, userId);
  state.groups = [mapped, ...state.groups.filter((g) => g.id !== mapped.id)];
  state.hasCompleteSnapshot = true;
  state.authorityPhase = 'ready';
  writeOwnerCache(userId, state.groups);
  emit();
  return mapped;
}

export async function renameAuthenticatedConversationGroup(
  groupId: string,
  title: string
): Promise<ConversationGroup> {
  const userId = activeOwnerKey;
  if (!userId) throw new Error('conversation_group_no_owner');
  const trimmed = title.trim();
  if (!trimmed) throw new Error('conversation_group_title_required');
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const updated = await updateServerConversationGroup(groupId, { title: trimmed });
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) {
    throw new Error('conversation_group_stale_authority');
  }
  const mapped = mapServerGroupToLocal(updated, userId);
  state.groups = state.groups.map((g) => (g.id === mapped.id ? mapped : g));
  writeOwnerCache(userId, state.groups);
  emit();
  return mapped;
}

export async function deleteAuthenticatedConversationGroup(groupId: string): Promise<void> {
  const userId = activeOwnerKey;
  if (!userId) throw new Error('conversation_group_no_owner');
  const { ownerAtStart, epochAtStart } = captureAuthority();
  await deleteServerConversationGroup(groupId);
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) {
    throw new Error('conversation_group_stale_authority');
  }
  state.groups = state.groups.filter((g) => g.id !== groupId);
  writeOwnerCache(userId, state.groups);
  clearChatMembershipsForGroup(groupId);
  noteServerConversationGroupCleared(groupId);
  emit();
}

export async function assignAuthenticatedConversationGroup(
  clientConversationId: string,
  groupId: string | null
): Promise<void> {
  const userId = activeOwnerKey;
  if (!userId) throw new Error('conversation_group_no_owner');
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) throw new Error('conversation_not_server_backed');
  const { ownerAtStart, epochAtStart } = captureAuthority();
  await assignServerConversationGroup(serverId, groupId);
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) {
    throw new Error('conversation_group_stale_authority');
  }
  const full = getChatArchive(clientConversationId);
  if (full) {
    if (groupId) {
      assignChatToGroup(clientConversationId, groupId);
    } else {
      upsertChatArchive({
        ...full,
        groupId: null,
        treeMetadata: full.treeMetadata
          ? { ...full.treeMetadata, groupId: null }
          : { sourceType: 'direct', groupId: null },
      });
    }
  }
  noteServerConversationGroupAssigned(clientConversationId, groupId);
  emit();
}

/** Test helper — install authority without network. */
export function installGroupAuthorityForTests(
  userId: string,
  groups: ConversationGroup[],
  phase: GroupAuthorityPhase = 'ready',
  opts?: { hasCompleteSnapshot?: boolean }
): void {
  activeOwnerKey = userId;
  state.groups = groups;
  state.authorityPhase = phase;
  state.hasCompleteSnapshot =
    opts?.hasCompleteSnapshot ?? phase === 'ready';
  state.loading = phase === 'loading';
  state.error = phase === 'failed' ? 'bootstrap_failed' : null;
  if (phase === 'ready') {
    writeOwnerCache(userId, groups);
  }
  emit();
}

export function getDegradedLocalGroupsForTests(userId: string): ConversationGroup[] {
  return peekScopedConversationGroupsForScope(userScope(userId));
}

export function getActiveGroupOwnerForTests(): string | null {
  return activeOwnerKey;
}
