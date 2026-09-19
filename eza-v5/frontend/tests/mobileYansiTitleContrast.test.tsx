/**
 * Mobile Yansı title contrast — protects against header veil stacking over the h1.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı title contrast stacking', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('keeps the existing h1.saina-hero-title as title authority', () => {
    expect(hero).toContain('className="saina-hero-title"');
    expect(hero).toMatch(/<h1 className="saina-hero-title">\{title\}<\/h1>/);
  });

  it('uses primary ivory at full opacity on the mobile title', () => {
    expect(mobileBlock).toMatch(
      /\.saina-hero-title\s*\{[^}]*color:\s*var\(--bilign-text\)/s
    );
    expect(mobileBlock).toMatch(/\.saina-hero-title\s*\{[^}]*opacity:\s*1/s);
    expect(css).toContain('--bilign-text: #e8e2d7');
  });

  it('does not let header::before extend as a 36dvh veil over main-body title', () => {
    const headerBefore = mobileBlock.slice(
      mobileBlock.indexOf('.saina-mobile-yansi-header::before {'),
      mobileBlock.indexOf('.saina-mobile-yansi-header > *')
    );
    expect(headerBefore).toMatch(/height:\s*100%/);
    expect(headerBefore).not.toMatch(/height:\s*36dvh/);
    // Do not clip overflow menus — containment is via height:100%, not overflow:hidden.
    expect(mobileBlock).not.toMatch(
      /\.saina-mobile-yansi-header\s*\{[^}]*overflow:\s*hidden/s
    );
  });

  it('keeps long cinematic top fade on the vignette behind text', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\.99\)/
    );
    expect(mobileBlock).toContain(
      '--saina-mobile-cover-frame-height: min(100vw, 54dvh)'
    );
  });

  it('raises hero content above main-body assist veil', () => {
    expect(mobileBlock).toMatch(
      /\.saina-hero--content\s*\{[^}]*z-index:\s*2/s
    );
  });

  it('does not change desktop title token or mobile framing/bottom chrome', () => {
    expect(desktopBlock).toMatch(
      /\.saina-hero-title\s*\{[^}]*color:\s*var\(--bilign-body\)/s
    );
    expect(mobileBlock).toContain('width: 108%');
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*position:\s*fixed/
    );
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });
});
