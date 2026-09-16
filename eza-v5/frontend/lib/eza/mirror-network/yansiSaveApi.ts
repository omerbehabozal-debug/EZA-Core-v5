/**
 * Slice 5 — Merakıma ekle / Meraklarım API client.
 */

import { apiClient } from '@/lib/apiClient';

export type SavedYansiAvailability = 'available' | 'unavailable';

export type SavedYansiListItem = {
  slug: string;
  savedAt: string;
  availability: SavedYansiAvailability;
  journeyVersion?: number | null;
  publicTitle?: string | null;
  sceneImageUrl?: string | null;
  authorUserId?: string | null;
  authorDisplayName?: string | null;
  publicHonorific?: string | null;
  publicAvatarUrl?: string | null;
};

export type SavedYansiListResponse = {
  items: SavedYansiListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type YansiSaveMutationResult =
  | { ok: true; status: string; slug: string; saved: boolean }
  | { ok: false; code: string };

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export async function fetchYansiSaveState(
  slug: string
): Promise<{ ok: true; slug: string; saved: boolean } | { ok: false; code: string }> {
  const key = normalizeSlug(slug);
  if (!key) return { ok: false, code: 'invalid_slug' };
  const res = await apiClient.get<{ slug?: string; saved?: boolean }>(
    `/api/mirror-network/${encodeURIComponent(key)}/save`,
    { auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'save_state_failed'),
    };
  }
  return {
    ok: true,
    slug: String(res.data?.slug || key).trim().toLowerCase(),
    saved: Boolean(res.data?.saved),
  };
}

export async function saveYansi(slug: string): Promise<YansiSaveMutationResult> {
  const key = normalizeSlug(slug);
  if (!key) return { ok: false, code: 'invalid_slug' };
  const res = await apiClient.post<{ status?: string; slug?: string; saved?: boolean }>(
    `/api/mirror-network/${encodeURIComponent(key)}/save`,
    { body: {}, auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'save_failed'),
    };
  }
  return {
    ok: true,
    status: String(res.data?.status || res.status || 'saved'),
    slug: String(res.data?.slug || key).trim().toLowerCase(),
    saved: res.data?.saved !== false,
  };
}

export async function unsaveYansi(slug: string): Promise<YansiSaveMutationResult> {
  const key = normalizeSlug(slug);
  if (!key) return { ok: false, code: 'invalid_slug' };
  const res = await apiClient.delete<{ status?: string; slug?: string; saved?: boolean }>(
    `/api/mirror-network/${encodeURIComponent(key)}/save`,
    { auth: true }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'unsave_failed'),
    };
  }
  return {
    ok: true,
    status: String(res.data?.status || res.status || 'removed'),
    slug: String(res.data?.slug || key).trim().toLowerCase(),
    saved: false,
  };
}

export async function fetchMySavedYansilar(input?: {
  limit?: number;
  offset?: number;
}): Promise<
  | { ok: true; data: SavedYansiListResponse }
  | { ok: false; code: string }
> {
  const limit = input?.limit ?? 48;
  const offset = input?.offset ?? 0;
  const res = await apiClient.get<SavedYansiListResponse>(
    `/api/mirror-network/me/saved?limit=${limit}&offset=${offset}`,
    { auth: true }
  );
  if (!res.ok || !res.data) {
    return {
      ok: false,
      code: String(res.error?.error_code || res.error?.error || 'saved_list_failed'),
    };
  }
  return { ok: true, data: res.data };
}
