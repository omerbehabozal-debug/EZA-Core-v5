import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import YansiDesktopReelSurface from '@/components/mirror-landing/YansiDesktopReelSurface';
import { parseBusinessMedia } from '@/lib/eza/mirror/journey/businessMedia';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const brand = '11111111-1111-4111-8111-111111111111';
const image = '22222222-2222-4222-8222-222222222222';
const video = '33333333-3333-4333-8333-333333333333';
const scene = 'https://cdn.example/scene.jpg';
const film = 'https://cdn.bilign.example/atolye.mp4';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

function artifact(cover?: Record<string, string>) {
  return parsePublicFrozenJourneyArtifact({
    slug: 'atolye',
    journeyId: 'atolye',
    journeyVersion: 1,
    selectedCount: 6,
    authorUserId: 'publisher',
    replayReady: true,
    publicTitle: 'Atolye',
    publicSummary: 'Atolye ozeti',
    sceneImageUrl: scene,
    steps: Array.from({ length: 6 }, (_, index) => ({
      stepIndex: index + 1,
      publicQuestion: `Soru ${index + 1}?`,
      publicAnswer: `Cevap ${index + 1}.`,
    })),
    ...(cover ? { businessMedia: { cover, steps: [] } } : {}),
  })!;
}

function node(cover?: Record<string, string>) {
  return {
    artifact: artifact(cover),
    authorDisplayName: 'BiligN',
    authorHonorific: '',
    authorAvatarUrl: null,
    authorAvatarRevision: null,
    parentAuthorDisplayName: null,
    parentPublicTitle: null,
  };
}

const imageCover = {
  type: 'image',
  assetId: image,
  title: 'Kapak',
  contentPath: `/api/business-yansi/public-media/${brand}/${image}`,
};
const videoCover = { type: 'video', assetId: video, title: 'Atolye filmi', href: film };

describe('business video cover', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('keeps an image cover on the existing still', () => {
    render(<YansiDesktopReelSurface node={node(imageCover)} role="current" />);
    const still = screen.getByTestId('mirror-yansi-scene-current');
    expect(still).toHaveAttribute('src', expect.stringContaining(imageCover.contentPath));
    expect(still).toHaveAttribute('data-yansi-brand-cover', 'true');
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
  });

  it('plays a muted looping video only on the active card', async () => {
    render(<YansiDesktopReelSurface node={node(videoCover)} role="current" />);
    const player = screen.getByTestId('yansi-cover-video');
    expect(player).toHaveAttribute('src', film);
    expect(player).toHaveProperty('muted', true);
    expect(player).toHaveProperty('loop', true);
    expect(player).toHaveProperty('playsInline', true);
    expect(player.className).toContain('pointer-events-none');
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(screen.getByTestId('yansi-desktop-detail-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('yansi-desktop-canonical-summary')).toHaveTextContent('Atolye ozeti');
    expect(screen.getByTestId('yansi-reel-experience-invite')).toHaveTextContent('Deneyime Başla');
  });

  it('does not load a video on a passive card', () => {
    render(<YansiDesktopReelSurface node={node(videoCover)} role="incoming" />);
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-incoming-image')).toHaveAttribute('src', scene);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('stops the previous video when the card leaves', () => {
    const { rerender } = render(<YansiDesktopReelSurface node={node(videoCover)} role="current" />);
    expect(screen.getByTestId('yansi-cover-video')).toBeInTheDocument();
    rerender(<YansiDesktopReelSurface node={node(videoCover)} role="outgoing" />);
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
  });

  it('falls back to the scene still when the video errors', () => {
    render(<YansiDesktopReelSurface node={node(videoCover)} role="current" />);
    fireEvent.error(screen.getByTestId('yansi-cover-video'));
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
  });

  it('falls back to the scene still when autoplay is blocked', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    render(<YansiDesktopReelSurface node={node(videoCover)} role="current" />);
    await waitFor(() => expect(screen.queryByTestId('yansi-cover-video')).toBeNull());
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
  });

  it('leaves a personal Yansı on its scene image', () => {
    render(<YansiDesktopReelSurface node={node()} role="current" />);
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('data-yansi-brand-cover', 'false');
  });

  it('drops an unsafe video cover and keeps an authorized one', () => {
    expect(parseBusinessMedia({ cover: { ...videoCover, href: 'http://cdn.bilign.example/atolye.mp4' }, steps: [] })).toBeUndefined();
    expect(parseBusinessMedia({ cover: videoCover, steps: [] })?.cover).toEqual(videoCover);
    expect(parseBusinessMedia({ cover: imageCover, steps: [] })?.cover).toEqual(imageCover);
  });

  it('stops the mobile cover video when the active scene changes', () => {
    const { rerender } = render(
      <MirrorYansiSceneCrossfade sceneImageUrl={scene} videoSrc={film} presentation="mobile-fullscreen" activeIdentity="atolye" />,
    );
    expect(screen.getByTestId('yansi-cover-video')).toHaveAttribute('src', film);
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
    rerender(<MirrorYansiSceneCrossfade sceneImageUrl={scene} videoSrc={null} presentation="mobile-fullscreen" activeIdentity="atolye" />);
    expect(screen.queryByTestId('yansi-cover-video')).toBeNull();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute('src', scene);
  });
});
