/**
 * Phase 8.8 — privacy-safe observability frontend tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.8 ops telemetry surface', () => {
  it('client reporter never accepts Error objects or free-text payloads', () => {
    const src = read('lib/eza/opsTelemetry.ts');
    expect(src).toContain('reportOpsFailure');
    expect(src).toContain('/api/ops/client-event');
    expect(src).not.toContain('error.message');
    expect(src).not.toContain('stack');
    expect(src).not.toContain('response.body');
    expect(src).toContain('Never sends Error.message');
  });

  it('Discover and frozen landing report allowlisted failures only', () => {
    const discover = read('components/saina/SainaDiscoverPage.tsx');
    const landing = read('components/mirror-landing/MirrorLandingExperience.tsx');
    expect(discover).toContain("reportOpsFailure('discover_load_failed'");
    expect(landing).toContain("reportOpsFailure('frozen_replay_load_failed'");
    expect(discover).not.toContain('phase88-private-conversation-text');
  });

  it('does not wire Phase 6 experience ingest into ops telemetry', () => {
    const src = read('lib/eza/opsTelemetry.ts');
    expect(src).not.toContain('experience-events');
    expect(src).not.toContain('yansi_experience');
    expect(src).not.toContain('strong_curiosity');
  });
});

describe('Phase 8.8 reportOpsFailure helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('posts only event + code and never stores secrets', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });

    const { reportOpsFailure } = await import('@/lib/eza/opsTelemetry');
    reportOpsFailure('discover_load_failed', 'DISCOVER_LOAD_FAILED');
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.event).toBe('discover_load_failed');
    expect(body.code).toBe('DISCOVER_LOAD_FAILED');
    expect(body.message).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });
});
