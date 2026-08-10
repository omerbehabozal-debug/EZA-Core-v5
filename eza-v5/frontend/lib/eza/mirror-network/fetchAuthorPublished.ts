/**
 * Phase 3.8 — public author published Yansılar client.
 */

import { apiClient } from '@/lib/apiClient';

export type AuthorPublishedYansiItem = {
  slug: string;
  shareUrl: string;
  publicTitle: string;
  publicSummary?: string | null;
  sceneImageUrl?: string | null;
  publishedAt?: string | null;
  parentSlug?: string | null;
};

export type AuthorPublishedYansiResponse = {
  userId: string;
  displayName: string;
  items: AuthorPublishedYansiItem[];
  total: number;
};

export type ParentChildrenYansiResponse = {
  parentSlug: string;
  parentTitle?: string | null;
  items: AuthorPublishedYansiItem[];
  total: number;
};

function isItem(raw: unknown): raw is AuthorPublishedYansiItem {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  return typeof row.slug === 'string' && typeof row.publicTitle === 'string';
}

export async function fetchAuthorPublishedYansilar(
  userId: string
): Promise<{ ok: true; data: AuthorPublishedYansiResponse } | { ok: false }> {
  const id = userId.trim();
  if (!id) return { ok: false };
  const response = await apiClient.get<AuthorPublishedYansiResponse>(
    `/api/mirror-network/authors/${encodeURIComponent(id)}/published`,
    { timeoutMs: 15_000 }
  );
  if (!response.ok || !response.data || typeof response.data !== 'object') {
    return { ok: false };
  }
  const data = response.data;
  if (typeof data.userId !== 'string' || !Array.isArray(data.items)) {
    return { ok: false };
  }
  return {
    ok: true,
    data: {
      userId: data.userId,
      displayName:
        typeof data.displayName === 'string' && data.displayName.trim()
          ? data.displayName
          : 'Yazar',
      items: data.items.filter(isItem),
      total: typeof data.total === 'number' ? data.total : data.items.length,
    },
  };
}

export async function fetchPublishedChildren(
  parentSlug: string
): Promise<{ ok: true; data: ParentChildrenYansiResponse } | { ok: false }> {
  const slug = parentSlug.trim().toLowerCase();
  if (!slug) return { ok: false };
  const response = await apiClient.get<ParentChildrenYansiResponse>(
    `/api/mirror-network/${encodeURIComponent(slug)}/children`,
    { timeoutMs: 15_000 }
  );
  if (!response.ok || !response.data || typeof response.data !== 'object') {
    return { ok: false };
  }
  const data = response.data;
  if (typeof data.parentSlug !== 'string' || !Array.isArray(data.items)) {
    return { ok: false };
  }
  return {
    ok: true,
    data: {
      parentSlug: data.parentSlug,
      parentTitle:
        typeof data.parentTitle === 'string' ? data.parentTitle : null,
      items: data.items.filter(isItem),
      total: typeof data.total === 'number' ? data.total : data.items.length,
    },
  };
}

export function authorProfilePath(userId: string): string {
  return `/standalone/u/${encodeURIComponent(userId.trim())}`;
}

export function parentChildrenPath(slug: string): string {
  return `/m/${encodeURIComponent(slug.trim().toLowerCase())}/yansilar`;
}
