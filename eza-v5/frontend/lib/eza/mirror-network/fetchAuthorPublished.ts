/**
 * Phase 8.5 / 8.5B — public author published Yansılar client.
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
  /** Owner inventory only — never present on public DTO. */
  visibility?: string | null;
  safetyStatus?: string | null;
  isPublicListable?: boolean | null;
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

export type OwnerProfileYansiResponse = AuthorPublishedYansiResponse & {
  publicDisplayName?: string | null;
  view?: string;
};

export const PROFILE_YANSI_PAGE_SIZE = 24;

function parseNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export function parseAuthorPublishedItem(raw: unknown): AuthorPublishedYansiItem | null {
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
    visibility: typeof row.visibility === 'string' ? row.visibility : null,
    safetyStatus: typeof row.safetyStatus === 'string' ? row.safetyStatus : null,
    isPublicListable:
      typeof row.isPublicListable === 'boolean' ? row.isPublicListable : null,
  };
}

function parseListPayload(
  data: Record<string, unknown>
): AuthorPublishedYansiResponse | null {
  if (typeof data.userId !== 'string' || !Array.isArray(data.items)) {
    return null;
  }
  return {
    userId: data.userId,
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName
        : PUBLIC_DISPLAY_NAME_FALLBACK,
    items: data.items
      .map(parseAuthorPublishedItem)
      .filter((item): item is AuthorPublishedYansiItem => item !== null),
    total: typeof data.total === 'number' ? data.total : data.items.length,
  };
}

export async function fetchAuthorPublishedYansilar(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ ok: true; data: AuthorPublishedYansiResponse } | { ok: false }> {
  const id = userId.trim();
  if (!id) return { ok: false };
  const limit = options?.limit ?? PROFILE_YANSI_PAGE_SIZE;
  const offset = options?.offset ?? 0;
  const response = await apiClient.get<AuthorPublishedYansiResponse>(
    `/api/mirror-network/authors/${encodeURIComponent(id)}/published`,
    {
      timeoutMs: 15_000,
      params: {
        limit: String(limit),
        offset: String(offset),
      },
    }
  );
  if (!response.ok) return { ok: false };
  const raw = (response.data ?? response) as Record<string, unknown>;
  const parsed = parseListPayload(raw);
  if (!parsed) return { ok: false };
  return { ok: true, data: parsed };
}

export async function fetchOwnerProfileYansilar(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ ok: true; data: OwnerProfileYansiResponse } | { ok: false }> {
  const limit = options?.limit ?? PROFILE_YANSI_PAGE_SIZE;
  const offset = options?.offset ?? 0;
  const response = await apiClient.get<OwnerProfileYansiResponse>(
    '/api/mirror-network/me/profile-yansilar',
    {
      auth: true,
      timeoutMs: 15_000,
      params: {
        limit: String(limit),
        offset: String(offset),
      },
    }
  );
  if (!response.ok) return { ok: false };
  const raw = (response.data ?? response) as Record<string, unknown>;
  const parsed = parseListPayload(raw);
  if (!parsed) return { ok: false };
  return {
    ok: true,
    data: {
      ...parsed,
      publicDisplayName:
        typeof raw.publicDisplayName === 'string' ? raw.publicDisplayName : null,
      view: typeof raw.view === 'string' ? raw.view : 'owner',
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
  if (!response.ok) return { ok: false };
  const data = (response.data ?? response) as ParentChildrenYansiResponse;
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
        .map(parseAuthorPublishedItem)
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

export function ownerVisibilityLabel(item: {
  visibility?: string | null;
  safetyStatus?: string | null;
  isPublicListable?: boolean | null;
}): string {
  if (item.isPublicListable) return 'Herkese açık';
  const safety = (item.safetyStatus || '').toLowerCase();
  if (safety === 'restricted') return 'Kısıtlı';
  const vis = (item.visibility || '').toLowerCase();
  if (vis === 'unlisted') return 'Bağlantıyla';
  if (vis === 'private') return 'Gizli';
  return vis || 'Gizli';
}
