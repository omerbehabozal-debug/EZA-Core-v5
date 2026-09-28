import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import { SAINA_DISCOVER_OPEN_CTA } from '@/lib/eza/mirror-network/discoverCopy';
import { parseDiscoverItem } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { resolvePublicAvatarGrapheme } from '@/lib/eza/mirror/publicIdentity';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('SainaDiscoverCard Phase 8.2', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('opens canonical public Yansı landing instead of starting sohbet', async () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'kyoto-journey',
          title: 'Kyoto Yolculuğu',
          description: 'Akşam ritmi ve yavaş keşif.',
          sceneImageUrl: 'https://cdn.example/kyoto.png',
          yansiCount: 2,
        }}
      />
    );

    expect(screen.getByText(SAINA_DISCOVER_OPEN_CTA)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('saina-discover-card-cta-kyoto-journey'));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/m/kyoto-journey');
    });
  });

  it('does not import startDiscoverGuestChat', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(src).not.toContain('startDiscoverGuestChat');
  });

  it('falls back to placeholder when image fails to load', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'broken-image',
          title: 'Broken',
          sceneImageUrl: 'https://cdn.example/missing.png',
          yansiCount: 0,
        }}
      />
    );

    const img = screen.getByTestId('saina-discover-card-image');
    fireEvent.error(img);
    expect(screen.getByTestId('saina-discover-card-placeholder')).toBeInTheDocument();
  });
});

describe('Phase 6.2 feed N+1 audit', () => {
  it('Discover and profile grids do not import Phase 6.1 /metrics fetch', () => {
    const discover = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    const profile = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AynaJourneySlide.tsx'),
      'utf8'
    );
    const authorGrid = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchAuthorPublished.ts'),
      'utf8'
    );
    const discoverList = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchDiscoverMirrors.ts'),
      'utf8'
    );
    for (const src of [discover, profile, authorGrid, discoverList]) {
      expect(src).not.toContain('fetchYansiPublicMetrics');
      expect(src).not.toContain("'/metrics'");
      expect(src).not.toContain('"/metrics"');
    }
  });
});

const AVATAR_URL =
  '/api/public/profile-avatars/11111111-1111-4111-8111-111111111111.jpg';

describe('Discover public creator avatar', () => {
  it('mapper accepts publicAvatarUrl and revision, ignores userId/email', () => {
    const parsed = parseDiscoverItem({
      slug: 'kisilik-ve-degisim',
      title: 'Kişilik ve Değişim',
      sceneImageUrl: 'https://cdn.example/scene.png',
      yansiCount: 0,
      authorDisplayName: 'Tarık Ayşe',
      publicHonorific: 'curious',
      publicAvatarUrl: AVATAR_URL,
      publicAvatarRevision: 4,
      userId: 'should-not-copy',
      email: 'hidden@example.com',
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.authorDisplayName).toBe('Tarık Ayşe');
    expect(parsed?.publicHonorific).toBe('curious');
    expect(parsed?.publicAvatarUrl).toBe(AVATAR_URL);
    expect(parsed?.publicAvatarRevision).toBe(4);
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('email');
  });

  it('mapper normalizes missing avatar to null', () => {
    const parsed = parseDiscoverItem({
      slug: 'no-photo',
      title: 'No Photo',
      sceneImageUrl: null,
      yansiCount: 0,
      authorDisplayName: 'Tarık Ayşe',
      publicAvatarUrl: '   ',
      publicAvatarRevision: 'nope',
    });
    expect(parsed?.publicAvatarUrl).toBeNull();
    expect(parsed?.publicAvatarRevision).toBeNull();
  });

  it('renders photo avatar when publicAvatarUrl is present', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'kisilik-ve-degisim',
          title: 'Kişilik ve Değişim',
          sceneImageUrl: 'https://cdn.example/scene.png',
          yansiCount: 0,
          authorDisplayName: 'Tarık Ayşe',
          publicHonorific: 'curious',
          publicAvatarUrl: AVATAR_URL,
          publicAvatarRevision: 4,
        }}
      />
    );
    const photo = screen.getByTestId('bilign-profile-avatar-photo');
    expect(photo).toBeInTheDocument();
    expect(photo.getAttribute('src') || '').toContain(AVATAR_URL);
    expect(photo.getAttribute('src') || '').toContain('v=4');
    expect(screen.getByTestId('saina-discover-card-identity-kisilik-ve-degisim')).toHaveTextContent(
      'Tarık Ayşe'
    );
    expect(screen.getByTestId('bilign-honorific')).toHaveTextContent('Meraklı');
  });

  it('renders first-grapheme fallback when publicAvatarUrl is missing', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'no-avatar',
          title: 'No Avatar',
          sceneImageUrl: 'https://cdn.example/scene.png',
          yansiCount: 0,
          authorDisplayName: 'Tarık Ayşe',
          publicHonorific: 'bilgin',
        }}
      />
    );
    expect(screen.queryByTestId('bilign-profile-avatar-photo')).not.toBeInTheDocument();
    expect(screen.getByTestId('bilign-profile-avatar')).toHaveTextContent(
      resolvePublicAvatarGrapheme('Tarık Ayşe')
    );
    expect(screen.getByTestId('saina-discover-card-identity-no-avatar')).toHaveTextContent(
      'Tarık Ayşe'
    );
    expect(screen.getByTestId('bilign-honorific')).toHaveTextContent('Bilgin');
  });

  it('falls back to grapheme when the photo fails to load', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'broken-avatar',
          title: 'Broken Avatar',
          sceneImageUrl: 'https://cdn.example/scene.png',
          yansiCount: 0,
          authorDisplayName: 'Tarık Ayşe',
          publicHonorific: 'curious',
          publicAvatarUrl: AVATAR_URL,
          publicAvatarRevision: 1,
        }}
      />
    );
    fireEvent.error(screen.getByTestId('bilign-profile-avatar-photo'));
    expect(screen.queryByTestId('bilign-profile-avatar-photo')).not.toBeInTheDocument();
    expect(screen.getByTestId('bilign-profile-avatar')).toHaveTextContent(
      resolvePublicAvatarGrapheme('Tarık Ayşe')
    );
  });

  it('does not require userId on the Discover card', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(src).toContain('ProfileUserAvatar');
    expect(src).not.toContain('userId=');
    expect(src).not.toContain('userId');
  });
});
