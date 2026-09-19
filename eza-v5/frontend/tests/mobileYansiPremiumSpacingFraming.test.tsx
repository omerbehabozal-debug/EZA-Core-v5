/**
 * Mobile Yansı premium vertical spacing + lower square-ish image stage.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı premium spacing + framing', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('gives identity → title height-responsive editorial breath', () => {
    expect(mobileBlock).toContain(
      '--saina-mobile-identity-title-breath: clamp(1.75rem, 4.2dvh, 2.75rem)'
    );
    expect(mobileBlock).toMatch(
      /\.saina-main-body[\s\S]*padding-top:\s*var\(--saina-mobile-identity-title-breath\)/
    );
  });

  it('balances short conversation in chat-column; main-body scrolls long content', () => {
    expect(mobileBlock).toMatch(/\.saina-main-body[\s\S]*justify-content:\s*flex-start/);
    expect(mobileBlock).toMatch(/\.saina-main-body[\s\S]*overflow-y:\s*auto/);
    expect(mobileBlock).toMatch(
      /\.saina-chat-column--mobile-rail[\s\S]*justify-content:\s*safe center/
    );
    expect(mobileBlock).toMatch(
      /\.saina-main-body[\s\S]*padding-bottom:\s*var\(--saina-mobile-bottom-chrome-height\)/
    );
  });

  it('keeps composer viewport-fixed with bottom reserve including ~24–32px safe gap', () => {
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/
    );
    expect(mobileBlock).toContain('max(1.5rem, env(safe-area-inset-bottom, 0px))');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });

  it('keeps full-bleed near-square paint frame (not a shortened mid-screen clip)', () => {
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-height: 110dvh');
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-width: max(112%, 110dvh)');
    const frameRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {'),
      mobileBlock.indexOf(
        '.saina-app-root.saina-standalone-shell .saina-canvas-overlay--center'
      )
    );
    expect(frameRule).toMatch(/top:\s*50%/);
    expect(frameRule).toContain('var(--saina-mobile-cover-frame-height)');
    expect(frameRule).toContain('var(--saina-mobile-cover-frame-width)');
    expect(mobileBlock).not.toContain('--saina-mobile-cover-frame-height: min(100vw, 54dvh)');
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-center-y');
  });

  it('keeps scene-fit full-bleed and cover + focal authority', () => {
    const fitRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit {'),
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {')
    );
    expect(fitRule).toMatch(/inset:\s*0/);
    expect(mirror).toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*cover/s
    );
    expect(mirror).toContain('--mirror-focal-position');
  });

  it('keeps identity zone dark; soft photographic entrance around title', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\.995\) 0%[\s\S]*rgba\(9, 11, 11, 0\) 46%/
    );
    const headerBefore = mobileBlock.slice(
      mobileBlock.indexOf('.saina-mobile-yansi-header::before {'),
      mobileBlock.indexOf('.saina-mobile-yansi-header > *')
    );
    expect(headerBefore).toMatch(/height:\s*100%/);
    expect(headerBefore).not.toMatch(/height:\s*36dvh/);
  });

  it('preserves title contrast, Ayna float, and desktop freeze', () => {
    expect(mobileBlock).toMatch(
      /\.saina-hero-title\s*\{[^}]*color:\s*var\(--bilign-text\)/s
    );
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
    expect(desktopBlock).not.toContain('--saina-mobile-identity-title-breath');
    expect(desktopBlock).not.toContain('--saina-mobile-cover-frame-height');
  });
});
