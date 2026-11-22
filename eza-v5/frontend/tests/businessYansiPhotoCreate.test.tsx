/**
 * Stage 3C-1B — photo Yansı + Bilgi Deposu bind/add UX.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessYansiPhotoCreate from '@/components/saina/business-studio/BusinessYansiPhotoCreate';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';
import { YANSI_PUBLICATION_CONTRACT_V2 } from '@/lib/eza/mirror/journey/yansiV2Publication';
import { yansiV2PublicMediaPath } from '@/lib/eza/businessYansi';

const BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const KV = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const apiMocks = vi.hoisted(() => ({
  publishYansiV2Image: vi.fn(),
  fetchBrandAssetPreview: vi.fn().mockResolvedValue('blob:photo-preview'),
  isBusinessApiError: (error: unknown) =>
    !!error && typeof error === 'object' && (error as { name?: string }).name === 'BusinessApiError',
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>(
    '@/lib/eza/businessYansi',
  );
  return {
    ...actual,
    publishYansiV2Image: apiMocks.publishYansiV2Image,
    fetchBrandAssetPreview: apiMocks.fetchBrandAssetPreview,
    isBusinessApiError: apiMocks.isBusinessApiError,
  };
});

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
    revision: 3,
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
    revision: 2,
    ...partial,
  };
}

function publishedResult(overrides: Record<string, unknown> = {}) {
  const contentPath = yansiV2PublicMediaPath(BIZ, ASSET);
  const contract = {
    contractVersion: YANSI_PUBLICATION_CONTRACT_V2,
    nodeId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    responsePolicy: 'grounded',
    contentKind: 'image',
    contentManifest: {
      blocks: [{ type: 'image', assetId: ASSET, title: 'Kiln', contentPath }],
    },
    manifestHash: 'a'.repeat(64),
    contractHash: 'b'.repeat(64),
    knowledgeBundleVersionRef: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    publicationVersion: 1,
  };
  return {
    status: 'published',
    idempotent: false,
    nodeId: contract.nodeId,
    slug: 'kiln-morning',
    publicationVersion: 1,
    contractHash: contract.contractHash,
    manifestHash: contract.manifestHash,
    bundleVersionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    bundleHash: 'c'.repeat(64),
    assetId: ASSET,
    assetRevision: 3,
    public: {
      slug: 'kiln-morning',
      contract,
      bundle: {
        items: [
          { sourceKind: 'knowledge_version', sourceRefId: KV, title: 'Garanti' },
          { sourceKind: 'image_asset', sourceRefId: ASSET },
        ],
      },
      media: { assetId: ASSET, contentPath, title: 'Kiln' },
    },
    ...overrides,
  };
}

describe('BusinessYansiPhotoCreate knowledge bind', () => {
  beforeEach(() => {
    apiMocks.publishYansiV2Image.mockReset();
    apiMocks.fetchBrandAssetPreview.mockClear();
    sessionStorage.clear();
  });

  it('publishes with empty pool and optional linked knowledge', async () => {
    apiMocks.publishYansiV2Image.mockResolvedValue(publishedResult());
    render(
      <BusinessYansiPhotoCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
      />,
    );
    fireEvent.click(screen.getByTestId('biz-photo-create-open'));
    fireEvent.click(screen.getByTestId(`biz-photo-create-asset-${ASSET}`));
    fireEvent.change(screen.getByTestId('biz-photo-create-title'), {
      target: { value: 'Sabah fırını' },
    });
    fireEvent.click(screen.getByTestId('biz-photo-create-bind'));
    fireEvent.click(screen.getByTestId(`biz-photo-create-bind-item-${KV}`));
    expect(screen.getByTestId('biz-photo-create-linked-list').textContent).toContain('Garanti');
    fireEvent.click(screen.getByTestId('biz-photo-create-to-preview'));
    expect(await screen.findByTestId('biz-photo-create-preview-sources')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId('biz-photo-create-publish'));
    });
    await waitFor(() => expect(apiMocks.publishYansiV2Image).toHaveBeenCalledTimes(1));
    const [, body] = apiMocks.publishYansiV2Image.mock.calls[0];
    expect(body.knowledgeSources).toEqual([{ knowledgeVersionId: KV, expectedRevision: 2 }]);
    expect(await screen.findByTestId('biz-photo-create-success')).toBeTruthy();
    expect(screen.getByTestId('biz-photo-create-success').textContent).toMatch(/mühürlendi/i);
  });

  it('allows multi select/deselect and keeps draft when opening add panel', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <BusinessYansiPhotoCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[
          knowledge(),
          knowledge({
            id: '11111111-1111-1111-1111-111111111111',
            title: 'Stok',
            content: 'Stok sınırlı',
            revision: 1,
          }),
        ]}
        role="owner"
        canEdit
        onSaveKnowledge={onSave}
        onKnowledgeChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByTestId('biz-photo-create-open'));
    fireEvent.change(screen.getByTestId('biz-photo-create-title'), {
      target: { value: 'Draft keep' },
    });
    fireEvent.click(screen.getByTestId('biz-photo-create-bind'));
    fireEvent.click(screen.getByTestId(`biz-photo-create-bind-item-${KV}`));
    fireEvent.click(screen.getByTestId('biz-photo-create-bind-item-11111111-1111-1111-1111-111111111111'));
    expect(screen.getByTestId('biz-photo-create-bind-count').textContent).toMatch(/Seçili: 2/);
    fireEvent.click(screen.getByTestId(`biz-photo-create-bind-item-${KV}`));
    expect(screen.getByTestId('biz-photo-create-bind-count').textContent).toMatch(/Seçili: 1/);
    fireEvent.click(screen.getByTestId('biz-photo-create-add'));
    expect(screen.getByTestId('biz-photo-create-add-panel')).toBeTruthy();
    expect((screen.getByTestId('biz-photo-create-title') as HTMLInputElement).value).toBe('Draft keep');
  });

  it('still publishes with empty knowledge pool', async () => {
    apiMocks.publishYansiV2Image.mockResolvedValue(
      publishedResult({
        public: {
          slug: 'solo',
          contract: publishedResult().public.contract,
          bundle: { items: [{ sourceKind: 'image_asset', sourceRefId: ASSET }] },
          media: publishedResult().public.media,
        },
      }),
    );
    render(
      <BusinessYansiPhotoCreate businessId={BIZ} assets={[image()]} knowledge={[]} role="owner" canEdit />,
    );
    fireEvent.click(screen.getByTestId('biz-photo-create-open'));
    fireEvent.click(screen.getByTestId(`biz-photo-create-asset-${ASSET}`));
    fireEvent.change(screen.getByTestId('biz-photo-create-title'), { target: { value: 'Solo' } });
    fireEvent.click(screen.getByTestId('biz-photo-create-to-preview'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('biz-photo-create-publish'));
    });
    await waitFor(() => expect(apiMocks.publishYansiV2Image).toHaveBeenCalled());
    expect(apiMocks.publishYansiV2Image.mock.calls[0][1].knowledgeSources).toBeUndefined();
  });
});
