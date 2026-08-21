import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import { resolvePublicHonorificLabel } from '@/lib/eza/mirror/publicHonorific';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.8F public honorific surfaces', () => {
  it('maps canonical ids to public labels', () => {
    expect(resolvePublicHonorificLabel(null)).toBe('Meraklı');
    expect(resolvePublicHonorificLabel('curious')).toBe('Meraklı');
    expect(resolvePublicHonorificLabel('bilgin')).toBe('Bilgin');
  });

  it('Discover shows Meraklı without plan, email, role, or score', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'mardin-stones',
          title: 'Taşların sessizliği',
          description: 'Mardin meramı.',
          sceneImageUrl: 'https://cdn.example/mardin.png',
          yansiCount: 0,
          authorDisplayName: 'Mert Karaca',
          publicHonorific: 'curious',
        }}
      />
    );
    expect(screen.getByTestId('saina-discover-card-identity-mardin-stones')).toHaveTextContent(
      'Mert Karaca'
    );
    expect(screen.getByTestId('bilign-honorific')).toHaveTextContent('Meraklı');
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
    expect(screen.queryByText('Mini')).not.toBeInTheDocument();
    expect(screen.queryByText('Standard')).not.toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('Discover shows Bilgin for assigned honorific', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'bilgin-yansi',
          title: 'Açık merak',
          sceneImageUrl: null,
          yansiCount: 0,
          authorDisplayName: 'Ada Lovelace',
          publicHonorific: 'bilgin',
        }}
      />
    );
    expect(screen.getByTestId('bilign-honorific')).toHaveTextContent('Bilgin');
    expect(screen.getByTestId('bilign-honorific')).toHaveAttribute('data-honorific', 'bilgin');
  });

  it('public Yansı author row shows honorific beside the name', () => {
    render(
      <AynaAuthorRow displayName="Mert Karaca" honorific="bilgin" />
    );
    expect(screen.getByTestId('ayna-author-row')).toHaveTextContent('Mert Karaca');
    expect(screen.getByTestId('bilign-honorific')).toHaveTextContent('Bilgin');
  });

  it('guest Yansı identity has Misafir and no honorific', () => {
    render(<SainaHeroScene title="Yeni Sohbet" displayName="Misafir" honorificLabel={null} />);
    expect(screen.getByTestId('saina-yansi-identity-name')).toHaveTextContent('Misafir');
    expect(screen.queryByTestId('saina-yansi-identity-honorific')).not.toBeInTheDocument();
    expect(screen.queryByText('Meraklı')).not.toBeInTheDocument();
    expect(screen.queryByText('Bilgin')).not.toBeInTheDocument();
  });

  it('keeps Discover full-screen vertical structure and Journey Ayna row optional', () => {
    const discoverPage = read('components/saina/SainaDiscoverPage.tsx');
    const discoverCss = read('styles/saina-mirror.css');
    const aynaSlide = read('components/mirror/ayna/AynaJourneySlide.tsx');
    const modes = read('lib/eza/mirror-network/discoverModes.ts');
    const scLive = readFileSync(
      join(root, '..', 'backend', 'services', 'mirror_network', 'yansi_strong_curiosity_live.py'),
      'utf8'
    );
    expect(discoverPage).toContain('saina-discover-content-scroll');
    expect(discoverCss).toContain('scroll-snap-type: y mandatory');
    expect(aynaSlide).not.toContain('HonorificMarker');
    expect(modes).not.toContain('publicHonorific');
    expect(scLive).not.toContain('public_honorific');
    expect(scLive).not.toContain('publicHonorific');
  });
});
