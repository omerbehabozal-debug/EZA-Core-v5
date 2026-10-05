import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import {
  SAINA_DISCOVER_MODE_NEWEST,
  SAINA_DISCOVER_MODE_RASTLANTISAL,
  SAINA_DISCOVER_MODE_STRONG_CURIOSITY,
  SAINA_DISCOVER_OPEN_CTA,
  SAINA_DISCOVER_OPEN_CTA_SHORT,
} from '@/lib/eza/mirror-network/discoverCopy';
import { DISCOVER_MODE_LABELS } from '@/lib/eza/mirror-network/discoverModes';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';
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
      visibleVerificationCount: 2,
      contentVisibleCount: 4,
      userId: 'should-not-copy',
      email: 'hidden@example.com',
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.authorDisplayName).toBe('Tarık Ayşe');
    expect(parsed?.publicHonorific).toBe('curious');
    expect(parsed?.publicAvatarUrl).toBe(AVATAR_URL);
    expect(parsed?.publicAvatarRevision).toBe(4);
    expect(parsed?.visibleVerificationCount).toBe(2);
    expect(parsed?.contentVisibleCount).toBe(4);
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

describe('Discover editorial feed presentation', () => {
  const SCENE = 'https://cdn.example/editorial-scene.png';
  const TITLE = 'Editorial Yansı Title';
  const SUMMARY = 'Canonical curiosity trailer that must not be rewritten.';

  it('renders exact canonical scene, title, and summary', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'editorial-yansi',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          yansiCount: 1,
          experienceStartedCount: 1,
          authorDisplayName: 'Creator',
          publicHonorific: 'curious',
        }}
      />
    );
    expect(screen.getByTestId('saina-discover-card-image').getAttribute('src')).toBe(SCENE);
    expect(screen.getByTestId('saina-discover-card-title-editorial-yansi').textContent).toBe(TITLE);
    expect(screen.getByTestId('saina-discover-card-summary-editorial-yansi').textContent).toBe(
      SUMMARY
    );
  });

  it('renders read-only Discover social metrics without counting verify as katkı', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'social-yansi',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          yansiCount: 9,
          experienceStartedCount: 3,
          directChildYansiCount: 5,
          visibleVerificationCount: 2,
          contentVisibleCount: 4,
          authorDisplayName: 'Creator',
          publicHonorific: 'curious',
        }}
      />
    );

    const metrics = screen.getByTestId('yansi-public-metrics');
    expect(metrics).toHaveTextContent('3 deneyim · 2 doğrulama · 4 katkı');
    expect(metrics).toHaveAttribute('aria-label', '3 deneyim, 2 doğrulama, 4 katkı');
    expect(metrics.closest('a,button')).toBeNull();
    expect(metrics).not.toHaveTextContent('5 Yansı');
    expect(screen.getByTestId('saina-discover-card-cta-social-yansi')).toBeInTheDocument();
  });

  it('keeps zero verification and zero contribution visible in Discover metrics', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'zero-social-yansi',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          yansiCount: 0,
          experienceStartedCount: 3,
          directChildYansiCount: 0,
          visibleVerificationCount: 0,
          contentVisibleCount: 0,
        }}
      />
    );

    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '3 deneyim · 0 doğrulama · 0 katkı'
    );
  });

  it('keeps exact slug + journeyVersion navigation', async () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'exact-slug',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          yansiCount: 0,
          journeyVersion: 3,
        }}
      />
    );
    fireEvent.click(screen.getByTestId('saina-discover-card-cta-exact-slug'));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/m/exact-slug?journeyVersion=3');
    });
  });

  it('applies Discover-scoped editorial modifier and keeps CTA semantics', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'editorial-yansi',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          yansiCount: 0,
        }}
      />
    );
    const card = screen.getByTestId('saina-discover-card-editorial-yansi');
    expect(card.className).toContain('saina-discover-card--editorial');
    expect(screen.getByText(SAINA_DISCOVER_OPEN_CTA)).toBeInTheDocument();
    expect(screen.getByText(SAINA_DISCOVER_OPEN_CTA_SHORT)).toBeInTheDocument();
  });

  it('gates horizontal row layout to desktop editorial width; mobile stays stacked', () => {
    expect(SAINA_COMPACT_SHELL_MIN_PX).toBe(900);
    const css = readFileSync(join(process.cwd(), 'styles/saina-mirror.css'), 'utf8');
    const defaultCard = css.match(/\.saina-discover-card \{[^}]+\}/);
    expect(defaultCard?.[0]).not.toContain('flex-direction: row');
    expect(css).toMatch(
      /@media \(min-width: 900px\) \{[\s\S]*?\.saina-discover-card\.saina-discover-card--editorial \{[\s\S]*?flex-direction:\s*row/
    );
    expect(css).toMatch(
      /\.saina-discover-list \{[\s\S]*?flex-direction:\s*column/
    );
    const editorialBlock = css.slice(css.indexOf('@media (min-width: 900px)'));
    expect(editorialBlock).toContain('-webkit-line-clamp: 3');
    expect(editorialBlock).toContain('width: 37%');
    expect(editorialBlock).toContain('flex: 1 1 63%');
  });

  it('does not introduce continuation-neighbor requests into Discover', () => {
    const files = [
      'components/saina/SainaDiscoverCard.tsx',
      'components/saina/SainaDiscoverList.tsx',
      'components/saina/SainaDiscoverPage.tsx',
      'lib/eza/mirror-network/fetchDiscoverMirrors.ts',
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src).not.toContain('fetchContinuationNeighbors');
      expect(src).not.toContain('continuation-neighbors');
    }
  });

  it('preserves individual-Yansı filter semantics', () => {
    expect(DISCOVER_MODE_LABELS.random).toBe(SAINA_DISCOVER_MODE_RASTLANTISAL);
    expect(DISCOVER_MODE_LABELS.strong_curiosity).toBe(SAINA_DISCOVER_MODE_STRONG_CURIOSITY);
    expect(DISCOVER_MODE_LABELS.newest).toBe(SAINA_DISCOVER_MODE_NEWEST);
    const cardSrc = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(cardSrc).not.toContain('fetchContinuationNeighbors');
    expect(cardSrc).not.toContain('DISCOVER_MODES');
  });
});
