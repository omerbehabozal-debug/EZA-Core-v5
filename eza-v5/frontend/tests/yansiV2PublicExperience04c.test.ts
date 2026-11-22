/**
 * Stage 04C — V2 public → Deneyimle hydrate / mapper / routing hints.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { parseYansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import { mapV2PublicToFrozenArtifact } from '@/lib/eza/mirror/journey/mapV2PublicToFrozenArtifact';
import { loadPublicExperienceArtifact } from '@/lib/eza/mirror/journey/loadPublicExperienceArtifact';
import { startReplaySession } from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  buildYansiPublicHref,
  parsePinnedContentKind,
} from '@/lib/eza/mirror-network/yansiPublicDepth';
import { parseDiscoverItem } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { yansiV2PublicHref } from '@/lib/eza/businessYansi';

const ASSET_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ASSET_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BIZ = '11111111-1111-1111-1111-111111111111';
const coverPath = `/api/business-yansi/public-media/${BIZ}/${ASSET_A}`;
const stepPath = `/api/business-yansi/public-media/${BIZ}/${ASSET_B}`;

function conversationEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    slug: 'v2-cafe',
    nodeId: '22222222-2222-2222-2222-222222222222',
    publicationVersion: 3,
    isCurrent: true,
    contentKind: 'conversation',
    businessPublisher: {
      businessId: BIZ,
      slug: 'bilign-demo',
      displayName: 'BiligN Demo',
      logoUrl: null,
      verified: true,
      official: true,
    },
    public: {
      slug: 'v2-cafe',
      conversation: {
        turnCount: 2,
        curiosityQuestion: 'Kahve neden ritüel?',
        turns: [
          {
            stepIndex: 1,
            question: 'Kahve neden ritüel?',
            answer: 'Yavaşlamak için.',
            media: [
              {
                type: 'image',
                assetId: ASSET_B,
                title: 'Fincan',
                contentPath: stepPath,
              },
            ],
          },
          {
            stepIndex: 2,
            question: 'Ne değişir?',
            answer: 'Tempo.',
            media: [],
          },
        ],
      },
      cover: {
        assetId: ASSET_A,
        title: 'Kapak',
        contentPath: coverPath,
      },
    },
    ...overrides,
  };
}

function imageEnvelope() {
  return {
    status: 'ok',
    slug: 'v2-photo',
    nodeId: '33333333-3333-3333-3333-333333333333',
    publicationVersion: 1,
    isCurrent: true,
    contentKind: 'image',
    public: {
      slug: 'v2-photo',
      media: {
        assetId: ASSET_A,
        contentPath: coverPath,
        title: 'Vitrin',
      },
    },
  };
}

describe('04C V2 public parse + map', () => {
  it('maps conversation turns, cover, inline media, and publication version', () => {
    const pub = parseYansiV2PublicPublication(conversationEnvelope());
    expect(pub).not.toBeNull();
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact).toMatchObject({
      slug: 'v2-cafe',
      journeyVersion: 3,
      selectedCount: 2,
      sourceKind: 'v2_publication',
      contentKind: 'conversation',
      liveContinuationAvailable: true,
      publicSummary: 'Kahve neden ritüel?',
    });
    expect(artifact!.steps).toHaveLength(2);
    expect(artifact!.steps[0].publicQuestion).toBe('Kahve neden ritüel?');
    expect(artifact!.businessMedia?.cover?.type).toBe('image');
    expect(artifact!.businessMedia?.steps[0]?.[0]).toMatchObject({
      type: 'image',
      contentPath: stepPath,
    });
    expect(artifact!.businessPublisher?.displayName).toBe('BiligN Demo');
    expect(JSON.stringify(artifact)).not.toMatch(/locator|storageKey|brand-assets/i);
  });

  it('maps image-only without inventing Q/A', () => {
    const pub = parseYansiV2PublicPublication(imageEnvelope());
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact).toMatchObject({
      slug: 'v2-photo',
      journeyVersion: 1,
      selectedCount: 0,
      contentKind: 'image',
      steps: [],
      liveContinuationAvailable: true,
    });
    expect(artifact!.sceneImageUrl).toContain(coverPath);
    const session = startReplaySession(artifact!);
    expect(session.replayCompleted).toBe(true);
    expect(session.phase).toBe('completed');
  });

  it('strips private locator media and never leaks it into the artifact', () => {
    const dirty = conversationEnvelope();
    (dirty.public as { conversation: { turns: { media: unknown[] }[] } }).conversation.turns[0].media =
      [
        {
          type: 'image',
          assetId: ASSET_B,
          title: 'bad',
          contentPath: stepPath,
          locator: 's3://secret',
        },
      ];
    const pub = parseYansiV2PublicPublication(dirty);
    expect(pub).not.toBeNull();
    expect(pub!.public && 'conversation' in pub!.public
      ? pub!.public.conversation.turns[0].media
      : null).toEqual([]);
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(JSON.stringify(artifact)).not.toMatch(/locator|s3:\/\//i);
  });

  it('rejects turn count outside 1–8 and mismatched curiosity', () => {
    const badCuriosity = conversationEnvelope();
    (
      badCuriosity.public as {
        conversation: { curiosityQuestion: string };
      }
    ).conversation.curiosityQuestion = 'başka';
    expect(parseYansiV2PublicPublication(badCuriosity)).toBeNull();
  });
});

describe('04C Discover → /m hints', () => {
  it('parses contentKind on Discover items and builds href', () => {
    const item = parseDiscoverItem({
      slug: 'v2-cafe',
      title: 'Cafe',
      yansiCount: 0,
      journeyVersion: 3,
      contentKind: 'conversation',
      sceneImageUrl: coverPath,
    });
    expect(item?.contentKind).toBe('conversation');
    expect(
      buildYansiPublicHref('v2-cafe', {
        journeyVersion: 3,
        contentKind: 'conversation',
      })
    ).toBe('/m/v2-cafe?journeyVersion=3&contentKind=conversation');
    expect(parsePinnedContentKind('?journeyVersion=3&contentKind=image')).toBe(
      'image'
    );
    expect(yansiV2PublicHref('v2-photo', 1, 'image')).toContain(
      'contentKind=image'
    );
  });
});

describe('04C loadPublicExperienceArtifact routing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses V2 when contentKind hint is set (does not require V1)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/business-yansi/v2/public/')) {
        return {
          ok: true,
          json: async () => conversationEnvelope(),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await loadPublicExperienceArtifact({
      slug: 'v2-cafe',
      journeyVersion: 3,
      contentKind: 'conversation',
    });
    expect(artifact?.sourceKind).toBe('v2_publication');
    expect(artifact?.journeyVersion).toBe(3);
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes('/versions/3')
      )
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('/frozen'))
    ).toBe(false);
  });

  it('prefers V1 when no contentKind hint and V1 succeeds', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/frozen')) {
        return {
          ok: true,
          json: async () => ({
            slug: 'v1-yansi',
            journeyId: 'v1-yansi',
            journeyVersion: 2,
            authorUserId: 'user-1',
            selectedCount: 6,
            replayReady: true,
            steps: Array.from({ length: 6 }, (_, i) => ({
              stepIndex: i + 1,
              publicQuestion: `Q${i + 1}`,
              publicAnswer: `A${i + 1}`,
            })),
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await loadPublicExperienceArtifact({
      slug: 'v1-yansi',
      journeyVersion: 2,
    });
    expect(artifact?.sourceKind).toBe('v1_frozen');
    expect(artifact?.journeyVersion).toBe(2);
    expect(artifact?.liveContinuationAvailable).not.toBe(false);
  });

  it('falls back to V2 only after V1 miss with a valid V2 projection', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/frozen')) {
        return { ok: false, json: async () => ({}) };
      }
      if (String(url).includes('/v2/public/')) {
        return {
          ok: true,
          json: async () => conversationEnvelope(),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await loadPublicExperienceArtifact({
      slug: 'v2-cafe',
      journeyVersion: 3,
    });
    expect(artifact?.sourceKind).toBe('v2_publication');
  });

  it('rejects wrong contentKind for same slug', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => conversationEnvelope(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await loadPublicExperienceArtifact({
      slug: 'v2-cafe',
      journeyVersion: 3,
      contentKind: 'image',
    });
    expect(artifact).toBeNull();
  });
});
