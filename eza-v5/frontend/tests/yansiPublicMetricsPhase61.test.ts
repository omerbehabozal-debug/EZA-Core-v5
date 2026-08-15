import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearYansiPublicMetricsCacheForTests,
  fetchYansiPublicMetrics,
  isYansiPublicMetrics,
} from '@/lib/eza/mirror-network/yansiPublicMetrics';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/apiClient';

const sample = {
  slug: 'yansi-a',
  journeyVersion: 1,
  experienceStartedCount: 140,
  experienceCompletedCount: 93,
  experienceSkippedSessionCount: 28,
  completionRate: 0.6643,
  skipRate: 0.2,
  observedAverageDepth: 5.7,
  directChildYansiCount: 7,
};

describe('Phase 6.1 public Yansı metrics helper', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    clearYansiPublicMetricsCacheForTests();
  });

  it('accepts the privacy-safe aggregate DTO', () => {
    expect(isYansiPublicMetrics(sample)).toBe(true);
  });

  it('rejects viewer/session identifiers and extra identity fields', () => {
    expect(
      isYansiPublicMetrics({
        ...sample,
        experienceSessionId: 'sess',
      })
    ).toBe(false);
    expect(
      isYansiPublicMetrics({
        ...sample,
        viewerUserId: 'u1',
        eventId: 'e1',
        destinationSlug: 'yansi-b',
      })
    ).toBe(false);
    expect(
      isYansiPublicMetrics({
        ...sample,
        ownContinuationStartedCount: 3,
      })
    ).toBe(false);
  });

  it('locks deneyim = started sessions and Yansı = direct children', () => {
    expect(sample.experienceStartedCount).toBe(140);
    expect(sample.directChildYansiCount).toBe(7);
  });

  it('GET /metrics without wiring UI; 404 is ok:false', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: sample });
    const ok = await fetchYansiPublicMetrics('Yansi-A', 1);
    expect(ok.ok).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/mirror-network/yansi-a/metrics',
      expect.objectContaining({
        auth: false,
        params: { journeyVersion: '1' },
      })
    );
    if (ok.ok) {
      expect(ok.data.experienceStartedCount).toBe(140);
    }

    vi.mocked(apiClient.get).mockResolvedValue({ ok: false });
    const missing = await fetchYansiPublicMetrics('nope');
    expect(missing.ok).toBe(false);
  });

  it('rejects negative and non-integer public counts', () => {
    expect(isYansiPublicMetrics({ ...sample, experienceStartedCount: -1 })).toBe(false);
    expect(isYansiPublicMetrics({ ...sample, directChildYansiCount: 1.5 })).toBe(false);
  });

  it('dedupes concurrent and repeated GET for the same slug+version', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: sample });
    const [a, b] = await Promise.all([
      fetchYansiPublicMetrics('yansi-a', 1),
      fetchYansiPublicMetrics('yansi-a', 1),
    ]);
    expect(a.ok && b.ok).toBe(true);
    await fetchYansiPublicMetrics('yansi-a', 1);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
