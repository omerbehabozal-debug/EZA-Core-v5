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
  fetchCoverJob: vi.fn(),
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

function makeAsset(id: string, title = ''): BrandAsset {
  return {
    id,
    business_id: 'biz-1',
    asset_type: 'image',
    title,
    caption: '',
    locator_kind: 'storage',
    locator: null,
    latitude: null,
    longitude: null,
    public_allowed: false,
    status: 'published',
    revision: 1,
    links: [],
  };
}

const libraryStore: { rows: BrandAsset[] } = { rows: [] };

beforeEach(() => {
  libraryStore.rows = [];
  Object.values(mocks).forEach((fn) => fn.mockReset?.());
  mocks.fetchBrandAssetPreview.mockResolvedValue('blob:image');
  mocks.uploadBrandImage.mockImplementation(async (_biz, file: File, fields, onProgress?: (n: number) => void) => {
    onProgress?.(0.5);
    onProgress?.(1);
    const asset = makeAsset(`img-${file.name}`, fields?.title || '');
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

function LibraryHarness() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
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

describe('Business asset bulk image upload', () => {
  it('uploads multiple selected images privately without requiring a title', async () => {
    render(<LibraryHarness />);

    const files = [
      new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array([4, 5, 6])], 'b.webp', { type: 'image/webp' }),
    ];
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files } });

    await waitFor(() => {
      expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2);
    });
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
      expect(screen.getByText('Görsel 15 MB sınırını aşıyor.')).toBeInTheDocument();
    });
    expect(mocks.uploadBrandImage).not.toHaveBeenCalled();
  });

  it('shows three library cards after three async uploads without duplicating temp success cards', async () => {
    const deferred: Array<{ file: File; resolve: (asset: BrandAsset) => void }> = [];
    mocks.uploadBrandImage.mockImplementation(
      (_biz, file: File, _fields, onProgress?: (n: number) => void) =>
        new Promise<BrandAsset>((resolve) => {
          onProgress?.(0.2);
          deferred.push({
            file,
            resolve: (asset) => {
              onProgress?.(1);
              libraryStore.rows = [...libraryStore.rows.filter((row) => row.id !== asset.id), asset];
              resolve(asset);
            },
          });
        }),
    );

    render(<LibraryHarness />);

    const files = [
      new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }),
      new File([new Uint8Array([2])], 'two.png', { type: 'image/png' }),
      new File([new Uint8Array([3])], 'three.png', { type: 'image/png' }),
    ];
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files } });

    await waitFor(() => expect(deferred).toHaveLength(3));
    expect(screen.getByTestId('biz-asset-upload-grid')).toBeInTheDocument();
    expect(screen.queryByText('Başlıksız görsel')).not.toBeInTheDocument();

    await act(async () => {
      deferred.forEach((row, index) => row.resolve(makeAsset(`img-${index + 1}`)));
    });

    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-1')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-img-2')).toBeInTheDocument();
      expect(screen.getByTestId('biz-asset-img-3')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
    expect(screen.getAllByText('Başlıksız görsel')).toHaveLength(3);
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(3);
  });

  it('keeps failed uploads for retry and clears the temp card after a successful retry refetch', async () => {
    mocks.uploadBrandImage
      .mockRejectedValueOnce(new Error('asset_file_rejected'))
      .mockImplementation(async (_biz, file: File, fields, onProgress?: (n: number) => void) => {
        onProgress?.(1);
        const asset = makeAsset('img-retry', fields?.title || '');
        libraryStore.rows = [asset];
        return asset;
      });

    render(<LibraryHarness />);

    const file = new File([new Uint8Array([9])], 'retry.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Görsel PNG, JPEG veya WebP olmalı.')).toBeInTheDocument();
    });
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    await waitFor(() => expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-retry')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-asset-upload-grid')).not.toBeInTheDocument();
  });

  it('ignores a second drop of the same in-flight files', async () => {
    let release!: (asset: BrandAsset) => void;
    mocks.uploadBrandImage.mockImplementation(
      () =>
        new Promise<BrandAsset>((resolve) => {
          release = (asset) => {
            libraryStore.rows = [asset];
            resolve(asset);
          };
        }),
    );

    render(<LibraryHarness />);

    const file = new File([new Uint8Array([7])], 'same.png', { type: 'image/png', lastModified: 42 });
    const zone = screen.getByTestId('biz-asset-dropzone');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1));
    await act(async () => {
      release(makeAsset('img-same'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-same')).toBeInTheDocument();
    });
  });

  it('allows intentionally re-uploading the same file after the previous upload finishes', async () => {
    render(<LibraryHarness />);
    const file = new File([new Uint8Array([8])], 'again.png', { type: 'image/png', lastModified: 99 });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-again.png')).toBeInTheDocument();
    });
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1);

    mocks.uploadBrandImage.mockImplementation(async (_biz, nextFile: File, fields, onProgress?: (n: number) => void) => {
      onProgress?.(1);
      const asset = makeAsset('img-again-2', fields?.title || '');
      libraryStore.rows = [...libraryStore.rows, asset];
      return asset;
    });
    fireEvent.change(screen.getByTestId('biz-asset-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-img-again-2')).toBeInTheDocument();
    });
    expect(mocks.uploadBrandImage.mock.calls[1][2]).toEqual({
      title: '',
      caption: '',
      publicAllowed: false,
    });
  });
});
