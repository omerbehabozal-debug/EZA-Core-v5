import { describe, expect, it } from 'vitest';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';
import { buildYansiV2ImagePublishBody, yansiV2PublicMediaPath } from '@/lib/eza/businessYansi';
import {
  assetAiAvailability,
  buildKnowledgeSourcePins,
  buildPhotoPreviewManifest,
  knowledgeAiAvailability,
  normalizePhotoDraft,
  previewMatchesPublishedContract,
  publishableImageAssets,
  sealedBundleIncludesKnowledge,
} from '@/lib/eza/yansiV2PhotoCreate';
import { YANSI_PUBLICATION_CONTRACT_V2 } from '@/lib/eza/mirror/journey/yansiV2Publication';

const BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const KV = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function image(partial: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: ASSET,
    business_id: BIZ,
    asset_type: 'image',
    title: 'Kiln',
    caption: '',
    locator_kind: 'storage',
    locator: `brand-assets/${BIZ}/x.png`,
    latitude: null,
    longitude: null,
    public_allowed: true,
    status: 'published',
    revision: 1,
    links: [],
    ...partial,
  };
}

function knowledge(partial: Partial<Knowledge> = {}): Knowledge {
  return {
    id: KV,
    item_id: 'item-1',
    title: 'Garanti',
    category: 'ürün',
    content: 'WX-100 garantisi 2 yıldır.',
    source: 'Marka kitabı',
    public_allowed: true,
    status: 'published',
    version: 1,
    revision: 4,
    ...partial,
  };
}

describe('yansiV2PhotoCreate preview / publish alignment', () => {
  it('filters publishable images without requiring knowledge pool', () => {
    const assets = [
      image(),
      image({ id: '11111111-1111-1111-1111-111111111111', asset_type: 'video', title: 'clip' }),
      image({ id: '22222222-2222-2222-2222-222222222222', public_allowed: false }),
      image({ id: '33333333-3333-3333-3333-333333333333', status: 'draft' }),
    ];
    expect(publishableImageAssets(assets).map((a) => a.id)).toEqual([ASSET]);
  });

  it('builds preview with linked knowledge and honest media labels', () => {
    const preview = buildPhotoPreviewManifest(
      BIZ,
      image(),
      {
        assetId: ASSET,
        title: 'Sabah fırını',
        description: 'İsteğe bağlı açıklama',
        knowledgeNotes: ['Garanti 2 yıl', ''],
        linkedKnowledgeIds: [KV],
        slug: 'sabah-firini',
      },
      [knowledge()],
    );
    expect(preview).not.toBeNull();
    expect(preview!.linkedKnowledge).toHaveLength(1);
    expect(preview!.linkedKnowledge[0].title).toBe('Garanti');
    expect(preview!.image.contentPath).toBe(yansiV2PublicMediaPath(BIZ, ASSET));
    expect(assetAiAvailability(image({ asset_type: 'link', title: 'Site' })).aiReady).toBe(false);
    expect(assetAiAvailability(image({ asset_type: 'place', title: 'Atölye' })).aiReady).toBe(false);
    expect(knowledgeAiAvailability(knowledge({ public_allowed: false })).aiReady).toBe(true);
  });

  it('omits unsupported fields and pins knowledgeSources from draft', () => {
    const body = buildYansiV2ImagePublishBody({
      assetId: ASSET,
      expectedAssetRevision: 1,
      title: '  Title  ',
      description: '  note  ',
      knowledgeNotes: [' A ', '', ' B '],
      knowledgeSources: buildKnowledgeSourcePins(
        {
          assetId: ASSET,
          title: 'Title',
          description: 'note',
          knowledgeNotes: [],
          linkedKnowledgeIds: [KV],
          slug: '',
        },
        [knowledge()],
      ),
      slug: ' kiln ',
      expectedCurrentVersion: null,
      idempotencyKey: 'key-1',
    });
    expect(body).toEqual({
      assetId: ASSET,
      expectedAssetRevision: 1,
      title: 'Title',
      description: 'note',
      knowledgeNotes: ['A', 'B'],
      knowledgeSources: [{ knowledgeVersionId: KV, expectedRevision: 4 }],
      slug: 'kiln',
      expectedCurrentVersion: null,
      idempotencyKey: 'key-1',
    });
    expect(body).not.toHaveProperty('bundleId');
    expect(body).not.toHaveProperty('responsePolicy');
  });

  it('verifies sealed bundle includes linked knowledge ids', () => {
    expect(
      sealedBundleIncludesKnowledge(
        {
          items: [
            { sourceKind: 'knowledge_version', sourceRefId: KV },
            { sourceKind: 'image_asset', sourceRefId: ASSET },
          ],
        },
        [KV],
      ),
    ).toBe(true);
    expect(sealedBundleIncludesKnowledge({ items: [] }, [KV])).toBe(false);
  });

  it('detects preview vs published contract alignment', () => {
    const preview = buildPhotoPreviewManifest(
      BIZ,
      image(),
      {
        assetId: ASSET,
        title: 'Aligned',
        description: '',
        knowledgeNotes: [],
        linkedKnowledgeIds: [],
        slug: '',
      },
      [],
    )!;
    const published = {
      contractVersion: YANSI_PUBLICATION_CONTRACT_V2,
      nodeId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      responsePolicy: 'grounded',
      contentKind: 'image',
      contentManifest: { blocks: [preview.image] },
      manifestHash: 'a'.repeat(64),
      contractHash: 'b'.repeat(64),
      knowledgeBundleVersionRef: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      publicationVersion: 1,
    };
    expect(previewMatchesPublishedContract(preview, published)).toBe(true);
  });

  it('normalizes draft without inventing knowledge-pool sources', () => {
    const normalized = normalizePhotoDraft({
      assetId: ASSET,
      title: '  x  ',
      description: ' d ',
      knowledgeNotes: ['', ' note ', ''],
      linkedKnowledgeIds: [KV, KV, ''],
      slug: ' s ',
    });
    expect(normalized.title).toBe('x');
    expect(normalized.knowledgeNotes).toEqual(['note']);
    expect(normalized.linkedKnowledgeIds).toEqual([KV]);
  });
});
