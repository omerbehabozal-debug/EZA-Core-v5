import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { trackSeedStart, SEED_START_EVENT } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import {
  cacheSohbetSession,
  loadCachedSohbetSession,
} from '@/lib/eza/mirror-network/createSohbetSession';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';

const SAMPLE_SESSION: MirrorSohbetSession = {
  sessionId: 'sess-1',
  guestToken: 'guest-token-abcdefghijklmnop',
  mirrorSlug: 'sokak-lambalari-test',
  cardTitle: 'Sokak Lambaları',
  openingMessage:
    "Bu Mirror, Kyoto'nun akşam ritmini keşfetme merakından doğdu.\n\nŞimdi bu yolculuk senin sorularınla devam ediyor.",
  thoughtCards: [{ id: 'thought-1', label: 'Akşam sokaklarını keşfet' }],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
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
});
