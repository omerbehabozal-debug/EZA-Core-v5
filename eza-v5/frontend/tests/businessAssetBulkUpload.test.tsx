import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import BusinessAssetLibrary from '@/components/saina/business-studio/BusinessAssetLibrary';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';

const mocks = vi.hoisted(() => ({
  businessRequest: vi.fn(),
  uploadBrandImage: vi.fn(),
  uploadBrandVideo: vi.fn(),
  replaceBrandImage: vi.fn(),
  fetchBrandAssetPreview: vi.fn(async () => 'blob:image'),
  fetchCoverJob: vi.fn(async () => ({
    status: 'ready',
    resultAssetId: 'cover-1',
    errorCode: null,
    startSeconds: 0,
    endSeconds: 20,
  })),
  retryCoverJob: vi.fn(),
  requestCoverSegment: vi.fn(),
  fetchBrandVideoPreview: vi.fn(async () => 'blob:video'),
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>('@/lib/eza/businessYansi');
  return { ...actual, ...mocks };
});

const knowledge: Knowledge = {
  id: 'kb-1',
  item_id: 'item-1',
  title: 'Menü',
  category: 'ürün',
  content: 'Zeytinyağlı yaprak dolması…',
  source: 'Marka',
  public_allowed: true,
  status: 'published',
  version: 1,
  revision: 1,
};

function makeAsset(id: string, overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id,
    business_id: 'biz-1',
    asset_type: 'image',
    title: '',
    caption: '',
    locator_kind: 'storage',
    locator: null,
    latitude: null,
    longitude: null,
    public_allowed: false,
    status: 'published',
    revision: 1,
    links: [],
    ...overrides,
  };
}

const libraryStore: { rows: BrandAsset[] } = { rows: [] };

beforeEach(() => {
  libraryStore.rows = [];
  Object.values(mocks).forEach((fn) => fn.mockReset?.());
  mocks.fetchBrandAssetPreview.mockResolvedValue('blob:image');
  mocks.fetchBrandVideoPreview.mockResolvedValue('blob:video');
  mocks.fetchCoverJob.mockResolvedValue({
    status: 'ready',
    resultAssetId: 'cover-1',
    errorCode: null,
    startSeconds: 0,
    endSeconds: 20,
  });
  mocks.uploadBrandImage.mockImplementation(async (_biz, file: File, fields) => {
    const asset = makeAsset(`img-${file.name}`, { title: fields?.title || '', public_allowed: false });
    libraryStore.rows = [...libraryStore.rows.filter((row) => row.id !== asset.id), asset];
    return asset;
  });
  mocks.uploadBrandVideo.mockImplementation(async (_biz, file: File, fields, onProgress?: (n: number) => void) => {
    onProgress?.(0.5);
    onProgress?.(1);
    const asset = makeAsset(`vid-${file.name}`, {
      asset_type: 'video',
      title: fields?.title || '',
      public_allowed: !!fields?.publicAllowed,
    });
    libraryStore.rows = [...libraryStore.rows.filter((row) => row.id !== asset.id), asset];
    return asset;
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

function LibraryHarness({ initial = [] as BrandAsset[] } = {}) {
  const [assets, setAssets] = useState<BrandAsset[]>(initial);
  return (
    <BusinessAssetLibrary
      businessId="biz-1"
      assets={assets}
      knowledge={[knowledge]}
      canEdit
      busy={false}
      onChanged={async () => {
        setAssets([...libraryStore.rows]);
      }}
    />
  );
}

describe('Business asset bulk media upload', () => {
  it('uploads multiple selected images privately without requiring a title', async () => {
    render(<LibraryHarness />);
    const files = [
      new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array([4, 5, 6])], 'b.webp', { type: 'image/webp' }),
    ];
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files } });
    await waitFor(() => expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2));
    expect(mocks.uploadBrandImage.mock.calls[0][2]).toEqual({
      title: '',
      caption: '',
      publicAllowed: false,
    });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-a.png')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-img-b.webp')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
  });

  it('uploads multiple videos privately and keeps cover preparation on the library card', async () => {
    render(<LibraryHarness />);
    const files = [
      new File([new Uint8Array([1])], 'one.mp4', { type: 'video/mp4' }),
      new File([new Uint8Array([2])], 'two.mp4', { type: 'video/mp4' }),
    ];
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files } });
    await waitFor(() => expect(mocks.uploadBrandVideo).toHaveBeenCalledTimes(2));
    expect(mocks.uploadBrandVideo.mock.calls[0][2]).toEqual({
      title: '',
      caption: '',
      publicAllowed: false,
    });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-vid-one.mp4')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-vid-two.mp4')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
    expect(screen.getAllByText('Başlıksız video')).toHaveLength(2);
    await waitFor(() => {
      expect(mocks.fetchCoverJob).toHaveBeenCalled();
    });
  });

  it('rejects oversized images before calling the API', async () => {
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={async () => undefined}
      />,
    );
    const huge = new File([new Uint8Array(16 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [huge] } });
    await waitFor(() => {
      expect(screen.getByText('Dosya boyut sınırı aşıldı.')).toBeInTheDocument();
    });
    expect(mocks.uploadBrandImage).not.toHaveBeenCalled();
  });

  it('shows three library cards after three async uploads without duplicating temp success cards', async () => {
    const deferred: Array<{ resolve: (asset: BrandAsset) => void }> = [];
    mocks.uploadBrandImage.mockImplementation(
      () =>
        new Promise<BrandAsset>((resolve) => {
          deferred.push({
            resolve: (asset) => {
              libraryStore.rows = [...libraryStore.rows.filter((row) => row.id !== asset.id), asset];
              resolve(asset);
            },
          });
        }),
    );
    render(<LibraryHarness />);
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), {
      target: {
        files: [
          new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }),
          new File([new Uint8Array([2])], 'two.png', { type: 'image/png' }),
          new File([new Uint8Array([3])], 'three.png', { type: 'image/png' }),
        ],
      },
    });
    await waitFor(() => expect(deferred).toHaveLength(3));
    expect(screen.getByTestId('biz-asset-upload-grid')).toBeInTheDocument();
    await act(async () => {
      deferred.forEach((row, index) => row.resolve(makeAsset(`img-${index + 1}`)));
    });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-1')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-img-2')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-img-3')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
  });

  it('keeps failed uploads for retry and clears the temp card after a successful retry refetch', async () => {
    mocks.uploadBrandVideo
      .mockRejectedValueOnce(Object.assign(new Error('Video MP4 olmalı.'), { code: 'video_file_rejected' }))
      .mockImplementation(async () => {
        const asset = makeAsset('img-retry', { asset_type: 'video', public_allowed: false });
        libraryStore.rows = [asset];
        return asset;
      });
    render(<LibraryHarness />);
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), {
      target: { files: [new File([new Uint8Array([9])], 'retry.mp4', { type: 'video/mp4' })] },
    });
    await waitFor(() => expect(screen.getByText('Video MP4 olmalı.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    await waitFor(() => expect(mocks.uploadBrandVideo).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('biz-asset-img-retry')).toBeInTheDocument());
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
  });

  it('ignores a second drop of the same in-flight files', async () => {
    let release!: (asset: BrandAsset) => void;
    mocks.uploadBrandVideo.mockImplementation(
      () =>
        new Promise<BrandAsset>((resolve) => {
          release = (asset) => {
            libraryStore.rows = [asset];
            resolve(asset);
          };
        }),
    );
    render(<LibraryHarness />);
    const file = new File([new Uint8Array([7])], 'same.mp4', { type: 'video/mp4', lastModified: 42 });
    const zone = screen.getByTestId('biz-asset-dropzone');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(mocks.uploadBrandVideo).toHaveBeenCalledTimes(1));
    await act(async () => {
      release(makeAsset('img-same', { asset_type: 'video' }));
    });
    await waitFor(() => expect(screen.getByTestId('biz-asset-img-same')).toBeInTheDocument());
  });

  it('allows intentionally re-uploading the same file after the previous upload finishes', async () => {
    render(<LibraryHarness />);
    const file = new File([new Uint8Array([8])], 'again.png', { type: 'image/png', lastModified: 99 });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('biz-asset-img-again.png')).toBeInTheDocument());
    mocks.uploadBrandImage.mockImplementation(async () => {
      const asset = makeAsset('img-again-2');
      libraryStore.rows = [...libraryStore.rows, asset];
      return asset;
    });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('biz-asset-img-again-2')).toBeInTheDocument());
  });

  it('creates a place with optional title and requires coordinates', async () => {
    mocks.businessRequest.mockImplementation(async (path: string, method?: string, body?: Record<string, unknown>) => {
      if (method === 'POST' && path.endsWith('/assets')) {
        return makeAsset('place-1', {
          asset_type: 'place',
          title: String(body?.title || ''),
          caption: String(body?.caption || ''),
          latitude: String(body?.latitude || ''),
          longitude: String(body?.longitude || ''),
          locator_kind: null,
          public_allowed: false,
        });
      }
      return {};
    });
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Konum / bağlantı' }));
    fireEvent.change(screen.getByLabelText('Adres veya yer tanımı'), { target: { value: 'Karaköy' } });
    expect(screen.getByTestId('biz-place-coord-hint')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Enlem'), { target: { value: '41.025' } });
    fireEvent.change(screen.getByLabelText('Boylam'), { target: { value: '28.974' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(mocks.businessRequest).toHaveBeenCalled());
    const body = mocks.businessRequest.mock.calls[0][2] as { title: string; caption: string; publicAllowed: boolean };
    expect(body.title).toBe('');
    expect(body.caption).toBe('Karaköy');
    expect(body.publicAllowed).toBe(false);
  });

  it('asks for archive confirmation before calling the archive API', async () => {
    const asset = makeAsset('arch-1', { title: 'Atölye', revision: 3 });
    mocks.businessRequest.mockResolvedValue({ ...asset, status: 'archived', revision: 4 });
    const onChanged = vi.fn(async () => undefined);
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[asset]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByTestId('biz-asset-archive-arch-1'));
    expect(screen.getByTestId('biz-asset-archive-confirm-arch-1')).toHaveTextContent(
      'Bu içerik aktif kütüphaneden kaldırılacak.',
    );
    expect(mocks.businessRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'İptal' }));
    expect(screen.queryByTestId('biz-asset-archive-confirm-arch-1')).not.toBeInTheDocument();
    expect(mocks.businessRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('biz-asset-archive-arch-1'));
    fireEvent.click(screen.getByTestId('biz-asset-archive-confirm-submit-arch-1'));
    await waitFor(() => {
      expect(mocks.businessRequest).toHaveBeenCalledWith('/biz-1/assets/arch-1/archive', 'POST', { revision: 3 });
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('creates a link with only an HTTPS URL and shows hostname fallback', async () => {
    const link = makeAsset('link-1', {
      asset_type: 'link',
      title: '',
      locator_kind: 'https',
      locator: 'https://example.com/menu',
      public_allowed: false,
    });
    mocks.businessRequest.mockResolvedValue(link);
    const { rerender } = render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Konum / bağlantı' }));
    fireEvent.change(screen.getByLabelText('İçerik türü'), { target: { value: 'link' } });
    fireEvent.change(screen.getByLabelText('Bağlantı adresi'), { target: { value: 'https://example.com/menu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(mocks.businessRequest).toHaveBeenCalled());
    const body = mocks.businessRequest.mock.calls[0][2] as { title: string; locator: string; publicAllowed: boolean };
    expect(body.title).toBe('');
    expect(body.locator).toBe('https://example.com/menu');
    expect(body.publicAllowed).toBe(false);
    rerender(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[link]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={async () => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'example.com' })).toBeInTheDocument();
    expect(screen.getByTestId('biz-asset-plus-link-1')).toBeInTheDocument();
  });
});
