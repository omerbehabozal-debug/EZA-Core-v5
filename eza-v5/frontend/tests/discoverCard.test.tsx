import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import { SAINA_DISCOVER_OPEN_CTA } from '@/lib/eza/mirror-network/discoverCopy';

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
