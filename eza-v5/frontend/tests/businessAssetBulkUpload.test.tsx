import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const saved: BrandAsset = {
  id: 'img-1',
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
};

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset?.());
  mocks.fetchBrandAssetPreview.mockResolvedValue('blob:image');
  mocks.uploadBrandImage.mockImplementation(async (_biz, _file, fields, onProgress?: (n: number) => void) => {
    onProgress?.(0.5);
    onProgress?.(1);
    return { ...saved, title: fields?.title || '' };
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

describe('Business asset bulk image upload', () => {
  it('uploads multiple selected images privately without requiring a title', async () => {
    const onChanged = vi.fn(async () => undefined);
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={onChanged}
      />,
    );

    const input = screen.getByTestId('biz-asset-file-input');
    const files = [
      new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array([4, 5, 6])], 'b.webp', { type: 'image/webp' }),
    ];
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(2);
    });
    expect(mocks.uploadBrandImage.mock.calls[0][2]).toEqual({
      title: '',
      caption: '',
      publicAllowed: false,
    });
    await waitFor(() => {
      expect(screen.getByTestId('biz-asset-upload-grid').textContent).toContain('Yüklendi');
    });
    expect(onChanged).toHaveBeenCalled();
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
});
