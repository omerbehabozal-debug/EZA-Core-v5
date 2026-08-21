/**
 * Phase 8.8.1 — ops telemetry abuse closure (frontend non-blocking).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.8.1 reportOpsFailure non-blocking', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('ignores 429 without throwing or retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'rate_limit' }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });

    const { reportOpsFailure } = await import('@/lib/eza/opsTelemetry');
    expect(() => reportOpsFailure('discover_load_failed', 'DISCOVER_LOAD_FAILED')).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores network failure without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });

    const { reportOpsFailure } = await import('@/lib/eza/opsTelemetry');
    expect(() => reportOpsFailure('frozen_replay_load_failed', 'FROZEN_ARTIFACT_INVALID')).not.toThrow();
  });

  it('never sends message/stack/url fields', () => {
    const src = read('lib/eza/opsTelemetry.ts');
    expect(src).not.toMatch(/message\s*:/);
    expect(src).not.toContain('stack');
    expect(src).not.toContain('payload');
    expect(src).toContain('keepalive: true');
    expect(src).toContain('.catch');
  });

  it('does not wire Phase 6 experience or ranking', () => {
    const src = read('lib/eza/opsTelemetry.ts');
    expect(src).not.toContain('yansi_experience');
    expect(src).not.toContain('strong_curiosity');
    expect(src).not.toContain('experience-events');
  });
});
