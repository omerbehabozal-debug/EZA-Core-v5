/**
 * 07F — /m SSR resolver: V1 precedence, V2 fallback, version pin, 404 vs temporary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPublicMirrorBySlug = vi.fn();
const fetchYansiV2PublicPublicationResult = vi.fn();

vi.mock('@/lib/eza/mirror-network/fetchPublicMirror', () => ({
  fetchPublicMirrorBySlug: (...args: unknown[]) => fetchPublicMirrorBySlug(...args),
}));

vi.mock('@/lib/eza/mirror/journey/fetchYansiV2PublicResult', () => ({
  fetchYansiV2PublicPublicationResult: (...args: unknown[]) =>
    fetchYansiV2PublicPublicationResult(...args),
}));

import { resolvePublicMirrorLanding } from '@/lib/eza/mirror-network/resolvePublicMirrorLanding';

const V1_PAYLOAD = {
  slug: 'v1-yansi',
  shareUrl: '/m/v1-yansi',
  cardTitle: 'V1 Başlık',
  cardDate: '2026-05-31',
  sceneImageUrl: 'https://cdn.example.com/v1.jpg',
  coreCuriosity: 'Merak',
  curiosityContext: 'Özet V1',
  landingContext: 'Landing V1',
};

function conversationV2(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'v2-cafe',
    publicationVersion: 1,
    contentKind: 'conversation' as const,
    isCurrent: true,
    public: {
      slug: 'v2-cafe',
      conversation: {
        turnCount: 1,
        curiosityQuestion: 'Kahve nasıl demlenir?',
        turns: [
          {
            stepIndex: 1,
            question: 'Kahve nasıl demlenir?',
            answer: 'Su ve öğütülmüş kahve.',
            media: [],
          },
        ],
      },
      cover: null,
    },
    ...overrides,
  };
}

describe('07F resolvePublicMirrorLanding', () => {
  beforeEach(() => {
    fetchPublicMirrorBySlug.mockReset();
    fetchYansiV2PublicPublicationResult.mockReset();
  });

  it('uses V1 when mirror-network succeeds (V2 not called)', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: true, data: V1_PAYLOAD });
    const result = await resolvePublicMirrorLanding({ slug: 'v1-yansi' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('v1');
    expect(result.surface.cardTitle).toBe('V1 Başlık');
    expect(fetchYansiV2PublicPublicationResult).not.toHaveBeenCalled();
  });

  it('falls back to coverless V2 conversation after V1 404', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: true,
      data: conversationV2(),
    });
    const result = await resolvePublicMirrorLanding({
      slug: 'v2-cafe',
      searchParams: 'journeyVersion=1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('v2');
    expect(result.surface.slug).toBe('v2-cafe');
    expect(result.surface.curiosityContext).toBe('Kahve nasıl demlenir?');
    expect(result.surface.sceneImageUrl).toBeNull();
    expect(fetchYansiV2PublicPublicationResult).toHaveBeenCalledWith({
      slug: 'v2-cafe',
      publicationVersion: 1,
    });
  });

  it('resolves V2 without contentKind query', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: true,
      data: conversationV2(),
    });
    const result = await resolvePublicMirrorLanding({ slug: 'v2-cafe' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('v2');
    expect(result.contentKind).toBe('conversation');
  });

  it('pins publication version and does not float on miss', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: false,
      status: 404,
    });
    const result = await resolvePublicMirrorLanding({
      slug: 'v2-cafe',
      searchParams: 'journeyVersion=99',
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(fetchYansiV2PublicPublicationResult).toHaveBeenCalledWith({
      slug: 'v2-cafe',
      publicationVersion: 99,
    });
    expect(fetchYansiV2PublicPublicationResult).toHaveBeenCalledTimes(1);
  });

  it('distinguishes temporary V1 failure from not_found', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 502 });
    const result = await resolvePublicMirrorLanding({ slug: 'v1-yansi' });
    expect(result).toEqual({ ok: false, reason: 'temporary', status: 502 });
    expect(fetchYansiV2PublicPublicationResult).not.toHaveBeenCalled();
  });

  it('distinguishes temporary V2 failure after V1 404', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: false,
      status: 503,
    });
    const result = await resolvePublicMirrorLanding({ slug: 'v2-cafe' });
    expect(result).toEqual({ ok: false, reason: 'temporary', status: 503 });
  });

  it('opens V2 image-only after V1 miss', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    const path =
      '/api/business-yansi/public-media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: true,
      data: {
        slug: 'v2-photo',
        publicationVersion: 2,
        contentKind: 'image',
        isCurrent: true,
        public: {
          slug: 'v2-photo',
          media: { assetId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', contentPath: path, title: 'Fincan' },
        },
      },
    });
    const result = await resolvePublicMirrorLanding({
      slug: 'v2-photo',
      searchParams: 'journeyVersion=2&contentKind=image',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('v2');
    expect(result.contentKind).toBe('image');
    expect(result.surface.cardTitle).toBe('Fincan');
    expect(result.surface.sceneImageUrl).toContain(path);
  });

  it('prefers durable V2 title/summary over brand or curiosity for covered conversation', async () => {
    fetchPublicMirrorBySlug.mockResolvedValue({ ok: false, status: 404 });
    const path =
      '/api/business-yansi/public-media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    fetchYansiV2PublicPublicationResult.mockResolvedValue({
      ok: true,
      data: conversationV2({
        title: 'Keşfet: Bilgiyle Sohbetin Yeni Adresi',
        summary: 'Gerçek içerik özeti',
        contentKind: 'mixed',
        businessPublisher: {
          businessId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          slug: 'bilign-demo',
          displayName: 'BiligN Demo',
          logoUrl: null,
          verified: true,
          official: true,
        },
        public: {
          slug: 'v2-cafe',
          conversation: {
            turnCount: 1,
            curiosityQuestion: 'Kahve nasıl demlenir?',
            turns: [
              {
                stepIndex: 1,
                question: 'Kahve nasıl demlenir?',
                answer: 'Su ve öğütülmüş kahve.',
                media: [],
              },
            ],
          },
          cover: {
            assetId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            title: 'Kapak başlığı',
            contentPath: path,
          },
        },
      }),
    });
    const result = await resolvePublicMirrorLanding({ slug: 'v2-cafe' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surface.cardTitle).toBe('Keşfet: Bilgiyle Sohbetin Yeni Adresi');
    expect(result.surface.publicSummary).toBe('Gerçek içerik özeti');
    expect(result.surface.sceneImageUrl).toContain(path);
  });
});
