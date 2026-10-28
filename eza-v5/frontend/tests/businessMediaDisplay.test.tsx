import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import { BusinessAnswerBody } from '@/components/mirror-landing/BusinessMediaBlocks';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { fromArchivedMessages } from '@/lib/standaloneChatSession';
import { parseBusinessMedia, parseBusinessMediaBlocks } from '@/lib/eza/mirror/journey/businessMedia';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';

const brand = '11111111-1111-4111-8111-111111111111';
const image = '22222222-2222-4222-8222-222222222222';
const video = '33333333-3333-4333-8333-333333333333';
const place = '44444444-4444-4444-8444-444444444444';
const link = '55555555-5555-4555-8555-555555555555';

function artifact(withMedia: boolean) {
  return parsePublicFrozenJourneyArtifact({
    slug: 'seramik', journeyId: 'seramik', journeyVersion: 1, selectedCount: 6, authorUserId: 'publisher', replayReady: true,
    sceneImageUrl: 'https://cdn.example/scene.jpg',
    steps: Array.from({ length: 6 }, (_, index) => ({ stepIndex: index + 1, publicQuestion: `Soru ${index + 1}?`, publicAnswer: `Cevap ${index + 1}.` })),
    ...(withMedia ? { businessMedia: {
      cover: { type: 'image', assetId: image, title: 'Kapak', contentPath: `/api/business-yansi/public-media/${brand}/${image}` },
      steps: [[
        { type: 'image', assetId: image, title: 'Atolye', contentPath: `/api/business-yansi/public-media/${brand}/${image}`, locator: 'brand-assets/secret.png' },
        { type: 'video', assetId: video, title: 'Film', href: 'https://cdn.bilign.example/seramik.mp4' },
        { type: 'map', assetId: place, title: 'Atolye', caption: 'Kadikoy', latitude: '40.99', longitude: '29.02' },
        { type: 'link', assetId: link, title: 'Site', caption: '', href: 'http://bilign.example/seramik' },
      ], [], [], [], [], []],
    } } : {}),
  })!;
}

beforeEach(() => clearAllFrozenReplayProgressForTests());

describe('business media display', () => {
  it('drops storage keys and non-https addresses before display', () => {
    expect(parseBusinessMediaBlocks([{ type: 'image', assetId: image, title: 'Gizli', contentPath: 'brand-assets/secret.png' }])).toEqual([]);
    expect(parseBusinessMediaBlocks([{ type: 'link', assetId: link, title: 'Site', href: 'http://bilign.example/seramik' }])).toEqual([]);
    const parsed = parseBusinessMedia(artifact(true).businessMedia);
    expect(parsed?.steps[0].map((block) => block.type)).toEqual(['video', 'map']);
    expect(JSON.stringify(parsed)).not.toContain('brand-assets');
  });

  it.each(['mobile', 'desktop'] as const)('shows authorized step media on %s without taking the navigation gesture', async (layout) => {
    const source = artifact(true);
    const seen = vi.fn();
    render(<div onPointerDown={seen}><MirrorFrozenReplay artifact={source} desktopIdentity={layout === 'desktop' ? {
      title: 'Seramik', displayName: 'BiligN', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null,
    } : undefined} /></div>);
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(screen.getByText('Cevap 1.')).toBeInTheDocument());
    const player = screen.getByTestId('business-media-video');
    expect(player).toHaveAttribute('controls');
    expect(player.hasAttribute('autoplay')).toBe(false);
    expect(screen.getByTestId('business-media-map').tagName).toBe('A');
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByTestId('business-media-blocks')).toHaveAttribute('data-layout', layout);
    fireEvent.pointerDown(screen.getByTestId('business-media-map'));
    expect(seen).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('brand-assets');
  });

  it('keeps a text Yansı and a personal scene on the existing layout', () => {
    const text = artifact(false);
    expect(text.businessMedia).toBeUndefined();
    expect(text.steps[0]).toEqual({ stepIndex: 1, publicQuestion: 'Soru 1?', publicAnswer: 'Cevap 1.' });
    const { rerender } = render(<MirrorYansiSceneCrossfade sceneImageUrl={text.sceneImageUrl} presentation="mobile-fullscreen" />);
    expect(screen.getByTestId('mirror-yansi-scene-current').className).toContain('object-cover');
    rerender(<MirrorYansiSceneCrossfade sceneImageUrl="https://cdn.example/brand.jpg" presentation="desktop-immersive" brandCover />);
    expect(screen.getByTestId('mirror-yansi-scene-current').className).toContain('object-contain');
    expect(screen.getByTestId('mirror-yansi-scene-crossfade')).toHaveAttribute('data-yansi-brand-cover', 'true');
  });

  it('restores the same chat media when the saved conversation opens again', () => {
    const saved = fromArchivedMessages([
      { id: 'a1', text: 'Seramik atolyesi aciktir.', isUser: false, timestamp: '2026-10-28T10:00:00.000Z', businessMedia: [{
        type: 'image', assetId: image, title: 'Atolye', contentPath: `/api/business-yansi/public-media/${brand}/${image}`,
      }, { type: 'link', assetId: link, title: 'Gizli', href: 'http://bilign.example/seramik' }] },
      { id: 'u1', text: 'Tesekkurler', isUser: true, timestamp: '2026-10-28T10:01:00.000Z' },
      { id: 'old', text: 'Eski metin cevap.', isUser: false, timestamp: '2026-10-28T10:02:00.000Z' },
    ]);
    expect(saved.map((message) => message.text)).toEqual(['Seramik atolyesi aciktir.', 'Tesekkurler', 'Eski metin cevap.']);
    expect(saved[0].businessMedia?.map((block) => block.type)).toEqual(['image']);
    expect(saved[1].businessMedia).toBeUndefined();
    expect(saved[2].businessMedia).toBeUndefined();
    render(<BusinessAnswerBody text={saved[0].text} blocks={saved[0].businessMedia} layout="mobile" />);
    expect(screen.getByTestId('business-media-image')).toHaveAttribute('src', expect.stringContaining(`/api/business-yansi/public-media/${brand}/${image}`));
    expect(screen.queryByTestId('business-media-link')).toBeNull();
  });

  it('places chat media beside the answer text', () => {
    render(<BusinessAnswerBody text="Seramik atolyesi aciktir." layout="desktop" blocks={[{
      type: 'image', assetId: image, title: 'Atolye', contentPath: `/api/business-yansi/public-media/${brand}/${image}`,
    }]} />);
    expect(screen.getByText('Seramik atolyesi aciktir.')).toBeInTheDocument();
    expect(screen.getByTestId('business-media-image')).toHaveClass('object-contain');
    expect(screen.getByTestId('business-media-image').getAttribute('src')).not.toContain('brand-assets');
  });
});
