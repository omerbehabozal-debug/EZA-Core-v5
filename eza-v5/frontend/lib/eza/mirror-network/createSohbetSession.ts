/**
 * Create mirror sohbet session from public slug (no auth).
 */

import { getApiUrl } from '@/lib/apiUrl';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import {
  MIRROR_SOHBET_SESSION_STORAGE_PREFIX,
  type MirrorSohbetSession,
} from '@/lib/eza/mirror-network/sohbetTypes';
import { buildSainaQuotaHeaders } from '@/lib/eza/plan/sainaQuotaHeaders';
import type { QuotaErrorDetail } from '@/lib/eza/plan/sainaQuotaMessages';

export type CreateSohbetSessionResult =
  | { ok: true; session: MirrorSohbetSession }
  | { ok: false; status: number; quotaDetail?: QuotaErrorDetail };

function sessionStorageKey(slug: string): string {
  return `${MIRROR_SOHBET_SESSION_STORAGE_PREFIX}${slug}`;
}

export function loadCachedSohbetSession(slug: string): MirrorSohbetSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(sessionStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MirrorSohbetSession;
    if (parsed.mirrorSlug !== slug) return null;
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cacheSohbetSession(session: MirrorSohbetSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(sessionStorageKey(session.mirrorSlug), JSON.stringify(session));
}

function buildSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...buildSainaQuotaHeaders(),
  };
  if (typeof window !== 'undefined') {
    const authToken = window.localStorage.getItem('eza_token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }
  return headers;
}

export async function createMirrorSohbetSession(
  slug: string,
  options?: { guestToken?: string; forceNew?: boolean }
): Promise<CreateSohbetSessionResult> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return { ok: false, status: 404 };

  if (!options?.forceNew) {
    const cached = loadCachedSohbetSession(normalized);
    if (cached) return { ok: true, session: cached };
  }

  const guestToken = options?.guestToken || getOrCreateMirrorGuestToken();
  const base = getApiUrl().replace(/\/$/, '');
  const url = `${base}/api/mirror-network/${encodeURIComponent(normalized)}/sohbet/session`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildSessionHeaders(),
      body: JSON.stringify({ guestToken }),
    });

    if (!response.ok) {
      if (response.status === 403) {
        try {
          const data = (await response.json()) as { detail?: QuotaErrorDetail };
          if (data.detail?.reason) {
            return { ok: false, status: 403, quotaDetail: data.detail };
          }
        } catch {
          // fall through
        }
      }
      return { ok: false, status: response.status };
    }

    const session = (await response.json()) as MirrorSohbetSession;
    if (guestToken) {
      localStorage.setItem('saina_mirror_guest_token', guestToken);
    }
    cacheSohbetSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, status: 502 };
  }
}
