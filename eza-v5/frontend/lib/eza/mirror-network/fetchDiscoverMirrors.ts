/**
 * Fetch public discover list (no auth).
 */

import { getApiUrl } from '@/lib/apiUrl';

export type DiscoverMirror = {
  slug: string;
  title: string;
  description?: string | null;
  sceneImageUrl: string | null;
  yansiCount: number;
  createdAt?: string | null;
};

export type DiscoverMirrorListResponse = {
  items: DiscoverMirror[];
  total: number;
};

export type FetchDiscoverMirrorsResult =
  | { ok: true; data: DiscoverMirrorListResponse }
  | { ok: false; status: number };

const FORBIDDEN_KEYS = [
  'userId',
  'guestToken',
  'conversationId',
  'mirrorBody',
  'private_payload',
  'behavioralSnapshot',
] as const;

export async function fetchDiscoverMirrors(options?: {
  limit?: number;
  offset?: number;
  revalidateSeconds?: number;
}): Promise<FetchDiscoverMirrorsResult> {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const base = getApiUrl().replace(/\/$/, '');
  const url = `${base}/api/mirror-network/discover?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: options?.revalidateSeconds ?? 60 },
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const data = (await response.json()) as DiscoverMirrorListResponse;
    const json = JSON.stringify(data);
    for (const key of FORBIDDEN_KEYS) {
      if (json.includes(`"${key}"`)) {
        throw new Error(`discover_forbidden_field:${key}`);
      }
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('discover_forbidden_field:')) {
      throw err;
    }
    return { ok: false, status: 0 };
  }
}
