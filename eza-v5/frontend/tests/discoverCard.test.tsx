import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import { SAINA_DISCOVER_CTA } from '@/lib/eza/mirror-network/discoverCopy';

describe('SainaDiscoverCard', () => {
  it('renders CTA linking to guest sohbet route', () => {
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

    const cta = screen.getByRole('link', { name: SAINA_DISCOVER_CTA });
    expect(cta).toHaveAttribute('href', '/m/kyoto-journey/sohbet');
    expect(screen.getByText('Kyoto Yolculuğu')).toBeInTheDocument();
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
