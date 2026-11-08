import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessAssetLibrary from '@/components/saina/business-studio/BusinessAssetLibrary';
import MediaLightbox from '@/components/media/MediaLightbox';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';

const mocks = vi.hoisted(() => ({
  businessRequest: vi.fn(),
  uploadBrandImage: vi.fn(),
  uploadBrandVideo: vi.fn(),
  replaceBrandImage: vi.fn(),
  fetchBrandAssetPreview: vi.fn(async () => 'blob:image'),
  fetchBrandVideoPreview: vi.fn(async () => 'blob:library-video'),
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

function makeVideo(id: string, title: string, overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id,
    business_id: 'biz-1',
    asset_type: 'video',
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
    ...overrides,
  };
}

const css = readFileSync(
  path.join(process.cwd(), 'styles/saina-business.css'),
  'utf8',
);

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset?.());
  mocks.fetchBrandAssetPreview.mockResolvedValue('blob:image');
  mocks.fetchBrandVideoPreview.mockResolvedValue('blob:library-video');
});

describe('Content Library video aspect preservation', () => {
  it('keeps card images cover-fit while video previews use contain letterboxing', () => {
    expect(css).toMatch(/\.biz-asset-preview\s*\{[^}]*object-fit:\s*cover/s);
    expect(css).toMatch(/video\.biz-asset-preview[\s\S]*object-fit:\s*contain/);
    expect(css).toMatch(/video\.biz-asset-preview[\s\S]*background:\s*#0c0b0a/);
  });

  it.each([
    ['portrait', 'vid-portrait', 'Dikey film'],
    ['landscape', 'vid-landscape', 'Yatay film'],
    ['square', 'vid-square', 'Kare film'],
  ] as const)('opens an uncropped enlarged player for %s library videos', async (_shape, id, title) => {
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[makeVideo(id, title)]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId(`biz-video-${id}`)).toBeInTheDocument());
    const preview = screen.getByTestId(`biz-video-${id}`);
    expect(preview.tagName).toBe('VIDEO');
    expect(preview).toHaveClass('biz-asset-preview');
    expect(preview).not.toHaveAttribute('controls');

    fireEvent.click(screen.getByTestId(`biz-asset-video-open-${id}`));
    expect(screen.getByTestId('media-lightbox')).toBeInTheDocument();
    expect(screen.getByTestId('media-lightbox-video-shell')).toBeInTheDocument();
    const player = screen.getByTestId('media-lightbox-video');
    expect(player).toHaveClass('object-contain');
    expect(player).toHaveAttribute('controls');
    expect(player).toHaveAttribute('src', 'blob:library-video');
    expect(player).toHaveProperty('playsInline', true);
    expect(screen.queryByTestId('media-lightbox-image')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByTestId('media-lightbox')).not.toBeInTheDocument();
  });

  it('fits enlarged video inside the viewport shell without cover cropping', () => {
    render(
      <MediaLightbox open src="https://cdn.bilign.example/clip.mp4" kind="video" alt="Atölye" onClose={vi.fn()} />,
    );
    const shell = screen.getByTestId('media-lightbox-video-shell');
    const player = screen.getByTestId('media-lightbox-video');
    expect(shell.className).toMatch(/max-h-\[min\(92vh,1200px\)\]/);
    expect(shell.className).toMatch(/max-w-\[min\(92vw,1200px\)\]/);
    expect(player).toHaveClass('object-contain');
    expect(player).toHaveAttribute('controls');
    expect(player.className).not.toMatch(/object-cover/);
  });

  it('leaves image lightbox behavior unchanged', async () => {
    const image: BrandAsset = {
      ...makeVideo('img-1', 'Atölye'),
      asset_type: 'image',
      title: 'Atölye',
    };
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[image]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('biz-asset-image-open-img-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('biz-asset-image-open-img-1'));
    expect(screen.getByTestId('media-lightbox-image')).toHaveClass('object-contain');
    expect(screen.queryByTestId('media-lightbox-video')).not.toBeInTheDocument();
  });

  it('still shows one contain-fit https video that opens enlarged playback', async () => {
    const remote = makeVideo('vid-https', 'HTTPS film', {
      locator_kind: 'https',
      locator: 'https://cdn.bilign.example/remote.mp4',
    });
    await act(async () => {
      render(
        <BusinessAssetLibrary
          businessId="biz-1"
          assets={[remote]}
          knowledge={[knowledge]}
          canEdit
          busy={false}
          onChanged={vi.fn()}
        />,
      );
    });
    expect(mocks.fetchBrandVideoPreview).not.toHaveBeenCalled();
    const preview = screen.getByTestId('biz-video-vid-https');
    expect(preview).toHaveClass('biz-asset-preview');
    expect(preview).toHaveAttribute('src', 'https://cdn.bilign.example/remote.mp4');
    fireEvent.click(screen.getByTestId('biz-asset-video-open-vid-https'));
    expect(screen.getByTestId('media-lightbox-video')).toHaveAttribute(
      'src',
      'https://cdn.bilign.example/remote.mp4',
    );
    expect(screen.getByTestId('media-lightbox-video')).toHaveClass('object-contain');
  });
});
