/**
 * Optional client cache of V2 conversation drafts (UI convenience only).
 * Server list (`GET .../v2/conversation-drafts`) is the source of truth for Yansılarım.
 */

import type { YansiV2ConversationDraftDto } from '@/lib/eza/businessYansi';

export const YANSI_V2_CONV_DRAFT_INDEX_PREFIX = 'bilign.yansi.v2.conversation.draft.index.v1:';

export type YansiV2ConversationDraftIndexRow = {
  id: string;
  businessId: string;
  title: string;
  status: string;
  revision: number;
  updatedAt: string;
};

function storageKey(businessId: string): string {
  return `${YANSI_V2_CONV_DRAFT_INDEX_PREFIX}${businessId}`;
}

function normalizeRow(row: Partial<YansiV2ConversationDraftIndexRow>): YansiV2ConversationDraftIndexRow | null {
  const id = String(row.id || '').trim();
  const businessId = String(row.businessId || '').trim();
  if (!id || !businessId) return null;
  return {
    id,
    businessId,
    title: String(row.title || 'Taslak').trim() || 'Taslak',
    status: String(row.status || 'draft').trim() || 'draft',
    revision: Number.isFinite(row.revision) ? Number(row.revision) : 1,
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

export function readConversationDraftIndex(businessId: string): YansiV2ConversationDraftIndexRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeRow(row as Partial<YansiV2ConversationDraftIndexRow>))
      .filter((row): row is YansiV2ConversationDraftIndexRow => Boolean(row))
      .filter((row) => row.businessId.toLowerCase() === businessId.toLowerCase())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function upsertConversationDraftIndex(
  businessId: string,
  draft: Pick<YansiV2ConversationDraftDto, 'id' | 'businessId' | 'title' | 'status' | 'revision'>,
): YansiV2ConversationDraftIndexRow[] {
  if (typeof window === 'undefined') return [];
  const row = normalizeRow({
    id: draft.id,
    businessId: draft.businessId || businessId,
    title: draft.title,
    status: draft.status,
    revision: draft.revision,
    updatedAt: new Date().toISOString(),
  });
  if (!row || row.businessId.toLowerCase() !== businessId.toLowerCase()) {
    return readConversationDraftIndex(businessId);
  }
  const next = [
    row,
    ...readConversationDraftIndex(businessId).filter((item) => item.id !== row.id),
  ].slice(0, 40);
  try {
    window.localStorage.setItem(storageKey(businessId), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function removeConversationDraftIndex(businessId: string, draftId: string): void {
  if (typeof window === 'undefined') return;
  const next = readConversationDraftIndex(businessId).filter((row) => row.id !== draftId);
  try {
    window.localStorage.setItem(storageKey(businessId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Content edits allowed for draft/review. Approved stays publishable; published is locked. */
export function isConversationDraftEditable(status: string | null | undefined, publishedNodeId?: string | null): boolean {
  if (publishedNodeId) return false;
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'review';
}

export function isConversationDraftLocked(status: string | null | undefined, publishedNodeId?: string | null): boolean {
  if (publishedNodeId) return true;
  return String(status || '').toLowerCase() === 'published';
}
