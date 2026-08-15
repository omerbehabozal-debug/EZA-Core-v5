/**
 * Phase 6.2.2 — replay-attempt lifecycle contract.
 *
 * Same slug+version session persists across refresh, resume, skip-return,
 * and completed revisit. No TTL. A second STARTED count requires explicit
 * resetYansiExperienceSession (future Replay Again). Replay UI does not call it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackYansiExperienceStarted } from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import {
  clearYansiExperienceSessionsForTests,
  getOrCreateYansiExperienceSession,
  resetYansiExperienceSession,
  yansiExperienceSessionStorageKey,
} from '@/lib/eza/mirror/journey/yansiExperienceSession';

function ingestBodies(fetchSpy: ReturnType<typeof vi.fn>) {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).includes('/experience-events'))
    .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')));
}

afterEach(() => {
  vi.useRealTimers();
  clearYansiExperienceSessionsForTests();
});

describe('Phase 6.2.2 replay attempt lifecycle', () => {
  it('E/I. refresh/remount reuses the same session and STARTED eventId', () => {
    const first = getOrCreateYansiExperienceSession('yansi-a', 1);
    const prev = globalThis.fetch;
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 200 })
    );
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      trackYansiExperienceStarted({ slug: 'yansi-a', journeyVersion: 1 });
      const remount = getOrCreateYansiExperienceSession('yansi-a', 1);
      expect(remount.experienceSessionId).toBe(first.experienceSessionId);
      expect(remount.startedEventId).toBe(first.startedEventId);
      trackYansiExperienceStarted({ slug: 'yansi-a', journeyVersion: 1 });
      const bodies = ingestBodies(fetchSpy);
      expect(bodies).toHaveLength(2);
      expect(bodies[0].experienceSessionId).toBe(first.experienceSessionId);
      expect(bodies[1].experienceSessionId).toBe(first.experienceSessionId);
      expect(bodies[0].eventId).toBe(first.startedEventId);
      expect(bodies[1].eventId).toBe(first.startedEventId);
      expect(bodies[0].eventType).toBe('yansi_experience_started');
    } finally {
      globalThis.fetch = prev;
    }
  });

  it('F. completed revisit keeps the same experience session (no second attempt)', () => {
    const started = getOrCreateYansiExperienceSession('yansi-a', 1);
    const afterComplete = getOrCreateYansiExperienceSession('yansi-a', 1);
    expect(afterComplete.experienceSessionId).toBe(started.experienceSessionId);
    expect(afterComplete.startedEventId).toBe(started.startedEventId);
    expect(afterComplete.completedEventId).toBe(started.completedEventId);
  });

  it('G. A v1 and A v2 are distinct sessions and storage keys', () => {
    const v1 = getOrCreateYansiExperienceSession('yansi-a', 1);
    const v2 = getOrCreateYansiExperienceSession('yansi-a', 2);
    expect(yansiExperienceSessionStorageKey('yansi-a', 1)).toBe(
      'eza_yansi_experience_session_v1:yansi-a:v1'
    );
    expect(yansiExperienceSessionStorageKey('yansi-a', 2)).toBe(
      'eza_yansi_experience_session_v1:yansi-a:v2'
    );
    expect(v1.experienceSessionId).not.toBe(v2.experienceSessionId);
    expect(v1.startedEventId).not.toBe(v2.startedEventId);
  });

  it('H. elapsed time does not mint a new session (no TTL)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T08:00:00Z'));
    const first = getOrCreateYansiExperienceSession('yansi-a', 1);
    vi.setSystemTime(new Date('2027-08-15T08:00:00Z'));
    const later = getOrCreateYansiExperienceSession('yansi-a', 1);
    expect(later.experienceSessionId).toBe(first.experienceSessionId);
    expect(later.startedEventId).toBe(first.startedEventId);
    const raw = localStorage.getItem(yansiExperienceSessionStorageKey('yansi-a', 1)) ?? '';
    expect(raw).not.toMatch(/ttl|expiresAt|expires_at|expiries/i);
  });

  it('explicit reset is the only mint; replay paths must keep using getOrCreate', () => {
    const s1 = getOrCreateYansiExperienceSession('yansi-a', 1);
    const stillSame = getOrCreateYansiExperienceSession('yansi-a', 1);
    expect(stillSame.experienceSessionId).toBe(s1.experienceSessionId);
    const s2 = resetYansiExperienceSession('yansi-a', 1);
    expect(s2.experienceSessionId).not.toBe(s1.experienceSessionId);
    expect(s2.startedEventId).not.toBe(s1.startedEventId);
    const afterReset = getOrCreateYansiExperienceSession('yansi-a', 1);
    expect(afterReset.experienceSessionId).toBe(s2.experienceSessionId);
  });

  it('manual storage clear mints a new session (accepted limitation, no fingerprint)', () => {
    const first = getOrCreateYansiExperienceSession('yansi-a', 1);
    localStorage.clear();
    const next = getOrCreateYansiExperienceSession('yansi-a', 1);
    expect(next.experienceSessionId).not.toBe(first.experienceSessionId);
  });
});
