/**
 * Phase 8.4.1 — trust enforcement (cache + sohbet revalidation).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/lib/eza/mirror-network/fetchPublicMirror', () => ({
  fetchPublicMirrorBySlug: vi.fn(),
}));

vi.mock('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer', () => ({
  fetchPublicFrozenJourneyArtifact: vi.fn(),
}));

vi.mock('@/lib/eza/mirror-network/guestToken', () => ({
  getOrCreateMirrorGuestToken: () => 'guest-phase841-token-abcdefgh',
}));

vi.mock('@/lib/eza/plan/sainaQuotaHeaders', () => ({
  buildSainaQuotaHeaders: () => ({}),
}));

import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  cacheSohbetSession,
  clearCachedSohbetSession,
  createMirrorSohbetSession,
  isSohbetSourceStillEligible,
  loadCachedSohbetSession,
} from '@/lib/eza/mirror-network/createSohbetSession';
import { MIRROR_SOHBET_SESSION_STORAGE_PREFIX } from '@/lib/eza/mirror-network/sohbetTypes';

const SLUG = 'phase841-yansi';

describe('Phase 8.4.1 public mirror trust cache', () => {
  it('defaults fetchPublicMirrorBySlug to no-store trust mode', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchPublicMirror.ts'),
      'utf8'
    );
    expect(src).toContain("cache: 'no-store'");
    expect(src).toContain('trustAuthoritative');
  });

  it('landing and sohbet pages force dynamic / zero revalidate', () => {
    const landing = readFileSync(join(process.cwd(), 'app/m/[slug]/page.tsx'), 'utf8');
    const sohbet = readFileSync(
      join(process.cwd(), 'app/m/[slug]/sohbet/page.tsx'),
      'utf8'
    );
    expect(landing).toContain("dynamic = 'force-dynamic'");
    expect(landing).toContain('revalidate = 0');
    expect(landing).toContain('trustAuthoritative: true');
    expect(landing).not.toContain('revalidateSeconds: 300');
    expect(sohbet).toContain("dynamic = 'force-dynamic'");
    expect(sohbet).toContain('trustAuthoritative: true');
    expect(sohbet).not.toContain('revalidateSeconds: 300');
  });

  it('frozen public fetch uses no-store', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/journey/hydratePublishedJourneysFromServer.ts'),
      'utf8'
    );
    expect(src).toContain("cache: 'no-store'");
  });
});

describe('Phase 8.4.1 cached sohbet revalidation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchPublicMirrorBySlug).mockReset();
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  });

  it('reuses cache only when public + frozen still eligible', async () => {
    cacheSohbetSession({
      sessionId: 'sess-1',
      guestToken: 'guest-phase841-token-abcdefgh',
      mirrorSlug: SLUG,
      cardTitle: 'Demo',
      openingMessage: 'Merhaba',
      thoughtCards: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      parentMirrorId: SLUG,
      rootMirrorId: SLUG,
      seedTopic: 't',
      seedCategory: 'c',
      seedMood: 'm',
    });

    vi.mocked(fetchPublicMirrorBySlug).mockResolvedValue({
      ok: true,
      data: { slug: SLUG } as never,
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue({
      slug: SLUG,
      journeyId: SLUG,
      authorUserId: 'user-1',
    } as never);

    const result = await createMirrorSohbetSession(SLUG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.sessionId).toBe('sess-1');
    expect(fetchPublicMirrorBySlug).toHaveBeenCalled();
  });

  it('blocks cached session after withdrawal (public fetch fails)', async () => {
    cacheSohbetSession({
      sessionId: 'sess-withdrawn',
      guestToken: 'guest-phase841-token-abcdefgh',
      mirrorSlug: SLUG,
      cardTitle: 'Demo',
      openingMessage: 'Merhaba',
      thoughtCards: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      parentMirrorId: SLUG,
      rootMirrorId: SLUG,
      seedTopic: 't',
      seedCategory: 'c',
      seedMood: 'm',
    });

    vi.mocked(fetchPublicMirrorBySlug).mockResolvedValue({ ok: false, status: 404 });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(null);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const result = await createMirrorSohbetSession(SLUG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
    expect(loadCachedSohbetSession(SLUG)).toBeNull();
    fetchSpy.mockRestore();
  });

  it('isSohbetSourceStillEligible requires public and frozen', async () => {
    vi.mocked(fetchPublicMirrorBySlug).mockResolvedValue({
      ok: true,
      data: { slug: SLUG } as never,
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(null);
    expect(await isSohbetSourceStillEligible(SLUG)).toBe(false);

    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue({
      slug: SLUG,
    } as never);
    expect(await isSohbetSourceStillEligible(SLUG)).toBe(true);
  });

  it('clearCachedSohbetSession removes prefix key', () => {
    sessionStorage.setItem(
      `${MIRROR_SOHBET_SESSION_STORAGE_PREFIX}${SLUG}`,
      JSON.stringify({ mirrorSlug: SLUG })
    );
    clearCachedSohbetSession(SLUG);
    expect(sessionStorage.getItem(`${MIRROR_SOHBET_SESSION_STORAGE_PREFIX}${SLUG}`)).toBeNull();
  });
});
