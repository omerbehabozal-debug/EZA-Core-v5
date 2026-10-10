import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { trackSeedStart, SEED_START_EVENT } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import {
  cacheSohbetSession,
  loadCachedSohbetSession,
  createMirrorSohbetSession,
} from '@/lib/eza/mirror-network/createSohbetSession';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';

const SAMPLE_SESSION: MirrorSohbetSession = {
  sessionId: 'sess-1',
  guestToken: 'guest-token-abcdefghijklmnop',
  mirrorSlug: 'sokak-lambalari-test',
  cardTitle: 'Sokak Lambaları',
  openingMessage:
    "Bu Ayna, Kyoto'nun akşam ritmini keşfetme merakından doğdu.\n\nŞimdi bu yolculuk senin sorularınla devam ediyor.",
  thoughtCards: [{ id: 'thought-1', label: 'Akşam sokaklarını keşfet' }],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  parentMirrorId: 'sokak-lambalari-test',
  rootMirrorId: 'sokak-lambalari-test',
  seedTopic: 'Sokak Lambaları',
  seedCategory: 'travel',
  seedMood: 'discovery',
};

describe('mirror sohbet (Stage 2B)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trackSeedStart fires once per slug per session', () => {
    const handler = vi.fn();
    window.addEventListener(SEED_START_EVENT, handler);

    trackSeedStart('sokak-lambalari-test');
    trackSeedStart('sokak-lambalari-test');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('saina_seed_start:sokak-lambalari-test')).toBe('1');
  });

  it('caches and loads sohbet session without private fields', () => {
    cacheSohbetSession(SAMPLE_SESSION);
    const loaded = loadCachedSohbetSession('sokak-lambalari-test');
    expect(loaded?.sessionId).toBe('sess-1');
    const json = JSON.stringify(loaded);
    expect(json).not.toContain('coreCuriosity');
    expect(json).not.toContain('conversationId');
    expect(json).not.toContain('userId');
  });

  it('opening message does not expose seed terminology in UI copy', () => {
    expect(SAMPLE_SESSION.openingMessage.toLowerCase()).not.toContain('seed');
    expect(SAMPLE_SESSION.openingMessage).toContain('senin sorularınla devam ediyor');
  });

  it('requests the completed prefix from the server rather than reusing a generic cached session', async () => {
    cacheSohbetSession(SAMPLE_SESSION);
    const replaySelection = { slug: SAMPLE_SESSION.mirrorSlug, journeyVersion: 3, completedStepCount: 1 };
    const publicReplayContext = { ...replaySelection, publicTitle: 'Public başlık', authorUserId: 'publisher',
      steps: [{ stepIndex: 1, publicQuestion: 'Public soru?', publicAnswer: 'Public cevap.' }] };
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...SAMPLE_SESSION, publicReplayContext }), { status: 201 }));
    const result = await createMirrorSohbetSession(SAMPLE_SESSION.mirrorSlug, { replaySelection });
    expect(result.ok).toBe(true);
    const body = JSON.parse(request.mock.calls[0][1]?.body as string);
    expect(body.replaySelection).toEqual(replaySelection);
    expect(body).not.toHaveProperty('history');
    expect(body).not.toHaveProperty('steps');
  });

  it('fails closed when an older backend omits the requested public context', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(SAMPLE_SESSION), { status: 201 }));
    const result = await createMirrorSohbetSession(SAMPLE_SESSION.mirrorSlug, {
      replaySelection: { slug: SAMPLE_SESSION.mirrorSlug, journeyVersion: 3, completedStepCount: 4 },
    });
    expect(result).toEqual({ ok: false, status: 502 });
  });
});
