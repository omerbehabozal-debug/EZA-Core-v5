/**
 * Fetch public discover list (no auth).
 */

import { getApiUrl } from '@/lib/apiUrl';
import {
  MirrorApiContractError,
  validateDiscoverList,
} from '@/lib/eza/mirror/mirrorApiContracts';
import {
  DEFAULT_DISCOVER_MODE,
  type DiscoverMode,
  parseDiscoverMode,
} from '@/lib/eza/mirror-network/discoverModes';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';

export type DiscoverMirror = {
  slug: string;
  title: string;
  description?: string | null;
  sceneImageUrl: string | null;
  /**
   * @deprecated Phase 6.2.1 — legacy Discover child aggregate (public/open/safety).
   * Do not render as “deneyim” or as Phase 5.1.1 Yansı. Canonical fields below.
   */
  yansiCount: number;
  createdAt?: string | null;
  journeyVersion?: number | null;
  experienceStartedCount?: number | null;
  directChildYansiCount?: number | null;
  authorDisplayName?: string | null;
  publicHonorific?: string | null;
};

export type DiscoverMirrorListResponse = {
  items: DiscoverMirror[];
  total: number;
  mode: DiscoverMode;
  randomSession?: string | null;
  strongCuriosityReady: boolean;
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
  'experienceSessionId',
  'eventId',
  'viewerUserId',
  'email',
  'accountTier',
  'account_tier',
  'mirror_plan',
  'role',
  'ezaScore',
  'rankingEvidence',
] as const;

function parseNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function parseDiscoverItem(raw: unknown): DiscoverMirror | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== 'string' || !row.slug.trim()) return null;
  if (typeof row.title !== 'string' || !row.title.trim()) return null;
  const yansiCount = parseNonNegInt(row.yansiCount) ?? 0;
  const canonical = parseYansiPublicSocialProofInput(row);
  const version = parseNonNegInt(row.journeyVersion);
  return {
    slug: row.slug.trim(),
    title: row.title.trim(),
    description: typeof row.description === 'string' ? row.description : null,
    sceneImageUrl:
      typeof row.sceneImageUrl === 'string' && row.sceneImageUrl.trim()
        ? row.sceneImageUrl
        : null,
    yansiCount,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
    journeyVersion: version && version >= 1 ? version : null,
    experienceStartedCount: canonical?.experienceStartedCount ?? null,
    directChildYansiCount: canonical?.directChildYansiCount ?? null,
    authorDisplayName:
      typeof row.authorDisplayName === 'string' && row.authorDisplayName.trim()
        ? row.authorDisplayName.trim()
        : null,
    publicHonorific:
      typeof row.publicHonorific === 'string' && row.publicHonorific.trim()
        ? row.publicHonorific.trim()
        : null,
  };
}

export function buildDiscoverListUrl(options?: {
  limit?: number;
  offset?: number;
  mode?: DiscoverMode;
  randomSession?: string | null;
}): string {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const parsed = parseDiscoverMode(options?.mode ?? null);
  const mode = parsed.ok ? parsed.mode : DEFAULT_DISCOVER_MODE;
  const base = getApiUrl().replace(/\/$/, '');
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    mode,
  });
  if (mode === 'random' && options?.randomSession) {
    params.set('randomSession', options.randomSession);
  }
  return `${base}/api/mirror-network/discover?${params.toString()}`;
}

export async function fetchDiscoverMirrors(options?: {
  limit?: number;
  offset?: number;
  revalidateSeconds?: number;
  mode?: DiscoverMode;
  randomSession?: string | null;
  signal?: AbortSignal;
}): Promise<FetchDiscoverMirrorsResult> {
  const url = buildDiscoverListUrl(options);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      next: { revalidate: options?.revalidateSeconds ?? 0 },
      signal: options?.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const raw = await response.json();
    const validated = validateDiscoverList(raw);
    const items = (validated.items || [])
      .map(parseDiscoverItem)
      .filter((item): item is DiscoverMirror => item !== null);
    const parsedMode = parseDiscoverMode(
      typeof validated.mode === 'string' ? validated.mode : options?.mode ?? null
    );
    const data: DiscoverMirrorListResponse = {
      items,
      total: typeof validated.total === 'number' ? validated.total : items.length,
      mode: parsedMode.ok ? parsedMode.mode : DEFAULT_DISCOVER_MODE,
      randomSession:
        typeof validated.randomSession === 'string' ? validated.randomSession : null,
      strongCuriosityReady: validated.strongCuriosityReady === true,
    };
    const json = JSON.stringify(data);
    for (const key of FORBIDDEN_KEYS) {
      if (json.includes(`"${key}"`)) {
        throw new Error(`discover_forbidden_field:${key}`);
      }
    }
    return { ok: true, data };
  } catch (err) {
    if (
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      return { ok: false, status: 0 };
    }
    if (err instanceof MirrorApiContractError) {
      return { ok: false, status: 0 };
    }
    if (err instanceof Error && err.message.startsWith('discover_forbidden_field:')) {
      throw err;
    }
    return { ok: false, status: 0 };
  }
}
