import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import { SAINA_DISCOVER_CTA } from '@/lib/eza/mirror-network/discoverCopy';

const push = vi.fn();
const startDiscoverGuestChatFromSlug = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/eza/mirror-network/startDiscoverGuestChat', () => ({
  startDiscoverGuestChatFromSlug: (...args: unknown[]) => startDiscoverGuestChatFromSlug(...args),
}));

describe('SainaDiscoverCard', () => {
  beforeEach(() => {
    push.mockReset();
    startDiscoverGuestChatFromSlug.mockReset();
  });

  it('renders square landing body with title, summary, and CTA into chat', async () => {
    startDiscoverGuestChatFromSlug.mockResolvedValue({
      ok: true,
      chatId: 'chat-1',
      href: '/standalone?chat=chat-1&mirrorReply=1',
    });

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

    expect(screen.getByText('Kyoto Yolculuğu')).toBeInTheDocument();
    expect(screen.getByText('Akşam ritmi ve yavaş keşif.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SAINA_DISCOVER_CTA })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('saina-discover-card-cta-kyoto-journey'));

    await waitFor(() => {
      expect(startDiscoverGuestChatFromSlug).toHaveBeenCalledWith(
        'kyoto-journey',
        SAINA_DISCOVER_CTA,
        'Kyoto Yolculuğu'
      );
      expect(push).toHaveBeenCalledWith('/standalone?chat=chat-1&mirrorReply=1');
    });
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

  it('Phase 6.2.1: legacy yansiCount alone does not render a deneyim row', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'kyoto-journey',
          title: 'Kyoto Yolculuğu',
          sceneImageUrl: 'https://cdn.example/kyoto.png',
          yansiCount: 2,
        }}
      />
    );
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText('2 Yansı')).toBeNull();
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
