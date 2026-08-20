/**
 * Phase 6.4 — canonical Yansı exposure (meaningful visibility).
 *
 * One durable exposure per tab session × slug × journeyVersion × context.
 * Visibility: >= 50% intersection for >= 750ms while the document is visible.
 * No fingerprinting. No URL/referrer. No Q/A/EZA.
 *
 * Attraction rate is NOT computed here: exposureSessionId is not the
 * experienceSessionId used for STARTED.
 */

import { buildApiUrl } from '@/lib/apiUrl';

export const YANSI_EXPOSURE_MIN_RATIO = 0.5;
export const YANSI_EXPOSURE_MIN_DWELL_MS = 750;
export const YANSI_EXPOSURE_CONTEXTS = [
  'discover',
  'public_profile',
  'landing',
  'chain',
] as const;

export type YansiExposureContext = (typeof YANSI_EXPOSURE_CONTEXTS)[number];

const SESSION_KEY = 'eza_yansi_exposure_session_v1';
const SENT_PREFIX = 'eza_yansi_exposure_sent_v1:';

export function yansiExposureSentKey(
  slug: string,
  journeyVersion: number,
  context: YansiExposureContext
): string {
  return `${slug.trim().toLowerCase()}:v${journeyVersion}:${context}`;
}

function sessionStorageSafe(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.sessionStorage ?? null : null;
  } catch {
    return null;
  }
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
}

export function getOrCreateYansiExposureSession(): string {
  const ss = sessionStorageSafe();
  const existing = ss?.getItem(SESSION_KEY);
  if (existing && existing.length >= 8) return existing;
  const created = newUuid();
  try {
    ss?.setItem(SESSION_KEY, created);
  } catch {
    /* ignore */
  }
  return created;
}

function sentSet(sessionId: string): Set<string> {
  const ss = sessionStorageSafe();
  const raw = ss?.getItem(`${SENT_PREFIX}${sessionId}`);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function persistSent(sessionId: string, keys: Set<string>): void {
  try {
    sessionStorageSafe()?.setItem(
      `${SENT_PREFIX}${sessionId}`,
      JSON.stringify(Array.from(keys))
    );
  } catch {
    /* ignore quota */
  }
}

export function hasSentYansiExposure(
  slug: string,
  journeyVersion: number,
  context: YansiExposureContext
): boolean {
  const sessionId = getOrCreateYansiExposureSession();
  return sentSet(sessionId).has(yansiExposureSentKey(slug, journeyVersion, context));
}

export function markYansiExposureSent(
  slug: string,
  journeyVersion: number,
  context: YansiExposureContext
): void {
  const sessionId = getOrCreateYansiExposureSession();
  const keys = sentSet(sessionId);
  keys.add(yansiExposureSentKey(slug, journeyVersion, context));
  persistSent(sessionId, keys);
}

export function clearYansiExposureForTests(): void {
  const ss = sessionStorageSafe();
  if (!ss) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ss.length; i += 1) {
      const k = ss.key(i);
      if (k?.startsWith(SESSION_KEY) || k?.startsWith(SENT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ss.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function evaluateYansiExposureWindow(input: {
  intersectionRatio: number;
  documentHidden: boolean;
  dwellMs: number;
}): 'ignore' | 'pending' | 'count' {
  if (input.documentHidden) return 'ignore';
  if (!(input.intersectionRatio >= YANSI_EXPOSURE_MIN_RATIO)) return 'ignore';
  if (input.dwellMs < YANSI_EXPOSURE_MIN_DWELL_MS) return 'pending';
  return 'count';
}

export function isDocumentVisibleForExposure(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hidden !== true;
}

function optionalAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const token = localStorage.getItem('eza_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* guest */
  }
  return headers;
}

export function trackYansiExposure(input: {
  slug: string;
  journeyVersion: number;
  context: YansiExposureContext;
}): void {
  if (typeof window === 'undefined') return;
  const slug = input.slug.trim().toLowerCase();
  const version = input.journeyVersion;
  if (!slug || !Number.isInteger(version) || version < 1) return;
  if (!YANSI_EXPOSURE_CONTEXTS.includes(input.context)) return;
  if (hasSentYansiExposure(slug, version, input.context)) return;
  markYansiExposureSent(slug, version, input.context);
  const sessionId = getOrCreateYansiExposureSession();
  const path = `/api/mirror-network/${encodeURIComponent(slug)}/exposure-events`;
  void (async () => {
    try {
      await fetch(buildApiUrl(path), {
        method: 'POST',
        headers: optionalAuthHeader(),
        body: JSON.stringify({
          eventId: crypto.randomUUID?.() ?? newUuid(),
          exposureSessionId: sessionId,
          journeyVersion: version,
          context: input.context,
          occurredAt: new Date().toISOString(),
        }),
        keepalive: true,
      });
    } catch {
      /* never block feed/replay */
    }
  })();
}

export function lineageProofTokenForStandaloneRequest(
  origin: { lineageProofToken?: string | null } | null | undefined
): string | undefined {
  // Prefer resolveLineageProofToken(chat) for full carrier fallback.
  const token = origin?.lineageProofToken?.trim();
  return token || undefined;
}
