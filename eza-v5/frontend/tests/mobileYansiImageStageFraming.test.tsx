/**
 * Mobile Yansı cinematic framing — full-bleed paint + gradient clear-stage.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı cinematic framing + bleed', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const scene = read('components/saina/SainaCinematicScene.tsx');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('keeps fullscreen shell at 100dvh', () => {
    expect(mobileBlock).toMatch(/\.saina-shell[\s\S]*height:\s*100dvh/);
  });

  it('paints a near-square overscan frame so photo bleeds under bottom chrome', () => {
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-height: 110dvh');
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-width: max(112%, 110dvh)');
    const frameRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {'),
      mobileBlock.indexOf(
        '.saina-app-root.saina-standalone-shell .saina-canvas-overlay--center'
      )
    );
    expect(frameRule).toContain('var(--saina-mobile-cover-frame-height)');
    expect(frameRule).toContain('var(--saina-mobile-cover-frame-width)');
    expect(frameRule).toMatch(/top:\s*50%/);
    expect(frameRule).toContain('aspect-ratio: auto !important');
    expect(frameRule).not.toContain('image-stage-center-y');
    expect(mobileBlock).not.toContain('--saina-mobile-cover-frame-height: min(100vw, 54dvh)');
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-center-y');
  });

  it('keeps scene-fit full-bleed so the image is not hard-clipped into a photo box', () => {
    const fitRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit {'),
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {')
    );
    expect(fitRule).toMatch(/inset:\s*0/);
    expect(fitRule).not.toMatch(/inset:\s*auto/);
  });

  it('uses gradient overlays (not frame clip) for top/bottom cinematic veil', () => {
    expect(mobileBlock).toMatch(
      /\.saina-mobile-yansi-header::before[\s\S]*height:\s*100%/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*height:\s*36dvh/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\) 46%[\s\S]*rgba\(9, 11, 11, 0\) 54%/
    );
  });

  it('pins composer/Ayna bottom chrome to the viewport (not content scroll)', () => {
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/
    );
    expect(mobileBlock).toContain('--saina-mobile-bottom-chrome-height');
    expect(mobileBlock).toMatch(
      /\.saina-main-body[\s\S]*padding-bottom:\s*var\(--saina-mobile-bottom-chrome-height\)/
    );
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
  });

  it('restores bright title contrast via primary ivory token', () => {
    expect(mobileBlock).toMatch(
      /\.saina-hero-title[\s\S]*color:\s*var\(--bilign-text\)/
    );
    expect(css).toContain('--bilign-text: #e8e2d7');
  });

  it('preserves cover + focal; keyboard inset still lifts bottom chrome', () => {
    expect(mirror).toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*cover/s
    );
    expect(mirror).toContain('--mirror-focal-position');
    expect(scene).toContain('mirrorFocalCssVars');
    expect(mobileBlock).not.toMatch(/background-size:\s*contain/);
    const frameVars = mobileBlock.slice(
      mobileBlock.indexOf('--saina-mobile-cover-frame-height'),
      mobileBlock.indexOf('.saina-canvas-bg--default-scene')
    );
    expect(frameVars).not.toContain('--saina-keyboard-inset');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });

  it('keeps center free of radial/pattern dim and leaves desktop untouched', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--center[\s\S]*display:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--pattern-dim[\s\S]*display:\s*none/
    );
    expect(desktopBlock).not.toContain('--saina-mobile-cover-frame-height');
    expect(desktopBlock).not.toContain('--saina-mobile-bottom-chrome-height');
  });
});
