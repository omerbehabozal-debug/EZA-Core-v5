import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import {
  resolvePublicHonorificId,
  resolvePublicHonorificLabel,
} from '@/lib/eza/mirror/publicHonorific';
import {
  resolveYansiCreatorDisplayName,
  resolveYansiCreatorHonorific,
} from '@/lib/eza/mirror/yansiCreatorIdentity';

describe('Yansı creator identity resolvers', () => {
  it('defaults authenticated users to Meraklı, independent of plan-like strings', () => {
    expect(resolvePublicHonorificId(null)).toBe('curious');
    expect(resolvePublicHonorificLabel('premium')).toBe('Meraklı');
    expect(resolvePublicHonorificLabel('user')).toBe('Meraklı');
    expect(resolvePublicHonorificLabel('bilgin')).toBe('Bilgin');
  });

  it('hides honorific for guests and never uses email as a name', () => {
    expect(
      resolveYansiCreatorDisplayName({ isGuest: true, publicDisplayName: 'Ada' })
    ).toBe('Misafir');
    expect(
      resolveYansiCreatorHonorific({ isGuest: true, publicHonorific: 'bilgin' })
    ).toBeNull();
    expect(
      resolveYansiCreatorDisplayName({ isGuest: false, publicDisplayName: null })
    ).toBe(PUBLIC_DISPLAY_NAME_FALLBACK);
    expect(
      resolveYansiCreatorDisplayName({
        isGuest: false,
        publicDisplayName: 'Mert Karaca',
      })
    ).toBe('Mert Karaca');
  });
});

describe('SainaHeroScene creator identity', () => {
  it('renders name, Meraklı, metadata, and curiosity without plan or handle', () => {
    render(
      <SainaHeroScene
        title="Hiç Mardin'de olmadım ama taşlarını merak ettim"
        displayName="Mert Karaca"
        honorificId="curious"
        honorificLabel="Meraklı"
        userId="user-1"
        metaTimeLabel="14:32"
        metaTypeLabel="Yeni sohbet"
      />
    );
    expect(screen.getByTestId('saina-yansi-identity-name')).toHaveTextContent(
      'Mert Karaca'
    );
    expect(screen.getByTestId('saina-yansi-identity-honorific')).toHaveTextContent(
      'Meraklı'
    );
    expect(screen.getByTestId('saina-yansi-identity-meta')).toHaveTextContent('14:32');
    expect(screen.getByTestId('saina-yansi-identity-meta-type')).toHaveTextContent(
      'Yeni sohbet'
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "Hiç Mardin'de olmadım ama taşlarını merak ettim"
    );
    expect(screen.queryByText('biligN Free')).not.toBeInTheDocument();
    expect(screen.queryByText('biligN Premium ✦')).not.toBeInTheDocument();
    expect(screen.queryByText(/@mertkaraca/i)).not.toBeInTheDocument();
  });

  it('supports Bilgin without a filled achievement badge', () => {
    const { container } = render(
      <SainaHeroScene
        title="Yeni Sohbet"
        displayName="Mert Karaca"
        honorificId="bilgin"
        honorificLabel="Bilgin"
      />
    );
    expect(screen.getByTestId('saina-yansi-identity-honorific')).toHaveTextContent(
      'Bilgin'
    );
    expect(container.querySelector('.bilign-honorific--bilgin')).not.toBeNull();
    expect(container.querySelector('.bilign-progress')).toBeNull();
  });

  it('omits honorific for guest-safe local identity', () => {
    render(
      <SainaHeroScene title="Yeni Sohbet" displayName="Misafir" honorificLabel={null} />
    );
    expect(screen.getByTestId('saina-yansi-identity-name')).toHaveTextContent('Misafir');
    expect(screen.queryByTestId('saina-yansi-identity-honorific')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-yansi-identity-meta')).not.toBeInTheDocument();
  });

  it('renders published Yansı metadata when labels are provided', () => {
    render(
      <SainaHeroScene
        title="Taş evler"
        displayName="Tarık Ayşe"
        honorificId="curious"
        honorificLabel="Meraklı"
        metaTimeLabel="Dün 21:08"
        metaTypeLabel="Yansı"
      />
    );
    expect(screen.getByTestId('saina-yansi-identity-meta-type')).toHaveTextContent('Yansı');
  });
});
