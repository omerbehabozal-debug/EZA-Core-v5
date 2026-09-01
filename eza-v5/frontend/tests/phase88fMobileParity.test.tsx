import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SainaHeroScene from '@/components/saina/SainaHeroScene';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Phase 8.8F-M mobile visual parity', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const frame = read('styles/bilign-avatar-identity-frame.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');

  it('no longer blanket-hides hero identity on mobile', () => {
    expect(css).not.toMatch(
      /\.bilign-yansi-identity__mark,\s*\n\.saina-app-root\.saina-standalone-shell \.bilign-yansi-identity__name-row/
    );
    expect(css).toContain('Phase 8.8F-M: mobile scene-first Yansı parity');
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-yansi-identity__name-row[\s\S]*display:\s*flex/
    );
  });

  it('defines mobile hero avatar at 66px with 76px polygon envelope', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-yansi-identity__mark[\s\S]*width:\s*66px/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-avatar-identity-polygons[\s\S]*width:\s*76px/
    );
    expect(frame).toMatch(/@media \(max-width: 899px\)[\s\S]*width:\s*66px/);
  });

  it('removes legacy mobile chat card glass treatment', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-chat-card[\s\S]*border:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-chat-card[\s\S]*background:\s*transparent/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-chat-card \.saina-msg-ai[\s\S]*background:\s*transparent/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-msg-user--standalone[\s\S]*background:\s*transparent/
    );
  });

  it('applies scene body shadow to message prose on mobile', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-msg-prose[\s\S]*text-shadow:\s*var\(--saina-scene-body-shadow\)/
    );
  });

  it('adds soft radial reading atmosphere on mobile without card geometry', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-main-body:not\(\.saina-main-body--empty\)::after/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*radial-gradient[\s\S]*ellipse 78%/
    );
    expect(css).not.toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-main-body:not\(\.saina-main-body--empty\)::after[\s\S]*mask-image/
    );
  });

  it('modernizes mobile composer and top controls away from white-border glass', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-composer-box[\s\S]*border:\s*1px solid rgba\(232, 226, 215, 0\.1\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-standalone-menu-btn[\s\S]*border:\s*1px solid rgba\(232, 226, 215, 0\.08\)/
    );
  });

  it('softens mobile bottom anchor strip into atmospheric fade', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-chat-bottom-anchor[\s\S]*linear-gradient/
    );
    expect(mirror).toContain('rgba(10, 18, 24, 0.94)');
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-chat-bottom-anchor[\s\S]*rgba\(9, 11, 11, 0\.38\)/
    );
  });

  it('keeps mobile Ayna rail and drawer navigation', () => {
    expect(shell).toContain('SainaMobileMirrorRail');
    expect(shell).toContain('showMobileMenu');
    expect(css).toMatch(/@media \(max-width: 899px\)[\s\S]*\.saina-mobile-mirror-cta/);
    expect(css).toMatch(/@media \(max-width: 899px\)[\s\S]*\.saina-sidebar\.saina-sidebar--mobile-open/);
  });

  it('includes 320px safety tuning', () => {
    expect(css).toContain('@media (max-width: 360px)');
  });

  it('preserves desktop >=900px identity scale unchanged', () => {
    expect(css).toMatch(
      /@media \(min-width: 900px\)[\s\S]*--saina-hero-identity-scale:\s*1\.484/
    );
    expect(css).toMatch(
      /@media \(min-width: 900px\)[\s\S]*calc\(62px \* var\(--saina-hero-identity-scale\)\)/
    );
    expect(css).toMatch(
      /@media \(min-width: 900px\)[\s\S]*\.saina-chat-card[\s\S]*border:\s*none/
    );
  });
});

describe('Phase 8.8F-M mobile hero rendering', () => {
  it('renders creator, honorific, metadata, and title in hero scene', () => {
    render(
      <SainaHeroScene
        title="Hiç Mardin'de olmadım"
        displayName="Tarık Ayşe"
        honorificId="curious"
        honorificLabel="Meraklı"
        metaTimeLabel="14:32"
        metaTypeLabel="Yeni sohbet"
      />
    );
    expect(screen.getByTestId('saina-yansi-identity-name')).toHaveTextContent('Tarık Ayşe');
    expect(screen.getByTestId('saina-yansi-identity-honorific')).toHaveTextContent('Meraklı');
    expect(screen.getByTestId('saina-yansi-identity-meta')).toHaveTextContent('14:32');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Hiç Mardin'de olmadım");
    expect(screen.getByTestId('bilign-avatar-identity-frame')).toBeInTheDocument();
  });
});

describe('Phase 8.8F-M shell contracts unchanged', () => {
  const shell = read('components/saina/SainaStandaloneShell.tsx');

  it('does not replace mobile mirror rail with desktop context rail', () => {
    expect(shell).toContain('!isCompactShell');
    expect(shell).toContain('SainaMobileMirrorRail');
    expect(shell).toContain('isCompactShell ?');
    expect(shell).toContain('SainaYansiContextRail');
  });
});
