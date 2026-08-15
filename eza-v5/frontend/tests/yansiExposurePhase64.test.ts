/**
 * Phase 6.4 — exposure visibility/dwell/dedupe and own-continuation helper.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearYansiExposureForTests,
  evaluateYansiExposureWindow,
  getOrCreateYansiExposureSession,
  hasSentYansiExposure,
  lineageProofTokenForStandaloneRequest,
  markYansiExposureSent,
  trackYansiExposure,
  yansiExposureSentKey,
  YANSI_EXPOSURE_MIN_DWELL_MS,
  YANSI_EXPOSURE_MIN_RATIO,
} from '@/lib/eza/mirror-network/yansiExposure';
import { formatYansiPublicSocialProof } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';

afterEach(() => {
  clearYansiExposureForTests();
});

describe('Phase 6.4 exposure window', () => {
  it('offscreen ratio does not count', () => {
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: 0.2,
        documentHidden: false,
        dwellMs: 2000,
      })
    ).toBe('ignore');
  });

  it('short flash below dwell does not count', () => {
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: YANSI_EXPOSURE_MIN_RATIO,
        documentHidden: false,
        dwellMs: YANSI_EXPOSURE_MIN_DWELL_MS - 1,
      })
    ).toBe('pending');
  });

  it('valid visibility + dwell counts once', () => {
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: 0.7,
        documentHidden: false,
        dwellMs: YANSI_EXPOSURE_MIN_DWELL_MS,
      })
    ).toBe('count');
  });

  it('background/hidden document does not count', () => {
    expect(
      evaluateYansiExposureWindow({
        intersectionRatio: 1,
        documentHidden: true,
        dwellMs: 5000,
      })
    ).toBe('ignore');
  });

  it('IO oscillation is deduped per session+slug+version+context', () => {
    const a = getOrCreateYansiExposureSession();
    const again = getOrCreateYansiExposureSession();
    expect(again).toBe(a);
    expect(hasSentYansiExposure('yansi-a', 1, 'discover')).toBe(false);
    markYansiExposureSent('yansi-a', 1, 'discover');
    expect(hasSentYansiExposure('yansi-a', 1, 'discover')).toBe(true);
    expect(hasSentYansiExposure('yansi-a', 1, 'landing')).toBe(false);
  });

  it('v1 and v2 have distinct exposure identity', () => {
    expect(yansiExposureSentKey('yansi-a', 1, 'discover')).not.toBe(
      yansiExposureSentKey('yansi-a', 2, 'discover')
    );
    markYansiExposureSent('yansi-a', 1, 'discover');
    expect(hasSentYansiExposure('yansi-a', 2, 'discover')).toBe(false);
  });

  it('POST is fire-and-forget and never includes Q/A/EZA', async () => {
    const prev = globalThis.fetch;
    const spy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true })));
    globalThis.fetch = spy as typeof fetch;
    try {
      trackYansiExposure({ slug: 'yansi-a', journeyVersion: 1, context: 'discover' });
      trackYansiExposure({ slug: 'yansi-a', journeyVersion: 1, context: 'discover' });
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
      expect(body.context).toBe('discover');
      expect(body.journeyVersion).toBe(1);
      expect(JSON.stringify(body)).not.toMatch(/publicQuestion|ezaSnapshot|userAgent|fingerprint/i);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

describe('Phase 6.4 public copy + continuation helper', () => {
  it('public copy still only formats N deneyim · N Yansı', () => {
    expect(formatYansiPublicSocialProof({ experienceStartedCount: 12, directChildYansiCount: 3 })?.visible).toBe(
      '12 deneyim · 3 Yansı'
    );
    const src = readFileSync(
      join(__dirname, '../lib/eza/mirror-network/yansiPublicMetricsCopy.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/attraction|confidence|continuation|engagement/i);
  });

  it('sohbet load/session files do not call exposure continuation recorder', () => {
    const sohbet = readFileSync(
      join(__dirname, '../components/mirror-landing/MirrorSohbetOpening.tsx'),
      'utf8'
    );
    const session = readFileSync(
      join(__dirname, '../lib/eza/mirror-network/createSohbetSession.ts'),
      'utf8'
    );
    expect(sohbet).not.toContain('lineageProofTokenForStandaloneRequest');
    expect(session).not.toContain('lineageProofTokenForStandaloneRequest');
    expect(sohbet).not.toContain('ownContinuation');
  });

  it('stream helper sends proof token and never a client parent slug', () => {
    expect(
      lineageProofTokenForStandaloneRequest({ lineageProofToken: '  proof-1  ' })
    ).toBe('proof-1');
    expect(lineageProofTokenForStandaloneRequest({ lineageProofToken: '' })).toBeUndefined();
    const inner = readFileSync(
      join(__dirname, '../components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(inner).toContain('lineageProofToken');
    expect(inner).toContain('lineageProofTokenForSend');
  });
});
