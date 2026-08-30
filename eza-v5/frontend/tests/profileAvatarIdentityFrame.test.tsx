import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BilignAvatarIdentityFrame from '@/components/mirror/ayna/BilignAvatarIdentityFrame';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import {
  AVATAR_IDENTITY_POLYGON_A,
  AVATAR_IDENTITY_POLYGON_B,
  AVATAR_IDENTITY_POLYGON_VERTEX_COUNT,
} from '@/lib/eza/profile/avatarIdentityFrameGeometry';

vi.mock('@/hooks/useResolvedProfileAvatar', () => ({
  useResolvedProfileAvatar: () => ({ url: null, revision: undefined }),
}));

function readCss(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('avatarIdentityFrameGeometry', () => {
  it('uses 16 vertices per polygon contour', () => {
    expect(AVATAR_IDENTITY_POLYGON_VERTEX_COUNT).toBe(16);
  });

  it('keeps polygon B slightly larger and counter-rotated for weave', () => {
    expect(AVATAR_IDENTITY_POLYGON_A.rotationDeg).toBe(-1);
    expect(AVATAR_IDENTITY_POLYGON_B.rotationDeg).toBe(1);
    expect(AVATAR_IDENTITY_POLYGON_B.scale).toBeGreaterThan(AVATAR_IDENTITY_POLYGON_A.scale);
  });
});

describe('BilignAvatarIdentityFrame presentation', () => {
  it('renders aria-hidden non-interactive SVG polygons', () => {
    render(
      <BilignAvatarIdentityFrame variant="hero">
        <ProfileUserAvatar displayName="Ada" size="hero" />
      </BilignAvatarIdentityFrame>
    );
    const frame = screen.getByTestId('bilign-avatar-identity-frame');
    expect(frame).toHaveAttribute('data-frame-variant', 'hero');
    const svg = frame.querySelector('svg.bilign-avatar-identity-polygons');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(readCss('styles/bilign-avatar-identity-frame.css')).toContain('pointer-events: none');
    expect(frame.querySelectorAll('polygon')).toHaveLength(2);
  });

  it('keeps avatar photo circular without changing authority component', () => {
    render(
      <BilignAvatarIdentityFrame variant="profile">
        <ProfileUserAvatar displayName="Ada" size="panel" />
      </BilignAvatarIdentityFrame>
    );
    expect(screen.getByTestId('bilign-profile-avatar')).toBeInTheDocument();
    const css = readCss('styles/bilign-avatar-identity-frame.css');
    expect(css).toContain('border-radius: 999px');
    expect(css).not.toContain('clip-path');
  });
});

describe('identity frame surface matrix', () => {
  it('hero scene includes overlapping polygon frame', () => {
    render(<SainaHeroScene displayName="Ada" honorificLabel="Meraklı" />);
    expect(screen.getByTestId('bilign-avatar-identity-frame')).toBeInTheDocument();
    expect(screen.getByTestId('saina-yansi-identity')).toBeInTheDocument();
  });

  it('author row does not include identity frame', () => {
    render(<AynaAuthorRow displayName="Ada" honorific="curious" />);
    expect(screen.queryByTestId('bilign-avatar-identity-frame')).not.toBeInTheDocument();
  });
});

describe('identity frame sizing tokens', () => {
  it('documents hero, profile, and mobile envelope sizes', () => {
    const css = readCss('styles/bilign-avatar-identity-frame.css');
    expect(css).toMatch(/\.bilign-avatar-identity-frame--hero[\s\S]*width:\s*96px/);
    expect(css).toMatch(/\.bilign-avatar-identity-frame--profile[\s\S]*width:\s*83px/);
    expect(css).toMatch(/\.bilign-avatar-identity-frame--mobile[\s\S]*width:\s*76px/);
    expect(css).not.toContain('bilign-avatar-orbit');
    expect(css).not.toContain('octagon');
  });

  it('replaces legacy octagonal orbit markup in hero scene', () => {
    const hero = readFileSync(
      join(process.cwd(), 'components/saina/SainaHeroScene.tsx'),
      'utf8'
    );
    expect(hero).toContain('BilignAvatarIdentityFrame');
    expect(hero).not.toContain('bilign-avatar-orbit');
  });
});
