/**
 * Phase 3.8 — public author published Yansılar client.
 */

import { apiClient } from '@/lib/apiClient';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';

export type AuthorPublishedYansiItem = {
  slug: string;
  shareUrl: string;
  publicTitle: string;
  publicSummary?: string | null;
  sceneImageUrl?: string | null;
  publishedAt?: string | null;
  parentSlug?: string | null;
  journeyVersion?: number | null;
  experienceStartedCount?: number | null;
  directChildYansiCount?: number | null;
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

function parseNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function parseItem(raw: unknown): AuthorPublishedYansiItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== 'string' || typeof row.publicTitle !== 'string') {
    return null;
  }
  const version = parseNonNegInt(row.journeyVersion);
  const started = parseNonNegInt(row.experienceStartedCount);
  const children = parseNonNegInt(row.directChildYansiCount);
  const canonicalOk = started !== null && children !== null;
  return {
    slug: row.slug,
    shareUrl: typeof row.shareUrl === 'string' ? row.shareUrl : '',
    publicTitle: row.publicTitle,
    publicSummary: typeof row.publicSummary === 'string' ? row.publicSummary : null,
    sceneImageUrl: typeof row.sceneImageUrl === 'string' ? row.sceneImageUrl : null,
    publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : null,
    parentSlug: typeof row.parentSlug === 'string' ? row.parentSlug : null,
    journeyVersion: version && version >= 1 ? version : null,
    experienceStartedCount: canonicalOk ? started : null,
    directChildYansiCount: canonicalOk ? children : null,
  };
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
          : PUBLIC_DISPLAY_NAME_FALLBACK,
      items: data.items
        .map(parseItem)
        .filter((item): item is AuthorPublishedYansiItem => item !== null),
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
      items: data.items
        .map(parseItem)
        .filter((item): item is AuthorPublishedYansiItem => item !== null),
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
