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

vi.mock('@/components/saina/business-studio/PlaceLocationPicker', () => ({
  default: function MockPlaceLocationPicker({
    latitude,
    longitude,
    includeFormFields = true,
    onCoordinatesChange,
    onPlaceLabelChange,
  }: {
    businessId: string;
    latitude: string;
    longitude: string;
    includeFormFields?: boolean;
    onCoordinatesChange: (next: { latitude: string; longitude: string }) => void;
    onPlaceLabelChange?: (label: string) => void;
  }) {
    return (
      <div data-testid="biz-place-picker">
        <input data-testid="biz-place-search-input" aria-label="Yer ara" defaultValue="" />
        <button
          type="button"
          data-testid="biz-place-search-result"
          onClick={() => {
            onCoordinatesChange({ latitude: '41.025000', longitude: '28.974000' });
            onPlaceLabelChange?.('Karaköy, İstanbul');
          }}
        >
          search-result
        </button>
        <button
          type="button"
          data-testid="biz-place-map-click"
          onClick={() => onCoordinatesChange({ latitude: '41.025000', longitude: '28.974000' })}
        >
          map-click
        </button>
        <button
          type="button"
          data-testid="biz-place-map-drag"
          onClick={() => onCoordinatesChange({ latitude: '41.030000', longitude: '28.980000' })}
        >
          marker-drag
        </button>
        <span data-testid="biz-place-selection">
          {latitude && longitude ? `${latitude}, ${longitude}` : 'Konum seçilmedi'}
        </span>
        {includeFormFields ? (
          <>
            <input type="hidden" name="latitude" value={latitude} readOnly />
            <input type="hidden" name="longitude" value={longitude} readOnly />
          </>
        ) : null}
      </div>
    );
  },
}));

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

function selectAssetTab(tab: 'image' | 'video' | 'place' | 'link') {
  fireEvent.click(screen.getByTestId(`biz-asset-tab-${tab}`));
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

  it('opens a contain lightbox from compact cover-fit library image cards', async () => {
    render(
      <LibraryHarness
        initial={[makeAsset('img-open', { title: 'Atölye' })]}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('biz-asset-image-open-img-open')).toBeInTheDocument());
    expect(document.querySelector('.biz-asset-preview')).toBeTruthy();
    fireEvent.click(screen.getByTestId('biz-asset-image-open-img-open'));
    expect(screen.getByTestId('media-lightbox')).toBeInTheDocument();
    expect(screen.getByTestId('media-lightbox-image')).toHaveClass('object-contain');
    expect(screen.getByTestId('media-lightbox-image')).toHaveAttribute('src', 'blob:image');
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByTestId('media-lightbox')).not.toBeInTheDocument();
  });

  it('opens a contain video lightbox from library cards without cropping the preview', async () => {
    render(
      <LibraryHarness
        initial={[makeAsset('vid-open', { title: 'Atölye filmi', asset_type: 'video' })]}
      />,
    );
    selectAssetTab('video');
    await waitFor(() => expect(screen.getByTestId('biz-asset-video-open-vid-open')).toBeInTheDocument());
    const preview = screen.getByTestId('biz-video-vid-open');
    expect(preview).toHaveClass('biz-asset-preview');
    expect(preview.tagName).toBe('VIDEO');
    fireEvent.click(screen.getByTestId('biz-asset-video-open-vid-open'));
    expect(screen.getByTestId('media-lightbox-video')).toHaveClass('object-contain');
    expect(screen.getByTestId('media-lightbox-video')).toHaveAttribute('controls');
    expect(screen.getByTestId('media-lightbox-video')).toHaveAttribute('src', 'blob:video');
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByTestId('media-lightbox')).not.toBeInTheDocument();
  });

  it('uploads multiple videos privately without cover preparation UI on library cards', async () => {
    render(<LibraryHarness />);
    selectAssetTab('video');
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
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
    expect(screen.queryByTestId('biz-cover-prep-vid-one.mp4')).not.toBeInTheDocument();
    expect(screen.queryByText(/Kapak hazır/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Yüklenen video')).toHaveLength(2);
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
    selectAssetTab('video');
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
    selectAssetTab('video');
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

  it('creates a place from map selection with optional title', async () => {
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
    selectAssetTab('place');
    fireEvent.click(screen.getByRole('button', { name: 'Konum ekle' }));
    expect(screen.getByTestId('biz-place-picker')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-place-search-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(mocks.businessRequest).toHaveBeenCalled());
    const body = mocks.businessRequest.mock.calls[0][2] as {
      title: string;
      caption: string;
      publicAllowed: boolean;
      latitude: string;
      longitude: string;
    };
    expect(body.title).toBe('');
    expect(body.caption).toBe('Karaköy, İstanbul');
    expect(body.latitude).toBe('41.025000');
    expect(body.longitude).toBe('28.974000');
    expect(body.publicAllowed).toBe(false);
  });

  it('edits an existing place from + including moved coordinates and visibility', async () => {
    const asset = makeAsset('place-edit', {
      asset_type: 'place',
      title: 'Atölye',
      caption: 'Karaköy',
      latitude: '41.025000',
      longitude: '28.974000',
      public_allowed: false,
      revision: 2,
    });
    mocks.businessRequest.mockResolvedValue({
      ...asset,
      title: 'Yeni atölye',
      caption: 'Galata',
      latitude: '41.030000',
      longitude: '28.980000',
      public_allowed: true,
      revision: 3,
    });
    const onChanged = vi.fn(async () => undefined);
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[asset]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={onChanged}
      />,
    );
    selectAssetTab('place');
    fireEvent.click(screen.getByTestId('biz-asset-plus-place-edit'));
    expect(screen.getByTestId('biz-asset-meta-panel-place-edit')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-place-map-drag'));
    fireEvent.change(screen.getByLabelText('Kayıtlı içerik başlığı'), { target: { value: 'Yeni atölye' } });
    fireEvent.change(screen.getByLabelText('Adres veya yer tanımı'), { target: { value: 'Galata' } });
    fireEvent.click(screen.getByLabelText('Kullanıcılara gösterilmesine izin ver'));
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(mocks.businessRequest).toHaveBeenCalledWith(
        '/biz-1/assets/place-edit',
        'PATCH',
        expect.objectContaining({
          title: 'Yeni atölye',
          caption: 'Galata',
          latitude: '41.030000',
          longitude: '28.980000',
          publicAllowed: true,
          revision: 2,
        }),
      );
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows a Turkish sealed-media message when place coordinates cannot change', async () => {
    const asset = makeAsset('place-sealed', {
      asset_type: 'place',
      title: 'Atölye',
      caption: 'Karaköy',
      latitude: '41.025000',
      longitude: '28.974000',
      revision: 1,
    });
    mocks.businessRequest.mockRejectedValue(
      Object.assign(new Error('sealed_media_immutable'), { code: 'sealed_media_immutable' }),
    );
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[asset]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={vi.fn(async () => undefined)}
      />,
    );
    selectAssetTab('place');
    fireEvent.click(screen.getByTestId('biz-asset-plus-place-sealed'));
    fireEvent.click(screen.getByTestId('biz-place-map-drag'));
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Yansı taslağında veya yayımlanmış Yansıda/);
    });
  });

  it('opens the inline metadata editor from + without a Düzenle button', async () => {
    const asset = makeAsset('meta-1', { title: 'Atölye', caption: 'Giriş', revision: 2 });
    const knowledgeRow = { ...knowledge, id: 'kb-meta', title: 'Menü' };
    mocks.businessRequest
      .mockResolvedValueOnce({ ...asset, title: 'Yeni başlık', caption: 'Yeni açıklama', revision: 3 })
      .mockResolvedValueOnce({ ...asset, title: 'Yeni başlık', caption: 'Yeni açıklama', revision: 4 });
    const onChanged = vi.fn(async () => undefined);
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[asset]}
        knowledge={[knowledgeRow]}
        canEdit
        busy={false}
        onChanged={onChanged}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-asset-plus-meta-1'));
    expect(screen.getByTestId('biz-asset-meta-panel-meta-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Kayıtlı içerik başlığı')).toHaveValue('Atölye');
    expect(screen.getByLabelText('Kayıtlı içerik açıklaması')).toHaveValue('Giriş');
    fireEvent.change(screen.getByLabelText('Kayıtlı içerik başlığı'), { target: { value: 'Yeni başlık' } });
    fireEvent.change(screen.getByLabelText('Kayıtlı içerik açıklaması'), { target: { value: 'Yeni açıklama' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Menü' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(mocks.businessRequest).toHaveBeenCalledWith('/biz-1/assets/meta-1', 'PATCH', expect.objectContaining({
        title: 'Yeni başlık',
        caption: 'Yeni açıklama',
        revision: 2,
      }));
    });
    await waitFor(() => {
      expect(mocks.businessRequest).toHaveBeenCalledWith('/biz-1/assets/meta-1/links', 'POST', {
        knowledgeVersionIds: ['kb-meta'],
        revision: 3,
      });
    });
    expect(onChanged).toHaveBeenCalled();
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

  it('confirms permanent deletion and blocks duplicate requests while saving', async () => {
    const asset = makeAsset('del-1', { title: 'Film', asset_type: 'video', revision: 1 });
    let release!: () => void;
    mocks.businessRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ id: asset.id, deleted: true });
        }),
    );
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
    selectAssetTab('video');
    fireEvent.click(screen.getByTestId('biz-asset-delete-del-1'));
    expect(screen.getByTestId('biz-asset-delete-confirm-del-1')).toHaveTextContent(/kalıcı olarak silinecek/i);
    expect(mocks.businessRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('biz-asset-delete-confirm-submit-del-1'));
    fireEvent.click(screen.getByTestId('biz-asset-delete-confirm-submit-del-1'));
    await waitFor(() => expect(mocks.businessRequest).toHaveBeenCalledTimes(1));
    expect(mocks.businessRequest).toHaveBeenCalledWith('/biz-1/assets/del-1', 'DELETE', { revision: 1 });
    await act(async () => {
      release();
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows a Turkish message when deletion is blocked by Yansı usage', async () => {
    const asset = makeAsset('del-2', { title: 'Kapak', revision: 2 });
    mocks.businessRequest.mockRejectedValue(
      Object.assign(new Error('asset_in_use'), { code: 'asset_in_use', status: 409 }),
    );
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[asset]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('biz-asset-delete-del-2'));
    fireEvent.click(screen.getByTestId('biz-asset-delete-confirm-submit-del-2'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Yansı taslağında veya yayımlanmış Yansıda kullanılıyor/);
    });
    expect(screen.getByTestId('biz-asset-delete-confirm-del-2')).toBeInTheDocument();
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
    selectAssetTab('link');
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantı ekle' }));
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
    selectAssetTab('link');
    expect(screen.getByRole('heading', { name: 'example.com' })).toBeInTheDocument();
    expect(screen.getByTestId('biz-asset-plus-link-1')).toBeInTheDocument();
  });

  it('filters the library grid by the active content tab', async () => {
    render(
      <LibraryHarness
        initial={[
          makeAsset('img-1', { title: 'Görsel A' }),
          makeAsset('vid-1', { title: 'Video A', asset_type: 'video' }),
          makeAsset('place-1', { title: 'Konum A', asset_type: 'place', latitude: '41', longitude: '29' }),
          makeAsset('link-1', {
            title: 'Bağlantı A',
            asset_type: 'link',
            locator_kind: 'https',
            locator: 'https://example.com',
          }),
        ]}
      />,
    );
    expect(screen.getByTestId('biz-asset-tab-image')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('biz-asset-img-1')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-vid-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-place-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-link-1')).not.toBeInTheDocument();

    selectAssetTab('video');
    expect(screen.getByTestId('biz-asset-vid-1')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-img-1')).not.toBeInTheDocument();

    selectAssetTab('place');
    expect(screen.getByTestId('biz-asset-place-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konum ekle' })).toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-dropzone')).not.toBeInTheDocument();

    selectAssetTab('link');
    expect(screen.getByTestId('biz-asset-link-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bağlantı ekle' })).toBeInTheDocument();
    expect(screen.queryByTestId('biz-asset-vid-1')).not.toBeInTheDocument();
  });
});
